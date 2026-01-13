# backend/api/endpoints/teams.py
"""
API endpoints for Teams and Location Types management.
Dynamic team and location type CRUD for Certificate Master.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime

from db.base import get_db
from db.models import (
    Team,
    LocationType,
    CertificateMasterTeam,
    CertificateInstallation,
    User
)
from schemas.cert_master import (
    TeamCreate,
    TeamUpdate,
    TeamResponse,
    TeamSummaryResponse,
    LocationTypeCreate,
    LocationTypeUpdate,
    LocationTypeResponse
)
from services.auth_service import get_current_active_user
from core.logger import setup_logger

logger = setup_logger("cmt.teams")

router = APIRouter(tags=["Teams & Location Types"])


# -------------------------------------------------------------------
# TEAM ENDPOINTS
# -------------------------------------------------------------------

@router.get("/teams", response_model=List[TeamResponse])
def list_teams(
    db: Session = Depends(get_db),
    is_active: Optional[bool] = Query(None),
    current_user: User = Depends(get_current_active_user)
):
    """List all teams with certificate and installation counts."""
    query = db.query(Team)
    
    if is_active is not None:
        query = query.filter(Team.is_active == is_active)
    
    teams = query.order_by(Team.name).all()
    
    results = []
    for team in teams:
        # Count certificates associated with this team
        cert_count = db.query(func.count(CertificateMasterTeam.id)).filter(
            CertificateMasterTeam.team_id == team.id
        ).scalar() or 0
        
        # Count installations where this team is responsible
        install_count = db.query(func.count(CertificateInstallation.id)).filter(
            CertificateInstallation.responsible_team_id == team.id
        ).scalar() or 0
        
        results.append({
            **{c.name: getattr(team, c.name) for c in team.__table__.columns},
            "certificate_count": cert_count,
            "installation_count": install_count
        })
    
    return results


@router.get("/teams/summary", response_model=List[TeamSummaryResponse])
def list_teams_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get minimal team list for dropdowns (active teams only)."""
    teams = db.query(Team).filter(Team.is_active == True).order_by(Team.name).all()
    return teams


@router.get("/teams/{team_id}", response_model=TeamResponse)
def get_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific team by ID."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    cert_count = db.query(func.count(CertificateMasterTeam.id)).filter(
        CertificateMasterTeam.team_id == team.id
    ).scalar() or 0
    
    install_count = db.query(func.count(CertificateInstallation.id)).filter(
        CertificateInstallation.responsible_team_id == team.id
    ).scalar() or 0
    
    return {
        **{c.name: getattr(team, c.name) for c in team.__table__.columns},
        "certificate_count": cert_count,
        "installation_count": install_count
    }


