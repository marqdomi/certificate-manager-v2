# backend/api/endpoints/cleanup.py
"""
Certificate Cleanup Endpoints - v2.5

Provides endpoints for analyzing and cleaning up expired certificates.
Includes dry-run mode, bulk operations, and rollback support.
"""

from fastapi import APIRouter, Depends, Query, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
import uuid
import json

from db.base import get_db
from db.models import (
    Certificate, Device, User, UserRole,
    OperationSnapshot, OperationType, SnapshotStatus,
    AuditAction, AuditResult
)
from schemas.certificate import (
    CleanupAnalysisResponse, CleanupCertificateItem, CleanupCategory, CleanupStrategy,
    AssistedDeletionRequest, AssistedDeletionResponse,
    BulkCleanupRequest, BulkCleanupResponse,
    DryRunResult, DryRunPreviewResponse,
    OperationSnapshotResponse, RollbackPreviewResponse,
    RollbackExecuteRequest, RollbackExecuteResponse, SnapshotStatusEnum
)
from services import f5_service_logic, encryption_service, auth_service
from services.rollback_service import RollbackService
from services.audit_service import AuditService
from core.rate_limiter import limiter, SENSITIVE_RATE_LIMIT
from core.logger import get_api_logger

logger = get_api_logger()

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# CLEANUP ANALYSIS ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/devices/{device_id}/cleanup-analysis", response_model=CleanupAnalysisResponse)
def get_cleanup_analysis(
    device_id: int,
    days_threshold: int = Query(default=30, ge=0, description="Only show certs expired more than this many days"),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user)
):
    """
    Analyze expired certificates on a device for cleanup.
    
    Returns certificates categorized as:
    - safe_to_delete: No SSL profiles, can delete immediately
    - blocked_by_profiles: Has SSL profiles, needs dissociation first
    
    Args:
        device_id: ID of the F5 device to analyze
        days_threshold: Only return certs expired more than this many days (default 30)
    """
    # Get device
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    
    if not device.encrypted_password:
        raise HTTPException(status_code=400, detail=f"Device {device.hostname} has no stored credentials")
    
    try:
        f5_password = encryption_service.decrypt_data(device.encrypted_password)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to decrypt credentials: {str(e)}")
    
    now = datetime.utcnow()
    
    try:
        # Get expired certificates from F5
        expired_certs = f5_service_logic.get_expired_certificates_from_f5(
            hostname=device.ip_address,
            username=device.username,
            password=f5_password,
            days_threshold=days_threshold
        )
    except Exception as e:
        logger.error(f"Failed to get expired certs from {device.hostname}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to query F5 device: {str(e)}")
    
    cleanup_items = []
    safe_count = 0
    blocked_count = 0
    
    for cert_info in expired_certs:
        cert_name = cert_info["name"]
        partition = cert_info.get("partition", "Common")
        
        # Check if cert has SSL profiles
        try:
            ssl_profiles = f5_service_logic.get_certificate_ssl_profiles_simple(
                hostname=device.ip_address,
                username=device.username,
                password=f5_password,
                cert_name=cert_name,
                partition=partition
            )
            profile_names = [p.get("full_path", p.get("name", "")) for p in ssl_profiles]
        except Exception as e:
            logger.warning(f"Could not get profiles for {cert_name}: {e}")
            ssl_profiles = []
            profile_names = []
        
        # Categorize
        if len(ssl_profiles) == 0:
            category = CleanupCategory.SAFE_TO_DELETE
            can_delete_safely = True
            safe_count += 1
        else:
            category = CleanupCategory.BLOCKED_BY_PROFILES
            can_delete_safely = False
            blocked_count += 1
        
        # Get cert ID from our database if it exists
        db_cert = db.query(Certificate).filter(
            Certificate.device_id == device_id,
            Certificate.name == cert_name
        ).first()
        
        cleanup_item = CleanupCertificateItem(
            id=db_cert.id if db_cert else 0,
            name=cert_name,
            common_name=cert_info.get("common_name"),
            partition=partition,
            expiration_date=datetime.fromisoformat(cert_info["expiration_date"]) if cert_info.get("expiration_date") else None,
            days_expired=cert_info.get("days_expired", 0),
            category=category,
            ssl_profiles=profile_names,
            ssl_profiles_count=len(profile_names),
            can_delete_safely=can_delete_safely
        )
        cleanup_items.append(cleanup_item)
    
    # Sort: safe to delete first, then by days_expired descending
    cleanup_items.sort(key=lambda x: (0 if x.can_delete_safely else 1, -x.days_expired))
    
    return CleanupAnalysisResponse(
        device_id=device_id,
        device_hostname=device.hostname,
        analysis_timestamp=now,
        days_threshold=days_threshold,
        total_certificates=len(expired_certs),
        total_expired=len(expired_certs),
        safe_to_delete=safe_count,
        blocked_by_profiles=blocked_count,
        certificates=cleanup_items,
        message=f"Found {len(expired_certs)} expired certificates: {safe_count} safe to delete, {blocked_count} blocked by SSL profiles"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# ASSISTED DELETION ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.delete("/{cert_id}/assisted", response_model=AssistedDeletionResponse)
@limiter.limit(SENSITIVE_RATE_LIMIT)
def assisted_delete_certificate(
    request: Request,
    request_obj: AssistedDeletionRequest,
    cert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user)
):
    """
    Delete a certificate with assisted strategies.
    
    Strategies:
    - force: Delete only if no SSL profiles (safe)
    - dissociate: Remove from SSL profiles first, then delete
    - dry_run: Preview only, no changes made
    
    Creates a snapshot before deletion for potential rollback.
    """
    # Require operator or admin role
    if current_user.role not in [UserRole.ADMIN, UserRole.OPERATOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Get certificate from database
    certificate = db.query(Certificate).filter(Certificate.id == cert_id).first()
    if not certificate:
        raise HTTPException(status_code=404, detail=f"Certificate {cert_id} not found in database")
    
    # Get device
    device = db.query(Device).filter(Device.id == certificate.device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail=f"Device not found for certificate")
    
    if not device.encrypted_password:
        raise HTTPException(status_code=400, detail=f"Device {device.hostname} has no stored credentials")
    
    try:
        f5_password = encryption_service.decrypt_data(device.encrypted_password)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to decrypt credentials: {str(e)}")
    
    rollback_svc = RollbackService(db)
    audit_svc = AuditService(db)
    
    # Get current SSL profiles
    try:
        ssl_profiles = f5_service_logic.get_certificate_ssl_profiles_simple(
            hostname=device.ip_address,
            username=device.username,
            password=f5_password,
            cert_name=certificate.name,
            partition=certificate.partition or "Common"
        )
    except Exception as e:
        ssl_profiles = []
        logger.warning(f"Could not get profiles for {certificate.name}: {e}")
    
    profile_names = [p.get("full_path", p.get("name", "")) for p in ssl_profiles]
    
    # Handle DRY_RUN
    if request_obj.strategy == CleanupStrategy.DRY_RUN or request_obj.dry_run:
        return AssistedDeletionResponse(
            success=True,
            cert_id=cert_id,
            cert_name=certificate.name,
            strategy_used="dry_run",
            dry_run=True,
            would_dissociate_profiles=profile_names,
            would_delete_certificate=True,
            message=f"DRY RUN: Would dissociate from {len(profile_names)} profile(s) and delete certificate"
        )
    
    # Handle FORCE strategy
    if request_obj.strategy == CleanupStrategy.FORCE:
        if len(ssl_profiles) > 0:
            return AssistedDeletionResponse(
                success=False,
                cert_id=cert_id,
                cert_name=certificate.name,
                strategy_used="force",
                dry_run=False,
                message=f"Cannot force delete: certificate is used by {len(ssl_profiles)} SSL profile(s)",
                errors=[f"Blocked by profiles: {', '.join(profile_names)}"]
            )
        
        # Safe to delete - create snapshot first
        snapshot = None
        if request_obj.create_snapshot:
            try:
                snapshot = rollback_svc.create_snapshot_for_deletion(
                    device=device,
                    cert_name=certificate.name,
                    partition=certificate.partition or "Common",
                    created_by=current_user.username
                )
            except Exception as e:
                logger.warning(f"Could not create snapshot: {e}")
        
        # Delete from F5
        try:
            f5_service_logic.delete_certificate_from_f5(
                hostname=device.ip_address,
                username=device.username,
                password=f5_password,
                cert_name=certificate.name,
                partition=certificate.partition or "Common"
            )
            
            # Mark snapshot as applied
            if snapshot:
                rollback_svc.mark_snapshot_applied(snapshot.id)
            
            # Delete from database
            db.delete(certificate)
            db.commit()
            
            # Audit log
            audit_svc._create_entry(
                action=AuditAction.CERT_DELETED,
                resource_type="certificate",
                resource_id=cert_id,
                resource_name=certificate.name,
                username=current_user.username,
                device_hostname=device.hostname,
                result=AuditResult.SUCCESS,
                description=f"Deleted expired certificate via cleanup (force strategy)"
            )
            
            return AssistedDeletionResponse(
                success=True,
                cert_id=cert_id,
                cert_name=certificate.name,
                strategy_used="force",
                dry_run=False,
                certificate_deleted=True,
                snapshot_id=snapshot.id if snapshot else None,
                message="Certificate deleted successfully"
            )
            
        except Exception as e:
            if snapshot:
                rollback_svc.mark_snapshot_failed(snapshot.id, str(e))
            
            audit_svc._create_entry(
                action=AuditAction.CERT_DELETED,
                resource_type="certificate",
                resource_id=cert_id,
                resource_name=certificate.name,
                username=current_user.username,
                device_hostname=device.hostname,
                result=AuditResult.FAILURE,
                description=f"Failed to delete certificate: {str(e)}"
            )
            
            raise HTTPException(status_code=500, detail=f"Failed to delete certificate: {str(e)}")
    
    # Handle DISSOCIATE strategy
    if request_obj.strategy == CleanupStrategy.DISSOCIATE:
        operation_id = str(uuid.uuid4())
        errors = []
        profiles_dissociated = 0
        
        # Create snapshot before any modifications
        snapshot = None
        if request_obj.create_snapshot and len(ssl_profiles) > 0:
            try:
                snapshot = rollback_svc.create_snapshot_for_dissociation(
                    device=device,
                    cert_name=certificate.name,
                    profile_names=profile_names,
                    partition=certificate.partition or "Common",
                    created_by=current_user.username,
                    operation_id=operation_id
                )
            except Exception as e:
                logger.warning(f"Could not create dissociation snapshot: {e}")
        
        # Dissociate from profiles
        if len(ssl_profiles) > 0:
            try:
                dissoc_result = f5_service_logic.batch_dissociate_profiles(
                    hostname=device.ip_address,
                    username=device.username,
                    password=f5_password,
                    profiles=[{"name": p.get("name"), "type": p.get("context", "clientssl")} for p in ssl_profiles],
                    partition=certificate.partition or "Common"
                )
                profiles_dissociated = dissoc_result.get("successful", 0)
                errors.extend(dissoc_result.get("errors", []))
            except Exception as e:
                errors.append(f"Dissociation failed: {str(e)}")
        
        # Create snapshot for deletion
        deletion_snapshot = None
        if request_obj.create_snapshot:
            try:
                deletion_snapshot = rollback_svc.create_snapshot_for_deletion(
                    device=device,
                    cert_name=certificate.name,
                    partition=certificate.partition or "Common",
                    created_by=current_user.username,
                    operation_id=operation_id
                )
            except Exception as e:
                logger.warning(f"Could not create deletion snapshot: {e}")
        
        # Delete from F5
        try:
            f5_service_logic.delete_certificate_from_f5(
                hostname=device.ip_address,
                username=device.username,
                password=f5_password,
                cert_name=certificate.name,
                partition=certificate.partition or "Common"
            )
            
            if deletion_snapshot:
                rollback_svc.mark_snapshot_applied(deletion_snapshot.id)
            if snapshot:
                rollback_svc.mark_snapshot_applied(snapshot.id)
            
            # Delete from database
            db.delete(certificate)
            db.commit()
            
            # Audit log
            audit_svc._create_entry(
                action=AuditAction.CERT_DELETED,
                resource_type="certificate",
                resource_id=cert_id,
                resource_name=certificate.name,
                username=current_user.username,
                device_hostname=device.hostname,
                result=AuditResult.SUCCESS,
                description=f"Deleted expired certificate via cleanup (dissociate strategy, {profiles_dissociated} profiles updated)",
                details={"profiles_dissociated": profiles_dissociated, "operation_id": operation_id}
            )
            
            return AssistedDeletionResponse(
                success=True,
                cert_id=cert_id,
                cert_name=certificate.name,
                strategy_used="dissociate",
                dry_run=False,
                profiles_dissociated=profiles_dissociated,
                certificate_deleted=True,
                snapshot_id=deletion_snapshot.id if deletion_snapshot else (snapshot.id if snapshot else None),
                message=f"Certificate deleted successfully after dissociating from {profiles_dissociated} profile(s)",
                errors=errors if errors else []
            )
            
        except Exception as e:
            if deletion_snapshot:
                rollback_svc.mark_snapshot_failed(deletion_snapshot.id, str(e))
            
            audit_svc._create_entry(
                action=AuditAction.CERT_DELETED,
                resource_type="certificate",
                resource_id=cert_id,
                resource_name=certificate.name,
                username=current_user.username,
                device_hostname=device.hostname,
                result=AuditResult.FAILURE,
                description=f"Failed to delete certificate after dissociation: {str(e)}"
            )
            
            raise HTTPException(
                status_code=500, 
                detail=f"Dissociated {profiles_dissociated} profiles but failed to delete certificate: {str(e)}"
            )
    
    raise HTTPException(status_code=400, detail=f"Invalid strategy: {request_obj.strategy}")


# ═══════════════════════════════════════════════════════════════════════════════
# BULK CLEANUP ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/bulk-cleanup", response_model=BulkCleanupResponse)
@limiter.limit(SENSITIVE_RATE_LIMIT)
def bulk_cleanup_certificates(
    request: Request,
    request_obj: BulkCleanupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user)
):
    """
    Perform bulk cleanup of multiple certificates.
    
    Creates individual snapshots for each certificate to enable selective rollback.
    """
    # Require admin role for bulk operations
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin role required for bulk operations")
    
    operation_id = str(uuid.uuid4())
    results = []
    successful = 0
    failed = 0
    skipped = 0
    
    for cert_id in request_obj.cert_ids:
        try:
            # Create individual request
            individual_request = AssistedDeletionRequest(
                cert_id=cert_id,
                strategy=request_obj.strategy,
                dry_run=request_obj.dry_run,
                create_snapshot=request_obj.create_snapshots
            )
            
            # Process each certificate
            certificate = db.query(Certificate).filter(Certificate.id == cert_id).first()
            if not certificate:
                results.append(AssistedDeletionResponse(
                    success=False,
                    cert_id=cert_id,
                    cert_name="unknown",
                    strategy_used=request_obj.strategy.value,
                    dry_run=request_obj.dry_run,
                    message=f"Certificate {cert_id} not found",
                    errors=["Certificate not found in database"]
                ))
                skipped += 1
                continue
            
            # Call the individual deletion endpoint logic
            result = assisted_delete_certificate(
                request_obj=individual_request,
                cert_id=cert_id,
                db=db,
                current_user=current_user
            )
            
            results.append(result)
            if result.success:
                successful += 1
            else:
                failed += 1
                
        except HTTPException as e:
            results.append(AssistedDeletionResponse(
                success=False,
                cert_id=cert_id,
                cert_name=certificate.name if certificate else "unknown",
                strategy_used=request_obj.strategy.value,
                dry_run=request_obj.dry_run,
                message=str(e.detail),
                errors=[str(e.detail)]
            ))
            failed += 1
        except Exception as e:
            results.append(AssistedDeletionResponse(
                success=False,
                cert_id=cert_id,
                cert_name=certificate.name if 'certificate' in locals() and certificate else "unknown",
                strategy_used=request_obj.strategy.value,
                dry_run=request_obj.dry_run,
                message=f"Unexpected error: {str(e)}",
                errors=[str(e)]
            ))
            failed += 1
    
    return BulkCleanupResponse(
        success=failed == 0,
        operation_id=operation_id,
        dry_run=request_obj.dry_run,
        total_requested=len(request_obj.cert_ids),
        successful=successful,
        failed=failed,
        skipped=skipped,
        results=results,
        message=f"Bulk cleanup {'preview' if request_obj.dry_run else 'completed'}: {successful} successful, {failed} failed, {skipped} skipped"
    )


