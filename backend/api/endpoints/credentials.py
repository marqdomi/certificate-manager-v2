# backend/api/endpoints/credentials.py
"""
Credential Template Management API
Enterprise-level credential management for F5 devices.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime

from db.base import get_db
from db.models import Device, User, UserRole, CredentialTemplate
from services import encryption_service, auth_service
from schemas.credential import (
    CredentialTemplateCreate,
    CredentialTemplateUpdate,
    CredentialTemplateResponse,
    CredentialTemplateListResponse,
    ApplyTemplateRequest,
    ApplyTemplateResponse,
)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# CREDENTIAL TEMPLATES CRUD
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/templates", response_model=CredentialTemplateListResponse)
def list_credential_templates(
    db: Session = Depends(get_db),
    include_inactive: bool = False,
    environment: str = None,
    current_user: User = Depends(auth_service.get_current_active_user),
):
    """
    List all credential templates.
    Only admins and operators can view templates.
    """
    if current_user.role == UserRole.VIEWER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view credential templates"
        )
    
    query = db.query(CredentialTemplate)
    
    if not include_inactive:
        query = query.filter(CredentialTemplate.is_active == True)
    
    if environment:
        query = query.filter(CredentialTemplate.environment == environment)
    
    templates = query.order_by(
        CredentialTemplate.is_default.desc(),
        CredentialTemplate.name.asc()
    ).all()
    
    return CredentialTemplateListResponse(
        templates=templates,
        total=len(templates)
    )


@router.post("/templates", response_model=CredentialTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_credential_template(
    template_data: CredentialTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user),
):
    """
    Create a new credential template.
    Only admins can create templates.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create credential templates"
        )
    
    # Check for duplicate name
    existing = db.query(CredentialTemplate).filter(
        CredentialTemplate.name == template_data.name
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Template with name '{template_data.name}' already exists"
        )
    
    # If this is set as default, unset any existing default
    if template_data.is_default:
        db.query(CredentialTemplate).filter(
            CredentialTemplate.is_default == True
        ).update({"is_default": False})
    
    # Encrypt the password
    encrypted_password = encryption_service.encrypt_data(template_data.password)
    
    # Create template
    template = CredentialTemplate(
        name=template_data.name,
        description=template_data.description,
        username=template_data.username,
        encrypted_password=encrypted_password,
        environment=template_data.environment,
        site_pattern=template_data.site_pattern,
        is_default=template_data.is_default,
        created_by=current_user.username,
    )
    
    db.add(template)
    db.commit()
    db.refresh(template)
    
    return template


@router.get("/templates/{template_id}", response_model=CredentialTemplateResponse)
def get_credential_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user),
):
    """Get a specific credential template by ID."""
    if current_user.role == UserRole.VIEWER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view credential templates"
        )
    
    template = db.query(CredentialTemplate).filter(
        CredentialTemplate.id == template_id
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with ID {template_id} not found"
        )
    
    return template


@router.put("/templates/{template_id}", response_model=CredentialTemplateResponse)
def update_credential_template(
    template_id: int,
    template_data: CredentialTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user),
):
    """
    Update an existing credential template.
    Only admins can update templates.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update credential templates"
        )
    
    template = db.query(CredentialTemplate).filter(
        CredentialTemplate.id == template_id
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with ID {template_id} not found"
        )
    
    # Check for duplicate name if changing
    if template_data.name and template_data.name != template.name:
        existing = db.query(CredentialTemplate).filter(
            CredentialTemplate.name == template_data.name,
            CredentialTemplate.id != template_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Template with name '{template_data.name}' already exists"
            )
    
    # Handle default flag
    if template_data.is_default:
        db.query(CredentialTemplate).filter(
            CredentialTemplate.is_default == True,
            CredentialTemplate.id != template_id
        ).update({"is_default": False})
    
    # Update fields
    update_data = template_data.model_dump(exclude_unset=True)
    
    # Handle password encryption
    if "password" in update_data and update_data["password"]:
        template.encrypted_password = encryption_service.encrypt_data(update_data["password"])
        del update_data["password"]
    elif "password" in update_data:
        del update_data["password"]
    
    for field, value in update_data.items():
        setattr(template, field, value)
    
    db.commit()
    db.refresh(template)
    
    return template


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_credential_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user),
):
    """
    Delete a credential template.
    Only admins can delete templates.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete credential templates"
        )
    
    template = db.query(CredentialTemplate).filter(
        CredentialTemplate.id == template_id
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with ID {template_id} not found"
        )
    
    db.delete(template)
    db.commit()
    
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# APPLY TEMPLATES TO DEVICES
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/templates/apply", response_model=ApplyTemplateResponse)
def apply_template_to_devices(
    request: ApplyTemplateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user),
):
    """
    Apply a credential template to multiple devices.
    Only admins and operators can apply templates.
    """
    if current_user.role == UserRole.VIEWER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to apply credential templates"
        )
    
    # Get template
    template = db.query(CredentialTemplate).filter(
        CredentialTemplate.id == request.template_id,
        CredentialTemplate.is_active == True
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active template with ID {request.template_id} not found"
        )
    
    results = []
    success_count = 0
    failed_count = 0
    
    for device_id in request.device_ids:
        try:
            device = db.query(Device).filter(Device.id == device_id).first()
            
            if not device:
                results.append({
                    "device_id": device_id,
                    "success": False,
                    "error": "Device not found"
                })
                failed_count += 1
                continue
            
            # Apply credentials from template
            device.username = template.username
            device.encrypted_password = template.encrypted_password
            
            results.append({
                "device_id": device_id,
                "hostname": device.hostname,
                "success": True
            })
            success_count += 1
            
        except Exception as e:
            results.append({
                "device_id": device_id,
                "success": False,
                "error": str(e)
            })
            failed_count += 1
    
    # Update template usage stats
    template.usage_count += success_count
    template.last_used_at = datetime.utcnow()
    
    db.commit()
    
    return ApplyTemplateResponse(
        success_count=success_count,
        failed_count=failed_count,
        results=results
    )


# ═══════════════════════════════════════════════════════════════════════════════
# STATISTICS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/templates/stats/summary")
def get_template_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user),
):
    """Get summary statistics for credential templates."""
    if current_user.role == UserRole.VIEWER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    total = db.query(func.count(CredentialTemplate.id)).scalar()
    active = db.query(func.count(CredentialTemplate.id)).filter(
        CredentialTemplate.is_active == True
    ).scalar()
    total_usage = db.query(func.sum(CredentialTemplate.usage_count)).scalar() or 0
    
    # Devices with credentials
    devices_with_creds = db.query(func.count(Device.id)).filter(
        Device.encrypted_password.isnot(None)
    ).scalar()
    
    total_devices = db.query(func.count(Device.id)).scalar()
    
    return {
        "total_templates": total,
        "active_templates": active,
        "total_usage": total_usage,
        "devices_with_credentials": devices_with_creds,
        "total_devices": total_devices,
        "coverage_percentage": round((devices_with_creds / total_devices * 100) if total_devices > 0 else 0, 1)
    }