@router.post("/teams", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
def create_team(
    team_data: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new team."""
    # Check for duplicate name
    existing = db.query(Team).filter(Team.name == team_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Team '{team_data.name}' already exists")
    
    team = Team(**team_data.model_dump())
    db.add(team)
    db.commit()
    db.refresh(team)
    
    logger.info(f"Team created: {team.name} by {current_user.username}")
    
    return {
        **{c.name: getattr(team, c.name) for c in team.__table__.columns},
        "certificate_count": 0,
        "installation_count": 0
    }


@router.put("/teams/{team_id}", response_model=TeamResponse)
def update_team(
    team_id: int,
    team_data: TeamUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update an existing team."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Check for duplicate name if changing
    if team_data.name and team_data.name != team.name:
        existing = db.query(Team).filter(Team.name == team_data.name).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Team '{team_data.name}' already exists")
    
    update_data = team_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(team, key, value)
    
    team.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(team)
    
    logger.info(f"Team updated: {team.name} by {current_user.username}")
    
    cert_count = db.query(func.count(CertificateMasterTeam.id)).filter(
        CertificateMasterTeam.team_id == team.id
    ).scalar() or 0
    
    install_count = db.query(func.count(CertificateInstallation.id)).filter(
        CertificateInstallation.responsible_team_id == team.id
    ).scalar() or 0
    
    return {
        **{c.name: getattr(team, c.name) for c in team.__table__.columns},
        "certificate_count": cert_count,
        "installation_count": install_count
    }


@router.delete("/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a team (soft delete by setting is_active=False)."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Check if team has associations
    cert_count = db.query(func.count(CertificateMasterTeam.id)).filter(
        CertificateMasterTeam.team_id == team.id
    ).scalar() or 0
    
    install_count = db.query(func.count(CertificateInstallation.id)).filter(
        CertificateInstallation.responsible_team_id == team.id
    ).scalar() or 0
    
    if cert_count > 0 or install_count > 0:
        # Soft delete
        team.is_active = False
        team.updated_at = datetime.utcnow()
        db.commit()
        logger.info(f"Team soft-deleted: {team.name} by {current_user.username}")
    else:
        # Hard delete if no associations
        db.delete(team)
        db.commit()
        logger.info(f"Team deleted: {team.name} by {current_user.username}")
    
    return None


# -------------------------------------------------------------------
# LOCATION TYPE ENDPOINTS
# -------------------------------------------------------------------

@router.get("/location-types", response_model=List[LocationTypeResponse])
def list_location_types(
    db: Session = Depends(get_db),
    is_active: Optional[bool] = Query(None),
    category: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user)
):
    """List all location types with installation counts."""
    query = db.query(LocationType)
    
    if is_active is not None:
        query = query.filter(LocationType.is_active == is_active)
    
    if category:
        query = query.filter(LocationType.category == category)
    
    location_types = query.order_by(LocationType.category, LocationType.name).all()
    
    results = []
    for lt in location_types:
        install_count = db.query(func.count(CertificateInstallation.id)).filter(
            CertificateInstallation.location_type_id == lt.id
        ).scalar() or 0
        
        results.append({
            **{c.name: getattr(lt, c.name) for c in lt.__table__.columns},
            "installation_count": install_count
        })
    
    return results


@router.get("/location-types/{location_type_id}", response_model=LocationTypeResponse)
def get_location_type(
    location_type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific location type by ID."""
    lt = db.query(LocationType).filter(LocationType.id == location_type_id).first()
    if not lt:
        raise HTTPException(status_code=404, detail="Location type not found")
    
    install_count = db.query(func.count(CertificateInstallation.id)).filter(
        CertificateInstallation.location_type_id == lt.id
    ).scalar() or 0
    
    return {
        **{c.name: getattr(lt, c.name) for c in lt.__table__.columns},
        "installation_count": install_count
    }


@router.post("/location-types", response_model=LocationTypeResponse, status_code=status.HTTP_201_CREATED)
def create_location_type(
    lt_data: LocationTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new location type."""
    # Check for duplicate code
    existing = db.query(LocationType).filter(LocationType.code == lt_data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Location type with code '{lt_data.code}' already exists")
    
    lt = LocationType(**lt_data.model_dump())
    db.add(lt)
    db.commit()
    db.refresh(lt)
    
    logger.info(f"Location type created: {lt.code} by {current_user.username}")
    
    return {
        **{c.name: getattr(lt, c.name) for c in lt.__table__.columns},
        "installation_count": 0
    }


@router.put("/location-types/{location_type_id}", response_model=LocationTypeResponse)
def update_location_type(
    location_type_id: int,
    lt_data: LocationTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update an existing location type."""
    lt = db.query(LocationType).filter(LocationType.id == location_type_id).first()
    if not lt:
        raise HTTPException(status_code=404, detail="Location type not found")
    
    # Check for duplicate code if changing
    if lt_data.code and lt_data.code != lt.code:
        existing = db.query(LocationType).filter(LocationType.code == lt_data.code).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Location type with code '{lt_data.code}' already exists")
    
    update_data = lt_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(lt, key, value)
    
    lt.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(lt)
    
    logger.info(f"Location type updated: {lt.code} by {current_user.username}")
    
    install_count = db.query(func.count(CertificateInstallation.id)).filter(
        CertificateInstallation.location_type_id == lt.id
    ).scalar() or 0
    
    return {
        **{c.name: getattr(lt, c.name) for c in lt.__table__.columns},
        "installation_count": install_count
    }


@router.delete("/location-types/{location_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location_type(
    location_type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a location type (soft delete by setting is_active=False)."""
    lt = db.query(LocationType).filter(LocationType.id == location_type_id).first()
    if not lt:
        raise HTTPException(status_code=404, detail="Location type not found")
    
    install_count = db.query(func.count(CertificateInstallation.id)).filter(
        CertificateInstallation.location_type_id == lt.id
    ).scalar() or 0
    
    if install_count > 0:
        # Soft delete
        lt.is_active = False
        lt.updated_at = datetime.utcnow()
        db.commit()
        logger.info(f"Location type soft-deleted: {lt.code} by {current_user.username}")
    else:
        # Hard delete if no associations
        db.delete(lt)
        db.commit()
        logger.info(f"Location type deleted: {lt.code} by {current_user.username}")
    
    return None


@router.get("/location-types/categories/list", response_model=List[str])
def list_location_type_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get list of unique location type categories."""
    categories = db.query(LocationType.category).filter(
        LocationType.is_active == True,
        LocationType.category.isnot(None)
    ).distinct().all()
    
    return [c[0] for c in categories if c[0]]