@router.post("/bulk-cleanup/preview", response_model=DryRunPreviewResponse)
def bulk_cleanup_preview(
    request_obj: BulkCleanupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user)
):
    """
    Preview what a bulk cleanup operation would do.
    """
    results = []
    total_profiles_affected = 0
    can_proceed = 0
    blocked = 0
    
    for cert_id in request_obj.cert_ids:
        certificate = db.query(Certificate).filter(Certificate.id == cert_id).first()
        if not certificate:
            results.append(DryRunResult(
                cert_id=cert_id,
                cert_name="unknown",
                can_proceed=False,
                action="skip",
                blockers=["Certificate not found"]
            ))
            blocked += 1
            continue
        
        device = db.query(Device).filter(Device.id == certificate.device_id).first()
        if not device or not device.encrypted_password:
            results.append(DryRunResult(
                cert_id=cert_id,
                cert_name=certificate.name,
                can_proceed=False,
                action="skip",
                blockers=["Device not found or has no credentials"]
            ))
            blocked += 1
            continue
        
        try:
            f5_password = encryption_service.decrypt_data(device.encrypted_password)
            ssl_profiles = f5_service_logic.get_certificate_ssl_profiles_simple(
                hostname=device.ip_address,
                username=device.username,
                password=f5_password,
                cert_name=certificate.name,
                partition=certificate.partition or "Common"
            )
            profile_names = [p.get("full_path", p.get("name", "")) for p in ssl_profiles]
        except Exception as e:
            results.append(DryRunResult(
                cert_id=cert_id,
                cert_name=certificate.name,
                can_proceed=False,
                action="skip",
                blockers=[f"Failed to check profiles: {str(e)}"]
            ))
            blocked += 1
            continue
        
        # Determine action based on strategy
        if request_obj.strategy == CleanupStrategy.FORCE:
            if len(profile_names) > 0:
                results.append(DryRunResult(
                    cert_id=cert_id,
                    cert_name=certificate.name,
                    can_proceed=False,
                    action="skip",
                    profiles_to_dissociate=[],
                    blockers=[f"Used by {len(profile_names)} SSL profile(s)"]
                ))
                blocked += 1
            else:
                results.append(DryRunResult(
                    cert_id=cert_id,
                    cert_name=certificate.name,
                    can_proceed=True,
                    action="delete",
                    profiles_to_dissociate=[]
                ))
                can_proceed += 1
        else:  # DISSOCIATE
            results.append(DryRunResult(
                cert_id=cert_id,
                cert_name=certificate.name,
                can_proceed=True,
                action="dissociate_and_delete" if len(profile_names) > 0 else "delete",
                profiles_to_dissociate=profile_names,
                warnings=[f"Will dissociate from {len(profile_names)} profile(s)"] if profile_names else []
            ))
            can_proceed += 1
            total_profiles_affected += len(profile_names)
    
    # Estimate duration (roughly 3 seconds per cert + 2 seconds per profile)
    estimated_duration = len(request_obj.cert_ids) * 3 + total_profiles_affected * 2
    
    return DryRunPreviewResponse(
        operation_type=request_obj.strategy.value,
        total_certificates=len(request_obj.cert_ids),
        can_proceed=can_proceed,
        blocked=blocked,
        results=results,
        total_profiles_affected=total_profiles_affected,
        estimated_duration_seconds=estimated_duration
    )


