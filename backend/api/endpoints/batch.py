"""
Batch Renewal API Endpoints - v2.5

Provides REST API for batch operations on certificates,
particularly useful for wildcard certificates deployed across multiple devices.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from enum import Enum

from db.base import get_db
from db.models import Certificate, Device, User, AuditAction, AuditResult
from services.auth_service import get_current_user
from services.audit_service import AuditService
from core.logger import setup_logger

logger = setup_logger("cmt.batch")

router = APIRouter(prefix="/batch", tags=["Batch Operations"])


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class WildcardGroup(BaseModel):
    """A group of certificates with the same wildcard pattern."""
    common_name: str
    certificate_count: int
    device_count: int
    devices: List[dict]  # [{id, hostname, cert_id, expiration}]
    earliest_expiration: Optional[datetime] = None
    latest_expiration: Optional[datetime] = None


class WildcardGroupsResponse(BaseModel):
    groups: List[WildcardGroup]
    total_wildcards: int


class BatchDeployRequest(BaseModel):
    """Request to deploy a certificate to multiple devices."""
    source_cert_id: int  # The certificate with the new PFX
    target_device_ids: List[int]  # Devices to deploy to
    replace_cert_ids: Optional[List[int]] = None  # Specific certs to replace (optional)


class BatchDeployStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"


class DeviceDeployResult(BaseModel):
    device_id: int
    hostname: str
    status: BatchDeployStatus
    message: Optional[str] = None
    cert_id: Optional[int] = None


class BatchDeployResponse(BaseModel):
    batch_id: str
    status: BatchDeployStatus
    total_devices: int
    completed: int
    failed: int
    results: List[DeviceDeployResult]


# In-memory store for batch operations (would be Redis in production)
_batch_operations = {}


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------

@router.get("/wildcards", response_model=WildcardGroupsResponse)
async def get_wildcard_groups(
    min_devices: int = 2,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Find wildcard certificates that exist on multiple devices.
    Useful for identifying certificates that need batch renewal.
    """
    # Query for certificates starting with *. grouped by name
    wildcard_certs = db.query(
        Certificate.name,
        func.count(Certificate.id).label('cert_count'),
        func.count(func.distinct(Certificate.device_id)).label('device_count'),
        func.min(Certificate.expiration_date).label('earliest_exp'),
        func.max(Certificate.expiration_date).label('latest_exp')
    ).filter(
        Certificate.name.like('*.%')
    ).group_by(
        Certificate.name
    ).having(
        func.count(func.distinct(Certificate.device_id)) >= min_devices
    ).all()
    
    groups = []
    for wc in wildcard_certs:
        # Get devices for this wildcard
        devices_query = db.query(
            Certificate.id,
            Certificate.device_id,
            Certificate.expiration_date,
            Device.hostname
        ).join(
            Device, Certificate.device_id == Device.id
        ).filter(
            Certificate.name == wc.name
        ).all()
        
        devices = [
            {
                "id": d.device_id,
                "hostname": d.hostname,
                "cert_id": d.id,
                "expiration": d.expiration_date.isoformat() if d.expiration_date else None
            }
            for d in devices_query
        ]
        
        groups.append(WildcardGroup(
            common_name=wc.name,
            certificate_count=wc.cert_count,
            device_count=wc.device_count,
            devices=devices,
            earliest_expiration=wc.earliest_exp,
            latest_expiration=wc.latest_exp
        ))
    
    # Sort by earliest expiration (most urgent first)
    groups.sort(key=lambda g: g.earliest_expiration or datetime.max)
    
    return WildcardGroupsResponse(
        groups=groups,
        total_wildcards=len(groups)
    )


