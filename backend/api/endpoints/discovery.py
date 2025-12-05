# backend/api/endpoints/discovery.py
"""
API endpoints for Network Discovery feature.

Allows users to scan network subnets for F5 devices and import them.
"""

import json
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from db.base import get_db
from db.models import (
    DiscoveryJob, 
    DiscoveryJobStatus,
    DiscoveredDevice, 
    DiscoveredDeviceStatus,
    User
)
from services.auth_service import get_current_active_user
from services.discovery_tasks import task_run_discovery_job, task_import_discovered_devices
from services.network_discovery import DISCOVERY_PRESETS, expand_subnets
from services.encryption_service import encrypt_data
from core.logger import get_f5_logger

logger = get_f5_logger()

router = APIRouter(prefix="/discovery", tags=["discovery"])


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Schemas
# ─────────────────────────────────────────────────────────────────────────────

class SubnetPreset(BaseModel):
    """Subnet preset information."""
    key: str
    label: str
    subnets: List[str]
    total_ips: int


class CredentialSet(BaseModel):
    """Credential set for discovery authentication."""
    username: str = Field(..., description="F5 username")
    password: str = Field(..., description="F5 password")
    name: Optional[str] = Field(None, description="Friendly name for this credential set (e.g., 'DC01 Admin')")


class DiscoveryScanRequest(BaseModel):
    """Request to start a discovery scan."""
    preset: Optional[str] = Field(None, description="Preset key (e.g., 'usdc01')")
    subnets: Optional[List[str]] = Field(None, description="Custom subnet list (CIDR or ranges)")
    name: Optional[str] = Field(None, description="Job name for identification")
    credentials: List[CredentialSet] = Field(..., description="Credential sets to try during discovery")
    save_credentials: bool = Field(False, description="Save credentials for imported devices")


class DiscoveryJobResponse(BaseModel):
    """Response with discovery job details."""
    id: int
    name: str
    status: str
    subnets: List[str]
    total_ips: int
    scanned_ips: int
    found_devices: int
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]
    
    class Config:
        from_attributes = True


class DiscoveredDeviceResponse(BaseModel):
    """Response with discovered device details."""
    id: int
    ip_address: str
    hostname: Optional[str]
    version: Optional[str]
    platform: Optional[str]
    serial_number: Optional[str]
    ha_state: Optional[str]
    status: str
    probe_success: bool
    probe_message: Optional[str]
    credential_source: Optional[str]
    suggested_site: Optional[str]
    suggested_cluster_key: Optional[str]
    imported_device_id: Optional[int]
    
    class Config:
        from_attributes = True


class ImportDevicesRequest(BaseModel):
    """Request to import discovered devices."""
    device_ids: Optional[List[int]] = Field(None, description="Specific device IDs to import (None = all pending)")
    auto_cluster: bool = Field(True, description="Auto-assign clusters after import")


