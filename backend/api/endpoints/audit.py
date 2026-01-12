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


class RecentActivityItem(BaseModel):
    action: str
    status: str
    details: Optional[str] = None
    target: Optional[str] = None
    timestamp: datetime
    user: Optional[str] = None


class AuditStatsResponse(BaseModel):
    total_entries: int
    by_action: dict
    by_result: dict
    recent_failures: int
    recent_activities: List[RecentActivityItem] = []


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
    
    # Get recent activities (last 10)
    recent_logs = db.query(AuditLog).order_by(
        AuditLog.timestamp.desc()
    ).limit(10).all()
    
    recent_activities = [
        RecentActivityItem(
            action=log.action.value,
            status=log.result.value,
            details=log.description or log.resource_name,
            target=log.device_hostname or log.resource_type,
            timestamp=log.timestamp,
            user=log.username
        )
        for log in recent_logs
    ]
    
    return AuditStatsResponse(
        total_entries=total,
        by_action=by_action,
        by_result=by_result,
        recent_failures=failures,
        recent_activities=recent_activities
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

# --------------------------------------------------------------------------
# Export Endpoints
# --------------------------------------------------------------------------

@router.get("/export/csv")
async def export_audit_logs_csv(
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    username: Optional[str] = Query(None, description="Filter by username"),
    result: Optional[str] = Query(None, description="Filter by result"),
    max_records: int = Query(10000, ge=1, le=50000, description="Maximum records to export"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export audit logs to CSV format.
    Requires authentication. Rate limited to prevent abuse.
    """
    from fastapi.responses import StreamingResponse
    from core.rate_limiter import limiter, EXPORT_RATE_LIMIT
    import csv
    import io
    
    query = db.query(AuditLog)
    
    # Apply date filters
    if start_date:
        query = query.filter(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.filter(AuditLog.timestamp <= end_date)
    
    # Apply other filters
    if action:
        try:
            action_enum = AuditAction(action)
            query = query.filter(AuditLog.action == action_enum)
        except ValueError:
            pass
    
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    
    if username:
        query = query.filter(AuditLog.username.ilike(f"%{username}%"))
    
    if result:
        try:
            result_enum = AuditResult(result)
            query = query.filter(AuditLog.result == result_enum)
        except ValueError:
            pass
    
    # Limit records and order
    logs = query.order_by(AuditLog.timestamp.desc()).limit(max_records).all()
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        'ID', 'Timestamp', 'Username', 'Action', 'Result', 
        'Resource Type', 'Resource ID', 'Resource Name',
        'Device Hostname', 'Description', 'Error Message',
        'IP Address', 'User Agent'
    ])
    
    # Write data rows
    for log in logs:
        writer.writerow([
            log.id,
            log.timestamp.isoformat() if log.timestamp else '',
            log.username or '',
            log.action.value if log.action else '',
            log.result.value if log.result else '',
            log.resource_type or '',
            log.resource_id or '',
            log.resource_name or '',
            log.device_hostname or '',
            log.description or '',
            log.error_message or '',
            log.ip_address or '',
            log.user_agent or ''
        ])
    
    output.seek(0)
    
    # Generate filename with current date
    filename = f"cmt_audit_log_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "X-Total-Records": str(len(logs))
        }
    )


@router.get("/export/excel")
async def export_audit_logs_excel(
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    username: Optional[str] = Query(None, description="Filter by username"),
    result: Optional[str] = Query(None, description="Filter by result"),
    max_records: int = Query(10000, ge=1, le=50000, description="Maximum records to export"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export audit logs to Excel format (XLSX).
    Requires authentication. Rate limited to prevent abuse.
    """
    from fastapi.responses import Response
    from fastapi import HTTPException
    import io
    
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="Excel export not available. Install openpyxl package."
        )
    
    query = db.query(AuditLog)
    
    # Apply date filters
    if start_date:
        query = query.filter(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.filter(AuditLog.timestamp <= end_date)
    
    # Apply other filters
    if action:
        try:
            action_enum = AuditAction(action)
            query = query.filter(AuditLog.action == action_enum)
        except ValueError:
            pass
    
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    
    if username:
        query = query.filter(AuditLog.username.ilike(f"%{username}%"))
    
    if result:
        try:
            result_enum = AuditResult(result)
            query = query.filter(AuditLog.result == result_enum)
        except ValueError:
            pass
    
    # Limit records and order
    logs = query.order_by(AuditLog.timestamp.desc()).limit(max_records).all()
    
    # Create Excel workbook
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Audit Log"
    
    # Define header style
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    
    # Write header
    headers = [
        'ID', 'Timestamp', 'Username', 'Action', 'Result', 
        'Resource Type', 'Resource ID', 'Resource Name',
        'Device Hostname', 'Description', 'Error Message',
        'IP Address', 'User Agent'
    ]
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center')
    
    # Write data rows
    for row_num, log in enumerate(logs, 2):
        ws.cell(row=row_num, column=1, value=log.id)
        ws.cell(row=row_num, column=2, value=log.timestamp.isoformat() if log.timestamp else '')
        ws.cell(row=row_num, column=3, value=log.username or '')
        ws.cell(row=row_num, column=4, value=log.action.value if log.action else '')
        ws.cell(row=row_num, column=5, value=log.result.value if log.result else '')
        ws.cell(row=row_num, column=6, value=log.resource_type or '')
        ws.cell(row=row_num, column=7, value=log.resource_id or '')
        ws.cell(row=row_num, column=8, value=log.resource_name or '')
        ws.cell(row=row_num, column=9, value=log.device_hostname or '')
        ws.cell(row=row_num, column=10, value=log.description or '')
        ws.cell(row=row_num, column=11, value=log.error_message or '')
        ws.cell(row=row_num, column=12, value=log.ip_address or '')
        ws.cell(row=row_num, column=13, value=log.user_agent or '')
        
        # Color code results
        result_cell = ws.cell(row=row_num, column=5)
        if log.result == AuditResult.SUCCESS:
            result_cell.fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
        elif log.result == AuditResult.FAILURE:
            result_cell.fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
        elif log.result == AuditResult.PARTIAL:
            result_cell.fill = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")
    
    # Auto-adjust column widths
    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column].width = adjusted_width
    
    # Save to bytes
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    # Generate filename with current date
    filename = f"cmt_audit_log_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "X-Total-Records": str(len(logs))
        }
    )