@router.get("/wildcards/{common_name}")
async def get_wildcard_details(
    common_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed information about a specific wildcard across all devices."""
    certs = db.query(
        Certificate,
        Device.hostname,
        Device.ip_address,
        Device.environment
    ).join(
        Device, Certificate.device_id == Device.id
    ).filter(
        Certificate.name == common_name
    ).all()
    
    if not certs:
        raise HTTPException(status_code=404, detail=f"No certificates found with name {common_name}")
    
    return {
        "common_name": common_name,
        "total_instances": len(certs),
        "instances": [
            {
                "cert_id": c.Certificate.id,
                "device_id": c.Certificate.device_id,
                "hostname": c.hostname,
                "ip_address": c.ip_address,
                "environment": c.environment,
                "expiration_date": c.Certificate.expiration_date,
                "serial_number": c.Certificate.serial_number,
                "issuer": c.Certificate.issuer,
                "renewal_status": c.Certificate.renewal_status.value if c.Certificate.renewal_status else None
            }
            for c in certs
        ]
    }


@router.post("/deploy", response_model=BatchDeployResponse)
async def batch_deploy_certificate(
    request: BatchDeployRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deploy a certificate to multiple devices in batch.
    Returns immediately with a batch_id for tracking progress.
    """
    import uuid
    
    # Validate source certificate
    source_cert = db.query(Certificate).filter(Certificate.id == request.source_cert_id).first()
    if not source_cert:
        raise HTTPException(status_code=404, detail="Source certificate not found")
    
    # Validate target devices
    devices = db.query(Device).filter(Device.id.in_(request.target_device_ids)).all()
    if len(devices) != len(request.target_device_ids):
        raise HTTPException(status_code=400, detail="Some target devices not found")
    
    # Create batch operation
    batch_id = str(uuid.uuid4())[:8]
    results = [
        DeviceDeployResult(
            device_id=d.id,
            hostname=d.hostname,
            status=BatchDeployStatus.PENDING
        )
        for d in devices
    ]
    
    _batch_operations[batch_id] = {
        "status": BatchDeployStatus.IN_PROGRESS,
        "total": len(devices),
        "completed": 0,
        "failed": 0,
        "results": results,
        "source_cert_id": request.source_cert_id,
        "started_at": datetime.utcnow(),
        "user": current_user.username
    }
    
    # Log audit entry
    audit = AuditService(db)
    audit._create_entry(
        action=AuditAction.CERT_DEPLOYED,
        resource_type="batch_deployment",
        resource_name=f"Batch deploy {source_cert.name} to {len(devices)} devices",
        user=current_user,
        description=f"Started batch deployment to devices: {[d.hostname for d in devices]}"
    )
    
    # Schedule background task for actual deployment
    background_tasks.add_task(
        _execute_batch_deploy,
        batch_id,
        request.source_cert_id,
        request.target_device_ids,
        request.replace_cert_ids,
        current_user.username
    )
    
    return BatchDeployResponse(
        batch_id=batch_id,
        status=BatchDeployStatus.IN_PROGRESS,
        total_devices=len(devices),
        completed=0,
        failed=0,
        results=results
    )


@router.get("/deploy/{batch_id}", response_model=BatchDeployResponse)
async def get_batch_deploy_status(
    batch_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get the current status of a batch deployment operation."""
    if batch_id not in _batch_operations:
        raise HTTPException(status_code=404, detail="Batch operation not found")
    
    op = _batch_operations[batch_id]
    return BatchDeployResponse(
        batch_id=batch_id,
        status=op["status"],
        total_devices=op["total"],
        completed=op["completed"],
        failed=op["failed"],
        results=op["results"]
    )


@router.get("/deploy")
async def list_batch_operations(
    current_user: User = Depends(get_current_user)
):
    """List all batch deployment operations (recent)."""
    return {
        "operations": [
            {
                "batch_id": bid,
                "status": op["status"].value,
                "total": op["total"],
                "completed": op["completed"],
                "failed": op["failed"],
                "started_at": op["started_at"].isoformat(),
                "user": op["user"]
            }
            for bid, op in _batch_operations.items()
        ]
    }


# --------------------------------------------------------------------------
# Background Tasks
# --------------------------------------------------------------------------

async def _execute_batch_deploy(
    batch_id: str,
    source_cert_id: int,
    target_device_ids: List[int],
    replace_cert_ids: Optional[List[int]],
    username: str
):
    """
    Execute batch deployment in background.
    This is a placeholder - actual F5 deployment logic would go here.
    """
    from db.base import SessionLocal
    import asyncio
    
    db = SessionLocal()
    try:
        op = _batch_operations[batch_id]
        
        for i, device_id in enumerate(target_device_ids):
            try:
                # Simulate deployment delay
                await asyncio.sleep(1)
                
                # TODO: Actual F5 deployment logic
                # from services.f5 import deploy_certificate_to_device
                # result = await deploy_certificate_to_device(source_cert_id, device_id)
                
                # Update result
                op["results"][i].status = BatchDeployStatus.SUCCESS
                op["results"][i].message = "Deployed successfully"
                op["completed"] += 1
                
                logger.info(f"Batch {batch_id}: Deployed to device {device_id}")
                
            except Exception as e:
                op["results"][i].status = BatchDeployStatus.FAILED
                op["results"][i].message = str(e)
                op["failed"] += 1
                logger.error(f"Batch {batch_id}: Failed for device {device_id}: {e}")
        
        # Set final status
        if op["failed"] == 0:
            op["status"] = BatchDeployStatus.SUCCESS
        elif op["completed"] == 0:
            op["status"] = BatchDeployStatus.FAILED
        else:
            op["status"] = BatchDeployStatus.PARTIAL
            
    finally:
        db.close()
