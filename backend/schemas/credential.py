# backend/schemas/credential.py
"""
Pydantic schemas for Credential Template management.
Enterprise-level credential management for F5 devices.
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class CredentialTemplateBase(BaseModel):
    """Base schema for credential template."""
    name: str = Field(..., min_length=1, max_length=100, description="Template name")
    description: Optional[str] = Field(None, max_length=500, description="Template description")
    username: str = Field(default="admin", max_length=100, description="Default username")
    environment: Optional[str] = Field(None, max_length=50, description="Target environment (prod, dev, etc.)")
    site_pattern: Optional[str] = Field(None, max_length=200, description="Site pattern for auto-matching")
    is_default: bool = Field(default=False, description="Set as default template")


class CredentialTemplateCreate(CredentialTemplateBase):
    """Schema for creating a new credential template."""
    password: str = Field(..., min_length=1, description="Password (will be encrypted)")


class CredentialTemplateUpdate(BaseModel):
    """Schema for updating an existing credential template."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    username: Optional[str] = Field(None, max_length=100)
    password: Optional[str] = Field(None, min_length=1, description="New password (leave empty to keep current)")
    environment: Optional[str] = Field(None, max_length=50)
    site_pattern: Optional[str] = Field(None, max_length=200)
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


class CredentialTemplateResponse(CredentialTemplateBase):
    """Schema for credential template response (no password)."""
    id: int
    is_active: bool
    usage_count: int
    last_used_at: Optional[datetime]
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CredentialTemplateListResponse(BaseModel):
    """Paginated list of credential templates."""
    templates: List[CredentialTemplateResponse]
    total: int


class ApplyTemplateRequest(BaseModel):
    """Request to apply a template to devices."""
    template_id: int = Field(..., description="ID of the template to apply")
    device_ids: List[int] = Field(..., min_length=1, description="List of device IDs")


class ApplyTemplateResponse(BaseModel):
    """Response after applying template to devices."""
    success_count: int
    failed_count: int
    results: List[dict]


class DeviceCredentialSet(BaseModel):
    """Schema for setting credentials on a single device."""
    username: str = Field(default="admin", max_length=100)
    password: str = Field(..., min_length=1)


class BulkCredentialRequest(BaseModel):
    """Request for bulk credential assignment."""
    device_ids: List[int] = Field(..., min_length=1)
    username: str = Field(default="admin", max_length=100)
    password: str = Field(..., min_length=1)
    save_as_template: bool = Field(default=False)
    template_name: Optional[str] = Field(None, max_length=100)