# ═══════════════════════════════════════════════════════════════════════════════
# ROLLBACK ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/snapshots", response_model=List[OperationSnapshotResponse])
def list_snapshots(
    device_id: Optional[int] = Query(default=None, description="Filter by device ID"),
    include_expired: bool = Query(default=False, description="Include expired snapshots"),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user)
):
    """List operation snapshots for rollback."""
    query = db.query(OperationSnapshot)
    
    if device_id:
        query = query.filter(OperationSnapshot.device_id == device_id)
    
    if not include_expired:
        query = query.filter(OperationSnapshot.status != SnapshotStatus.EXPIRED)
    
    snapshots = query.order_by(OperationSnapshot.created_at.desc()).limit(100).all()
    
    result = []
    for snapshot in snapshots:
        affected = json.loads(snapshot.affected_profiles) if snapshot.affected_profiles else []
        result.append(OperationSnapshotResponse(
            id=snapshot.id,
            operation_type=snapshot.operation_type.value,
            operation_id=snapshot.operation_id,
            status=SnapshotStatusEnum(snapshot.status.value),
            device_id=snapshot.device_id,
            device_hostname=snapshot.device_hostname,
            cert_name=snapshot.cert_name,
            partition=snapshot.partition,
            affected_profiles=affected,
            created_by=snapshot.created_by,
            created_at=snapshot.created_at,
            expires_at=snapshot.expires_at,
            executed_at=snapshot.executed_at,
            rolled_back_at=snapshot.rolled_back_at,
            can_rollback=snapshot.status in [SnapshotStatus.APPLIED, SnapshotStatus.FAILED]
        ))
    
    return result