class ImportDevicesResponse(BaseModel):
    """Response from import operation."""
    success: bool
    imported: int
    skipped: int
    message: str


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/presets", response_model=List[SubnetPreset])
async def get_discovery_presets(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get list of available subnet presets for quick discovery.
    
    Returns predefined subnet groups for known datacenters.
    """
    presets = []
    for key, data in DISCOVERY_PRESETS.items():
        subnets = data["subnets"]
        total_ips = len(expand_subnets(subnets))
        presets.append(SubnetPreset(
            key=key,
            label=data["name"],
            subnets=subnets,
            total_ips=total_ips
        ))
    
    return presets


@router.post("/scan", response_model=DiscoveryJobResponse)
async def start_discovery_scan(
    request: DiscoveryScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Start a new network discovery scan.
    
    Provide either:
    - A preset key (e.g., 'usdc01' for US Datacenter 1)
    - A list of custom subnets (CIDR notation or IP ranges)
    
    The scan runs asynchronously in the background.
    Subscribe to WebSocket for real-time progress updates.
    """
    # Validate input
    if not request.preset and not request.subnets:
        raise HTTPException(
            status_code=400,
            detail="Must provide either 'preset' or 'subnets'"
        )
    
    # Get subnets from preset or custom
    if request.preset:
        if request.preset not in DISCOVERY_PRESETS:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown preset '{request.preset}'. Available: {list(DISCOVERY_PRESETS.keys())}"
            )
        preset_data = DISCOVERY_PRESETS[request.preset]
        subnets = preset_data["subnets"]
        job_name = request.name or f"Discovery - {preset_data['name']}"
    else:
        subnets = request.subnets
        job_name = request.name or f"Custom Discovery - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
    
    # Calculate total IPs
    try:
        all_ips = expand_subnets(subnets)
        total_ips = len(all_ips)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid subnet format: {e}"
        )
    
    if total_ips == 0:
        raise HTTPException(
            status_code=400,
            detail="No valid IP addresses in the provided subnets"
        )
    
    # Limit scan size to prevent abuse
    MAX_IPS = 10000
    if total_ips > MAX_IPS:
        raise HTTPException(
            status_code=400,
            detail=f"Scan too large ({total_ips} IPs). Maximum allowed is {MAX_IPS} IPs per scan."
        )
    
    # Validate credentials provided
    if not request.credentials or len(request.credentials) == 0:
        raise HTTPException(
            status_code=400,
            detail="At least one credential set is required for discovery"
        )
    
    # Create job record
    job = DiscoveryJob(
        name=job_name,
        subnets=json.dumps(subnets),
        status=DiscoveryJobStatus.PENDING,
        total_ips=total_ips,
        created_by=current_user.username
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    logger.info(f"Created discovery job {job.id}: {job_name} ({total_ips} IPs) by {current_user.username}")
    
    # Prepare credentials for task (encrypt passwords)
    credentials_for_task = []
    for cred in request.credentials:
        credentials_for_task.append({
            "username": cred.username,
            "password_encrypted": encrypt_data(cred.password),
            "name": cred.name or cred.username
        })
    
    # Queue the task with credentials
    task_run_discovery_job.delay(
        job.id, 
        credentials_for_task,
        request.save_credentials
    )
    
    return DiscoveryJobResponse(
        id=job.id,
        name=job.name,
        status=job.status.value,
        subnets=subnets,
        total_ips=job.total_ips,
        scanned_ips=job.scanned_ips,
        found_devices=job.found_devices,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        error_message=job.error_message
    )


@router.get("/jobs", response_model=List[DiscoveryJobResponse])
async def list_discovery_jobs(
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List discovery jobs with optional status filter.
    """
    query = db.query(DiscoveryJob).order_by(DiscoveryJob.created_at.desc())
    
    if status:
        try:
            status_enum = DiscoveryJobStatus(status)
            query = query.filter(DiscoveryJob.status == status_enum)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Valid values: {[s.value for s in DiscoveryJobStatus]}"
            )
    
    jobs = query.limit(limit).all()
    
    return [
        DiscoveryJobResponse(
            id=job.id,
            name=job.name,
            status=job.status.value,
            subnets=json.loads(job.subnets),
            total_ips=job.total_ips,
            scanned_ips=job.scanned_ips,
            found_devices=job.found_devices,
            created_at=job.created_at,
            started_at=job.started_at,
            completed_at=job.completed_at,
            error_message=job.error_message
        )
        for job in jobs
    ]


@router.get("/jobs/{job_id}", response_model=DiscoveryJobResponse)
async def get_discovery_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get details of a specific discovery job.
    """
    job = db.query(DiscoveryJob).filter(DiscoveryJob.id == job_id).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Discovery job not found")
    
    return DiscoveryJobResponse(
        id=job.id,
        name=job.name,
        status=job.status.value,
        subnets=json.loads(job.subnets),
        total_ips=job.total_ips,
        scanned_ips=job.scanned_ips,
        found_devices=job.found_devices,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        error_message=job.error_message
    )


@router.get("/jobs/{job_id}/devices", response_model=List[DiscoveredDeviceResponse])
async def get_discovered_devices(
    job_id: int,
    status: Optional[str] = Query(None, description="Filter by status"),
    only_f5: bool = Query(True, description="Only show confirmed F5 devices"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get discovered devices for a specific job.
    """
    # Verify job exists
    job = db.query(DiscoveryJob).filter(DiscoveryJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Discovery job not found")
    
    query = db.query(DiscoveredDevice).filter(DiscoveredDevice.job_id == job_id)
    
    if status:
        try:
            status_enum = DiscoveredDeviceStatus(status)
            query = query.filter(DiscoveredDevice.status == status_enum)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Valid values: {[s.value for s in DiscoveredDeviceStatus]}"
            )
    
    if only_f5:
        query = query.filter(DiscoveredDevice.probe_success == True)
    
    devices = query.all()
    
    return [
        DiscoveredDeviceResponse(
            id=d.id,
            ip_address=d.ip_address,
            hostname=d.hostname,
            version=d.version,
            platform=d.platform,
            serial_number=d.serial_number,
            ha_state=d.ha_state,
            status=d.status.value,
            probe_success=d.probe_success,
            probe_message=d.probe_message,
            credential_source=d.credential_source,
            suggested_site=d.suggested_site,
            suggested_cluster_key=d.suggested_cluster_key,
            imported_device_id=d.imported_device_id
        )
        for d in devices
    ]


@router.post("/jobs/{job_id}/import", response_model=ImportDevicesResponse)
async def import_discovered_devices(
    job_id: int,
    request: ImportDevicesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Import discovered devices into the main inventory.
    
    By default imports all pending, probe-successful devices.
    Optionally specify specific device IDs to import.
    """
    # Verify job exists and is completed
    job = db.query(DiscoveryJob).filter(DiscoveryJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Discovery job not found")
    
    if job.status != DiscoveryJobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot import from job with status '{job.status.value}'. Job must be completed."
        )
    
    # Check user permission (only admin and operator can import)
    if current_user.role not in ["admin", "operator"]:
        raise HTTPException(
            status_code=403,
            detail="Only admin and operator users can import devices"
        )
    
    # Count available devices
    pending_count = db.query(DiscoveredDevice).filter(
        DiscoveredDevice.job_id == job_id,
        DiscoveredDevice.status == DiscoveredDeviceStatus.PENDING,
        DiscoveredDevice.probe_success == True
    ).count()
    
    if pending_count == 0:
        return ImportDevicesResponse(
            success=True,
            imported=0,
            skipped=0,
            message="No pending devices to import"
        )
    
    logger.info(f"Starting import for job {job_id}: {pending_count} devices available, user {current_user.username}")
    
    # Run import (synchronously for now, can be async for large imports)
    result = task_import_discovered_devices(job_id, request.device_ids, request.auto_cluster)
    
    if result["success"]:
        return ImportDevicesResponse(
            success=True,
            imported=result["imported"],
            skipped=result["skipped"],
            message=f"Successfully imported {result['imported']} devices"
        )
    else:
        raise HTTPException(
            status_code=500,
            detail=f"Import failed: {result.get('error', 'Unknown error')}"
        )


@router.delete("/jobs/{job_id}")
async def delete_discovery_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a discovery job and its discovered devices.
    """
    job = db.query(DiscoveryJob).filter(DiscoveryJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Discovery job not found")
    
    # Don't delete running jobs
    if job.status == DiscoveryJobStatus.RUNNING:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a running job. Wait for completion or cancel first."
        )
    
    # Check permission
    if current_user.role not in ["admin"]:
        raise HTTPException(
            status_code=403,
            detail="Only admin users can delete discovery jobs"
        )
    
    # Delete discovered devices first
    db.query(DiscoveredDevice).filter(DiscoveredDevice.job_id == job_id).delete()
    db.delete(job)
    db.commit()
    
    logger.info(f"Deleted discovery job {job_id} by {current_user.username}")
    
    return {"success": True, "message": f"Discovery job {job_id} deleted"}


@router.post("/jobs/{job_id}/cancel")
async def cancel_discovery_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Cancel a running discovery job.
    """
    job = db.query(DiscoveryJob).filter(DiscoveryJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Discovery job not found")
    
    if job.status != DiscoveryJobStatus.RUNNING:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel job with status '{job.status.value}'. Only running jobs can be cancelled."
        )
    
    # Mark as cancelled
    job.status = DiscoveryJobStatus.CANCELLED
    job.completed_at = datetime.utcnow()
    db.commit()
    
    logger.info(f"Cancelled discovery job {job_id} by {current_user.username}")
    
    return {"success": True, "message": f"Discovery job {job_id} cancelled"}
