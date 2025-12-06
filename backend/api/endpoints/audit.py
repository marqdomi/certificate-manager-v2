"""
Audit API Endpoints - v2.5

Provides REST API for querying audit logs.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from enum import Enum

from db.base import get_db
from db.models import AuditLog, AuditAction, AuditResult, User
from services.auth_service import get_current_user
from services.audit_service import AuditService

router = APIRouter(prefix="/audit", tags=["Audit"])


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class AuditLogResponse(BaseModel):
    id: int
    timestamp: datetime
    username: Optional[str] = None
    action: str
    result: str
    resource_type: str
    resource_id: Optional[int] = None
    resource_name: Optional[str] = None
    device_hostname: Optional[str] = None
    description: Optional[str] = None
    error_message: Optional[str] = None
    
    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    logs: List[AuditLogResponse]
    total: int
    page: int
    page_size: int


class AuditStatsResponse(BaseModel):
    total_entries: int
    by_action: dict
    by_result: dict
    recent_failures: int


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------

@router.get("/logs", response_model=AuditLogListResponse)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=10, le=200),
    action: Optional[str] = Query(None, description="Filter by action type"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    username: Optional[str] = Query(None, description="Filter by username"),
    device_id: Optional[int] = Query(None, description="Filter by device ID"),
    result: Optional[str] = Query(None, description="Filter by result (success/failure/partial)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List audit log entries with optional filtering.
    Requires authentication.
    """
    query = db.query(AuditLog)
    
    # Apply filters
    if action:
        try:
            action_enum = AuditAction(action)
            query = query.filter(AuditLog.action == action_enum)
        except ValueError:
            pass  # Invalid action, ignore filter
    
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    
    if username:
        query = query.filter(AuditLog.username.ilike(f"%{username}%"))
    
    if device_id:
        query = query.filter(AuditLog.device_id == device_id)
    
    if result:
        try:
            result_enum = AuditResult(result)
            query = query.filter(AuditLog.result == result_enum)
        except ValueError:
            pass
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * page_size
    logs = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(page_size).all()
    
    return AuditLogListResponse(
        logs=[AuditLogResponse(
            id=log.id,
            timestamp=log.timestamp,
            username=log.username,
            action=log.action.value,
            result=log.result.value,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            resource_name=log.resource_name,
            device_hostname=log.device_hostname,
            description=log.description,
            error_message=log.error_message,
        ) for log in logs],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/logs/{log_id}", response_model=AuditLogResponse)
async def get_audit_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific audit log entry with full details."""
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    if not log:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Audit log not found")
    
    return AuditLogResponse(
        id=log.id,
        timestamp=log.timestamp,
        username=log.username,
        action=log.action.value,
        result=log.result.value,
        resource_type=log.resource_type,
        resource_id=log.resource_id,
        resource_name=log.resource_name,
        device_hostname=log.device_hostname,
        description=log.description,
        error_message=log.error_message,
    )


@router.get("/resource/{resource_type}/{resource_id}")
async def get_resource_audit_history(
    resource_type: str,
    resource_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get audit history for a specific resource."""
    service = AuditService(db)
    logs = service.get_logs_for_resource(resource_type, resource_id, limit)
    
    return {
        "resource_type": resource_type,
        "resource_id": resource_id,
        "logs": [AuditLogResponse(
            id=log.id,
            timestamp=log.timestamp,
            username=log.username,
            action=log.action.value,
            result=log.result.value,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            resource_name=log.resource_name,
            device_hostname=log.device_hostname,
            description=log.description,
            error_message=log.error_message,
        ) for log in logs]
    }


@router.get("/device/{device_id}")
async def get_device_audit_history(
    device_id: int,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all audit logs related to a specific device."""
    service = AuditService(db)
    logs = service.get_logs_for_device(device_id, limit)
    
    return {
        "device_id": device_id,
        "logs": [AuditLogResponse(
            id=log.id,
            timestamp=log.timestamp,
            username=log.username,
            action=log.action.value,
            result=log.result.value,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            resource_name=log.resource_name,
            device_hostname=log.device_hostname,
            description=log.description,
            error_message=log.error_message,
        ) for log in logs]
    }


@router.get("/stats", response_model=AuditStatsResponse)
async def get_audit_stats(
    days: int = Query(7, ge=1, le=90, description="Number of days to include"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get audit statistics for dashboard."""
    from datetime import timedelta
    from sqlalchemy import func
    
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    # Total entries in period
    total = db.query(AuditLog).filter(AuditLog.timestamp >= cutoff).count()
    
    # Count by action
    action_counts = db.query(
        AuditLog.action, 
        func.count(AuditLog.id)
    ).filter(
        AuditLog.timestamp >= cutoff
    ).group_by(AuditLog.action).all()
    
    by_action = {a.value: c for a, c in action_counts}
    
    # Count by result
    result_counts = db.query(
        AuditLog.result,
        func.count(AuditLog.id)
    ).filter(
        AuditLog.timestamp >= cutoff
    ).group_by(AuditLog.result).all()
    
    by_result = {r.value: c for r, c in result_counts}
    
    # Recent failures - sum all non-success results from the counts we already have
    failures = sum(c for r, c in result_counts if r != AuditResult.SUCCESS)
    
    return AuditStatsResponse(
        total_entries=total,
        by_action=by_action,
        by_result=by_result,
        recent_failures=failures
    )


@router.get("/actions")
async def list_audit_actions(
    current_user: User = Depends(get_current_user)
):
    """List all available audit action types for filtering."""
    return {
        "actions": [
            {"value": action.value, "label": action.value.replace("_", " ").title()}
            for action in AuditAction
        ]
    }
