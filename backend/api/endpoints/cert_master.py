# backend/api/endpoints/cert_master.py
"""
API endpoints for Certificate Master Table feature.
Multi-location certificate tracking for NOC team visibility.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import datetime, timedelta
import json

from db.base import get_db
from db.models import (
    CertificateMaster, 
    CertificateInstallation, 
    Certificate,
    Device,
    InstallationLocationType,
    InstallationStatus,
    User,
    AuditLog,
    AuditAction
)
from schemas.cert_master import (
    CertificateMasterCreate,
    CertificateMasterUpdate,
    CertificateMasterResponse,
    CertificateMasterWithInstallations,
    CertificateInstallationCreate,
    CertificateInstallationUpdate,
    CertificateInstallationResponse,
    InstallationStatusUpdate,
    CertMasterDashboardSummary,
    TeamSummary,
    LocationTypeSummary,
    BulkInstallationCreate,
    SyncFromF5Request
)
from services.auth_service import get_current_user, get_current_active_user
from core.logger import setup_logger

logger = setup_logger("cmt.cert_master")

router = APIRouter(prefix="/cert-master", tags=["Certificate Master"])


# -------------------------------------------------------------------
# HELPER FUNCTIONS
# -------------------------------------------------------------------

def calculate_days_until_expiration(expiration_date: Optional[datetime]) -> Optional[int]:
    """Calculate days until expiration."""
    if not expiration_date:
        return None
    delta = expiration_date - datetime.utcnow()
    return delta.days


def build_master_response(master: CertificateMaster, include_installations_preview: bool = True) -> dict:
    """Build response dict for a master certificate with computed fields."""
    pending = sum(1 for i in master.installations if i.status == InstallationStatus.PENDING)
    verified = sum(1 for i in master.installations if i.status == InstallationStatus.VERIFIED)
    
    response = {
        **{c.name: getattr(master, c.name) for c in master.__table__.columns},
        "days_until_expiration": calculate_days_until_expiration(master.current_expiration),
        "total_installations": len(master.installations),
        "pending_installations": pending,
        "verified_installations": verified
    }
    
    # Include a preview of installations (first 10 with basic info) for tooltips
    if include_installations_preview and master.installations:
        response["installations"] = [
            {
                "id": inst.id,
                "location_type": inst.location_type.value if inst.location_type else None,
                "location_name": inst.location_name,
                "status": inst.status.value if inst.status else None,
                "is_current": inst.is_current
            }
            for inst in master.installations[:10]
        ]
    else:
        response["installations"] = []
    
    return response


def build_installation_response(installation: CertificateInstallation) -> dict:
    """Build response dict for an installation with computed fields."""
    device_hostname = None
    if installation.device:
        device_hostname = installation.device.hostname
    
    return {
        **{c.name: getattr(installation, c.name) for c in installation.__table__.columns},
        "device_hostname": device_hostname,
        "days_until_expiration": calculate_days_until_expiration(installation.installed_expiration)
    }


def create_audit_log(
    db: Session,
    action: AuditAction,
    user: User,
    resource_type: str,
    resource_id: int,
    resource_name: str,
    description: str,
    result: str = "success"
):
    """Create an audit log entry."""
    try:
        audit = AuditLog(
            action=action,
            user_id=user.id if user else None,
            username=user.username if user else "system",
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            description=description,
            result=result
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to create audit log: {e}")


# -------------------------------------------------------------------
# CERTIFICATE MASTER ENDPOINTS
# -------------------------------------------------------------------

@router.get("/", response_model=List[CertificateMasterResponse])
def list_certificate_masters(
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None, description="Search by CN, friendly name, or application"),
    owner_team: Optional[str] = Query(None),
    environment: Optional[str] = Query(None),
    criticality: Optional[str] = Query(None),
    expiring_in_days: Optional[int] = Query(None, description="Filter certs expiring within N days"),
    has_pending: Optional[bool] = Query(None, description="Filter certs with pending installations"),
    is_active: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_active_user)
):
    """List all master certificates with optional filters."""
    query = db.query(CertificateMaster).options(
        joinedload(CertificateMaster.installations)
    ).filter(CertificateMaster.is_active == is_active)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                CertificateMaster.common_name.ilike(search_term),
                CertificateMaster.friendly_name.ilike(search_term),
                CertificateMaster.application.ilike(search_term),
                CertificateMaster.description.ilike(search_term)
            )
        )
    
    if owner_team:
        query = query.filter(CertificateMaster.owner_team == owner_team)
    
    if environment:
        query = query.filter(CertificateMaster.environment == environment)
    
    if criticality:
        query = query.filter(CertificateMaster.criticality == criticality)
    
    if expiring_in_days is not None:
        cutoff = datetime.utcnow() + timedelta(days=expiring_in_days)
        query = query.filter(CertificateMaster.current_expiration <= cutoff)
    
    masters = query.order_by(CertificateMaster.current_expiration.asc().nullslast()).offset(skip).limit(limit).all()
    
    results = []
    for master in masters:
        data = build_master_response(master)
        if has_pending is not None:
            if has_pending and data["pending_installations"] == 0:
                continue
            if not has_pending and data["pending_installations"] > 0:
                continue
        results.append(data)
    
    return results


@router.get("/dashboard", response_model=CertMasterDashboardSummary)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get dashboard summary statistics."""
    now = datetime.utcnow()
    
    # Certificate stats
    total_certs = db.query(CertificateMaster).count()
    active_certs = db.query(CertificateMaster).filter(CertificateMaster.is_active == True).count()
    
    expired = db.query(CertificateMaster).filter(
        CertificateMaster.is_active == True,
        CertificateMaster.current_expiration < now
    ).count()
    
    expiring_7 = db.query(CertificateMaster).filter(
        CertificateMaster.is_active == True,
        CertificateMaster.current_expiration >= now,
        CertificateMaster.current_expiration <= now + timedelta(days=7)
    ).count()
    
    expiring_30 = db.query(CertificateMaster).filter(
        CertificateMaster.is_active == True,
        CertificateMaster.current_expiration >= now,
        CertificateMaster.current_expiration <= now + timedelta(days=30)
    ).count()
    
    # Installation stats
    total_inst = db.query(CertificateInstallation).count()
    
    status_counts = db.query(
        CertificateInstallation.status,
        func.count(CertificateInstallation.id)
    ).group_by(CertificateInstallation.status).all()
    
    status_dict = {s.value: c for s, c in status_counts}
    
    # By team
    team_stats = db.query(
        CertificateInstallation.responsible_team,
        CertificateInstallation.status,
        func.count(CertificateInstallation.id)
    ).group_by(
        CertificateInstallation.responsible_team,
        CertificateInstallation.status
    ).all()
    
    teams_dict = {}
    for team, status, count in team_stats:
        if team not in teams_dict:
            teams_dict[team] = {"team": team, "total": 0, "pending": 0, "installed": 0, "verified": 0, "failed": 0}
        teams_dict[team]["total"] += count
        if status == InstallationStatus.PENDING:
            teams_dict[team]["pending"] += count
        elif status == InstallationStatus.INSTALLED:
            teams_dict[team]["installed"] += count
        elif status == InstallationStatus.VERIFIED:
            teams_dict[team]["verified"] += count
        elif status == InstallationStatus.FAILED:
            teams_dict[team]["failed"] += count
    
    # By location type
    location_stats = db.query(
        CertificateInstallation.location_type,
        CertificateInstallation.status,
        func.count(CertificateInstallation.id)
    ).group_by(
        CertificateInstallation.location_type,
        CertificateInstallation.status
    ).all()
    
    locations_dict = {}
    for loc_type, status, count in location_stats:
        loc_key = loc_type.value if hasattr(loc_type, 'value') else str(loc_type)
        if loc_key not in locations_dict:
            locations_dict[loc_key] = {"location_type": loc_key, "total": 0, "pending": 0, "verified": 0}
        locations_dict[loc_key]["total"] += count
        if status == InstallationStatus.PENDING:
            locations_dict[loc_key]["pending"] += count
        elif status == InstallationStatus.VERIFIED:
            locations_dict[loc_key]["verified"] += count
    
    # Installations needing update
    needing_update = db.query(CertificateInstallation).filter(
        CertificateInstallation.is_current == False,
        CertificateInstallation.status != InstallationStatus.NOT_APPLICABLE
    ).count()
    
    return CertMasterDashboardSummary(
        total_certificates=total_certs,
        active_certificates=active_certs,
        expiring_soon=expiring_30,
        expired=expired,
        total_installations=total_inst,
        pending_installations=status_dict.get("pending", 0),
        installed_installations=status_dict.get("installed", 0),
        verified_installations=status_dict.get("verified", 0),
        failed_installations=status_dict.get("failed", 0),
        by_team=list(teams_dict.values()),
        by_location_type=list(locations_dict.values()),
        certificates_expiring_7_days=expiring_7,
        certificates_expiring_30_days=expiring_30,
        installations_needing_update=needing_update
    )