@router.get("/snapshots/{snapshot_id}/preview", response_model=RollbackPreviewResponse)
def get_rollback_preview(
    snapshot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user)
):
    """Get preview of what a rollback would do."""
    rollback_svc = RollbackService(db)
    
    try:
        preview = rollback_svc.get_rollback_preview(snapshot_id)
        return RollbackPreviewResponse(**preview)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get preview: {str(e)}")


@router.post("/snapshots/{snapshot_id}/rollback", response_model=RollbackExecuteResponse)
@limiter.limit(SENSITIVE_RATE_LIMIT)
def execute_rollback(
    request: Request,
    snapshot_id: int,
    request_obj: RollbackExecuteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user)
):
    """Execute a rollback from a snapshot."""
    # Require admin role
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin role required for rollback operations")
    
    if not request_obj.confirm:
        raise HTTPException(status_code=400, detail="Must set confirm=true to proceed with rollback")
    
    rollback_svc = RollbackService(db)
    
    try:
        result = rollback_svc.rollback_operation(
            snapshot_id=snapshot_id,
            username=current_user.username
        )
        
        snapshot = db.query(OperationSnapshot).filter(OperationSnapshot.id == snapshot_id).first()
        
        return RollbackExecuteResponse(
            success=result.get("success", False),
            snapshot_id=snapshot_id,
            operation_type=snapshot.operation_type.value if snapshot else "unknown",
            cert_restored=result.get("cert_restored", False),
            profiles_restored=result.get("profiles_restored", 0),
            message=result.get("message", "Rollback completed"),
            errors=result.get("errors", [])
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rollback failed: {str(e)}")