@router.get("/teams", response_model=List[str])
def list_teams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get list of unique teams."""
    owner_teams = db.query(CertificateMaster.owner_team).filter(
        CertificateMaster.owner_team.isnot(None)
    ).distinct().all()
    
    responsible_teams = db.query(CertificateInstallation.responsible_team).distinct().all()
    
    teams = set()
    for (team,) in owner_teams:
        if team:
            teams.add(team)
    for (team,) in responsible_teams:
        if team:
            teams.add(team)
    
    return sorted(list(teams))


@router.get("/{master_id}", response_model=CertificateMasterWithInstallations)
def get_certificate_master(
    master_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a master certificate with all its installations."""
    master = db.query(CertificateMaster).options(
        joinedload(CertificateMaster.installations).joinedload(CertificateInstallation.device)
    ).filter(CertificateMaster.id == master_id).first()
    
    if not master:
        raise HTTPException(status_code=404, detail="Certificate master not found")
    
    data = build_master_response(master)
    data["installations"] = [build_installation_response(i) for i in master.installations]
    
    return data


@router.post("/", response_model=CertificateMasterResponse, status_code=status.HTTP_201_CREATED)
def create_certificate_master(
    data: CertificateMasterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new master certificate record."""
    # Check for duplicate CN
    existing = db.query(CertificateMaster).filter(
        CertificateMaster.common_name == data.common_name
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Certificate with CN '{data.common_name}' already exists"
        )
    
    master = CertificateMaster(
        **data.model_dump(),
        created_by=current_user.username
    )
    
    db.add(master)
    db.commit()
    db.refresh(master)
    
    create_audit_log(
        db, AuditAction.CERT_UPLOADED, current_user,
        "certificate_master", master.id, master.common_name,
        f"Created master certificate record for {master.common_name}"
    )
    
    return build_master_response(master)


@router.put("/{master_id}", response_model=CertificateMasterResponse)
def update_certificate_master(
    master_id: int,
    data: CertificateMasterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a master certificate record."""
    master = db.query(CertificateMaster).filter(CertificateMaster.id == master_id).first()
    
    if not master:
        raise HTTPException(status_code=404, detail="Certificate master not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(master, key, value)
    
    db.commit()
    db.refresh(master)
    
    create_audit_log(
        db, AuditAction.CERT_UPLOADED, current_user,
        "certificate_master", master.id, master.common_name,
        f"Updated master certificate record for {master.common_name}"
    )
    
    return build_master_response(master)


@router.delete("/{master_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_certificate_master(
    master_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a master certificate record (and all its installations)."""
    master = db.query(CertificateMaster).filter(CertificateMaster.id == master_id).first()
    
    if not master:
        raise HTTPException(status_code=404, detail="Certificate master not found")
    
    cn = master.common_name
    db.delete(master)
    db.commit()
    
    create_audit_log(
        db, AuditAction.CERT_DELETED, current_user,
        "certificate_master", master_id, cn,
        f"Deleted master certificate record for {cn}"
    )


# -------------------------------------------------------------------
# INSTALLATION ENDPOINTS
# -------------------------------------------------------------------

@router.get("/{master_id}/installations", response_model=List[CertificateInstallationResponse])
def list_installations(
    master_id: int,
    db: Session = Depends(get_db),
    status_filter: Optional[InstallationStatus] = Query(None, alias="status"),
    location_type: Optional[InstallationLocationType] = Query(None),
    responsible_team: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user)
):
    """List all installations for a master certificate."""
    query = db.query(CertificateInstallation).options(
        joinedload(CertificateInstallation.device)
    ).filter(CertificateInstallation.master_id == master_id)
    
    if status_filter:
        query = query.filter(CertificateInstallation.status == status_filter)
    if location_type:
        query = query.filter(CertificateInstallation.location_type == location_type)
    if responsible_team:
        query = query.filter(CertificateInstallation.responsible_team == responsible_team)
    
    installations = query.order_by(CertificateInstallation.location_type).all()
    
    return [build_installation_response(i) for i in installations]


@router.post("/{master_id}/installations", response_model=CertificateInstallationResponse, status_code=status.HTTP_201_CREATED)
def create_installation(
    master_id: int,
    data: CertificateInstallationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Add a new installation location for a master certificate."""
    master = db.query(CertificateMaster).filter(CertificateMaster.id == master_id).first()
    if not master:
        raise HTTPException(status_code=404, detail="Certificate master not found")
    
    # Check for duplicate
    existing = db.query(CertificateInstallation).filter(
        CertificateInstallation.master_id == master_id,
        CertificateInstallation.location_type == data.location_type,
        CertificateInstallation.location_name == data.location_name
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Installation at {data.location_type.value}:{data.location_name} already exists"
        )
    
    installation = CertificateInstallation(
        master_id=master_id,
        **data.model_dump()
    )
    
    db.add(installation)
    db.commit()
    db.refresh(installation)
    
    return build_installation_response(installation)


@router.put("/installations/{installation_id}", response_model=CertificateInstallationResponse)
def update_installation(
    installation_id: int,
    data: CertificateInstallationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update an installation record."""
    installation = db.query(CertificateInstallation).options(
        joinedload(CertificateInstallation.device)
    ).filter(CertificateInstallation.id == installation_id).first()
    
    if not installation:
        raise HTTPException(status_code=404, detail="Installation not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(installation, key, value)
    
    installation.updated_by = current_user.username
    installation.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(installation)
    
    return build_installation_response(installation)


@router.delete("/installations/{installation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_installation(
    installation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete an installation record."""
    installation = db.query(CertificateInstallation).filter(
        CertificateInstallation.id == installation_id
    ).first()
    
    if not installation:
        raise HTTPException(status_code=404, detail="Installation not found")
    
    db.delete(installation)
    db.commit()


@router.post("/installations/{installation_id}/mark-updated", response_model=CertificateInstallationResponse)
def mark_installation_updated(
    installation_id: int,
    data: InstallationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mark an installation as updated/installed by the responsible team."""
    installation = db.query(CertificateInstallation).options(
        joinedload(CertificateInstallation.device),
        joinedload(CertificateInstallation.master)
    ).filter(CertificateInstallation.id == installation_id).first()
    
    if not installation:
        raise HTTPException(status_code=404, detail="Installation not found")
    
    installation.status = data.status
    installation.updated_by = current_user.username
    installation.updated_at = datetime.utcnow()
    
    if data.installed_expiration:
        installation.installed_expiration = data.installed_expiration
        installation.installed_at = datetime.utcnow()
    
    if data.installed_serial:
        installation.installed_serial = data.installed_serial
    
    # Check if now current
    if installation.master and installation.installed_serial:
        installation.is_current = (installation.installed_serial == installation.master.current_serial)
    
    db.commit()
    db.refresh(installation)
    
    create_audit_log(
        db, AuditAction.CERT_DEPLOYED, current_user,
        "certificate_installation", installation.id, 
        f"{installation.master.common_name}@{installation.location_name}",
        f"Marked installation as {data.status.value} at {installation.location_name}"
    )
    
    return build_installation_response(installation)


@router.post("/installations/{installation_id}/verify", response_model=CertificateInstallationResponse)
def verify_installation(
    installation_id: int,
    verification_notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Verify that an installation is working correctly."""
    installation = db.query(CertificateInstallation).options(
        joinedload(CertificateInstallation.device),
        joinedload(CertificateInstallation.master)
    ).filter(CertificateInstallation.id == installation_id).first()
    
    if not installation:
        raise HTTPException(status_code=404, detail="Installation not found")
    
    installation.status = InstallationStatus.VERIFIED
    installation.verified_by = current_user.username
    installation.verified_at = datetime.utcnow()
    if verification_notes:
        installation.verification_notes = verification_notes
    
    db.commit()
    db.refresh(installation)
    
    create_audit_log(
        db, AuditAction.CERT_DEPLOYED, current_user,
        "certificate_installation", installation.id,
        f"{installation.master.common_name}@{installation.location_name}",
        f"Verified installation at {installation.location_name}"
    )
    
    return build_installation_response(installation)


# -------------------------------------------------------------------
# SYNC FROM F5 ENDPOINT
# -------------------------------------------------------------------

@router.post("/sync-from-f5", response_model=dict)
def sync_from_f5(
    request: SyncFromF5Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Sync master certificate table from F5 scan data.
    Creates/updates master records and F5 installation records.
    """
    # Get all certificates from F5 devices
    f5_certs = db.query(Certificate).options(
        joinedload(Certificate.device)
    ).all()
    
    created_masters = 0
    updated_masters = 0
    created_installations = 0
    
    # Group by common_name
    cn_map = {}
    for cert in f5_certs:
        cn = cert.common_name or cert.name
        if cn not in cn_map:
            cn_map[cn] = []
        cn_map[cn].append(cert)
    
    for cn, certs in cn_map.items():
        # Find or create master record
        master = db.query(CertificateMaster).filter(
            CertificateMaster.common_name == cn
        ).first()
        
        if not master and request.create_missing:
            # Get latest expiration from all certs with this CN
            latest_cert = max(certs, key=lambda c: c.expiration_date or datetime.min)
            
            master = CertificateMaster(
                common_name=cn,
                current_expiration=latest_cert.expiration_date,
                current_issuer=latest_cert.issuer,
                owner_team="Network",  # Default for F5-discovered certs
                created_by="system"
            )
            db.add(master)
            db.flush()
            created_masters += 1
        
        elif master and request.update_existing:
            # Update with latest cert info
            latest_cert = max(certs, key=lambda c: c.expiration_date or datetime.min)
            if master.auto_sync_f5:
                master.current_expiration = latest_cert.expiration_date
                master.current_issuer = latest_cert.issuer
                updated_masters += 1
        
        # Create F5 installation records
        if master and request.auto_create_installations:
            # Track which device hostnames we've already processed for this master
            # to avoid duplicate installations (same cert can appear in multiple partitions)
            processed_devices = set()
            
            for cert in certs:
                if not cert.device:
                    continue
                
                # Skip if we've already processed this device for this master
                device_key = (master.id, cert.device.hostname)
                if device_key in processed_devices:
                    continue
                processed_devices.add(device_key)
                
                existing_inst = db.query(CertificateInstallation).filter(
                    CertificateInstallation.master_id == master.id,
                    CertificateInstallation.location_type == InstallationLocationType.F5,
                    CertificateInstallation.location_name == cert.device.hostname
                ).first()
                
                if not existing_inst:
                    installation = CertificateInstallation(
                        master_id=master.id,
                        location_type=InstallationLocationType.F5,
                        location_name=cert.device.hostname,
                        location_identifier=cert.device.ip_address,
                        device_id=cert.device.id,
                        responsible_team="Network",
                        status=InstallationStatus.VERIFIED,
                        installed_expiration=cert.expiration_date,
                        is_current=True,
                        verified_by="system",
                        verified_at=datetime.utcnow()
                    )
                    db.add(installation)
                    created_installations += 1
                else:
                    # Update existing installation
                    existing_inst.installed_expiration = cert.expiration_date
                    existing_inst.is_current = (cert.expiration_date == master.current_expiration)
    
    db.commit()
    
    return {
        "message": "Sync completed",
        "created_masters": created_masters,
        "updated_masters": updated_masters,
        "created_installations": created_installations
    }
