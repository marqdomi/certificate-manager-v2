# backend/schemas/cert_master.py
"""
Pydantic schemas for Certificate Master Table feature.
Multi-location certificate tracking for NOC team visibility.
"""

from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime
from typing import List, Optional
from enum import Enum


# -------------------------------------------------------------------
# ENUMS (Legacy - for backwards compatibility)
# -------------------------------------------------------------------

class InstallationLocationType(str, Enum):
    F5 = "f5"
    LOCAL_VM = "local_vm"
    PHYSICAL_SERVER = "physical_server"
    AZURE_APP_GW = "azure_app_gw"
    AZURE_FRONT_DOOR = "azure_front_door"
    AWS_ALB = "aws_alb"
    AWS_CLOUDFRONT = "aws_cloudfront"
    GCP_LB = "gcp_lb"
    KUBERNETES = "kubernetes"
    CDN = "cdn"
    OTHER = "other"


class InstallationStatus(str, Enum):
    PENDING = "pending"
    INSTALLED = "installed"
    VERIFIED = "verified"
    FAILED = "failed"
    NOT_APPLICABLE = "not_applicable"


class Criticality(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


# -------------------------------------------------------------------
# TEAM SCHEMAS
# -------------------------------------------------------------------

class TeamBase(BaseModel):
    """Base schema for team."""
    name: str = Field(..., min_length=1, max_length=100)
    display_name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    color: Optional[str] = Field(None, max_length=20)  # Hex color for UI
    contact_email: Optional[str] = Field(None, max_length=200)
    slack_channel: Optional[str] = Field(None, max_length=100)


class TeamCreate(TeamBase):
    """Schema for creating a new team."""
    pass


class TeamUpdate(BaseModel):
    """Schema for updating a team."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    display_name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    contact_email: Optional[str] = None
    slack_channel: Optional[str] = None
    is_active: Optional[bool] = None


class TeamResponse(TeamBase):
    """Response schema for team."""
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Computed fields
    certificate_count: int = 0
    installation_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class TeamSummaryResponse(BaseModel):
    """Minimal team info for dropdowns and references."""
    id: int
    name: str
    display_name: Optional[str] = None
    color: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------------
# LOCATION TYPE SCHEMAS
# -------------------------------------------------------------------

class LocationTypeBase(BaseModel):
    """Base schema for location type."""
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=50)  # Material icon name
    category: Optional[str] = Field(None, max_length=50)  # 'network', 'cloud', 'server'


class LocationTypeCreate(LocationTypeBase):
    """Schema for creating a new location type."""
    pass


class LocationTypeUpdate(BaseModel):
    """Schema for updating a location type."""
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


class LocationTypeResponse(LocationTypeBase):
    """Response schema for location type."""
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Computed
    installation_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------------
# CERTIFICATE INSTALLATION SCHEMAS
# -------------------------------------------------------------------

class CertificateInstallationBase(BaseModel):
    """Base schema for certificate installation."""
    location_type: InstallationLocationType
    location_name: str = Field(..., min_length=1, max_length=200)
    location_identifier: Optional[str] = None
    location_details: Optional[str] = None
    device_id: Optional[int] = None
    responsible_team: str = Field(..., min_length=1, max_length=100)
    responsible_contact: Optional[str] = None
    notes: Optional[str] = None
    installation_instructions: Optional[str] = None


class CertificateInstallationCreate(CertificateInstallationBase):
    """Schema for creating a new installation record."""
    pass


class CertificateInstallationUpdate(BaseModel):
    """Schema for updating an installation record."""
    location_identifier: Optional[str] = None
    location_details: Optional[str] = None
    responsible_team: Optional[str] = None
    responsible_contact: Optional[str] = None
    notes: Optional[str] = None
    installation_instructions: Optional[str] = None


class InstallationStatusUpdate(BaseModel):
    """Schema for updating installation status (mark as installed/verified)."""
    status: InstallationStatus
    installed_expiration: Optional[datetime] = None
    installed_serial: Optional[str] = None
    verification_notes: Optional[str] = None


class CertificateInstallationResponse(CertificateInstallationBase):
    """Response schema for certificate installation."""
    id: int
    master_id: int
    status: InstallationStatus
    installed_expiration: Optional[datetime] = None
    installed_serial: Optional[str] = None
    installed_at: Optional[datetime] = None
    is_current: bool = False
    updated_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    verification_notes: Optional[str] = None
    created_at: datetime
    
    # Computed fields
    device_hostname: Optional[str] = None
    days_until_expiration: Optional[int] = None
    
    # Team info
    responsible_team_id: Optional[int] = None
    responsible_team_info: Optional[TeamSummaryResponse] = None
    
    # Location type info
    location_type_id: Optional[int] = None
    location_type_info: Optional[LocationTypeResponse] = None

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------------
# CERTIFICATE MASTER SCHEMAS
# -------------------------------------------------------------------

class CertificateTeamAssignment(BaseModel):
    """Schema for assigning teams to a certificate."""
    team_id: int
    is_primary: bool = False


class CertificateMasterBase(BaseModel):
    """Base schema for certificate master record."""
    common_name: str = Field(..., min_length=1, max_length=500)
    friendly_name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    owner_team: Optional[str] = Field(None, max_length=100)  # Legacy
    primary_contact: Optional[str] = Field(None, max_length=200)
    secondary_contact: Optional[str] = Field(None, max_length=200)
    notification_emails: Optional[str] = None  # JSON array
    slack_channel: Optional[str] = Field(None, max_length=100)
    renewal_lead_days: int = Field(default=30, ge=1, le=365)
    auto_sync_f5: bool = True
    environment: Optional[str] = Field(None, max_length=50)
    application: Optional[str] = Field(None, max_length=200)
    criticality: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None
    documentation_url: Optional[str] = Field(None, max_length=500)


class CertificateMasterCreate(CertificateMasterBase):
    """Schema for creating a new master certificate record."""
    # Optionally include initial certificate info
    current_expiration: Optional[datetime] = None
    current_issuer: Optional[str] = None
    current_serial: Optional[str] = None
    # Teams to assign (new)
    team_ids: Optional[List[int]] = None
    primary_team_id: Optional[int] = None


class CertificateMasterUpdate(BaseModel):
    """Schema for updating a master certificate record."""
    friendly_name: Optional[str] = None
    description: Optional[str] = None
    owner_team: Optional[str] = None  # Legacy
    primary_contact: Optional[str] = None
    secondary_contact: Optional[str] = None
    notification_emails: Optional[str] = None
    slack_channel: Optional[str] = None
    renewal_lead_days: Optional[int] = None
    auto_sync_f5: Optional[bool] = None
    environment: Optional[str] = None
    application: Optional[str] = None
    criticality: Optional[str] = None
    notes: Optional[str] = None
    documentation_url: Optional[str] = None
    # Teams to assign (new)
    team_ids: Optional[List[int]] = None
    primary_team_id: Optional[int] = None
    renewal_notes: Optional[str] = None
    is_active: Optional[bool] = None


class InstallationPreview(BaseModel):
    """Minimal installation info for preview in list views."""
    id: int
    location_type: Optional[str] = None
    location_name: str
    status: Optional[str] = None
    is_current: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class CertificateMasterResponse(CertificateMasterBase):
    """Response schema for certificate master record."""
    id: int
    current_expiration: Optional[datetime] = None
    current_issuer: Optional[str] = None
    current_serial: Optional[str] = None
    last_renewal_date: Optional[datetime] = None
    renewal_notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    
    # Computed fields
    days_until_expiration: Optional[int] = None
    total_installations: int = 0
    pending_installations: int = 0
    verified_installations: int = 0
    
    # Teams (new)
    teams: List[TeamSummaryResponse] = []
    primary_team: Optional[TeamSummaryResponse] = None
    
    # Preview of installations for tooltips (first 10)
    installations: List[InstallationPreview] = []

    model_config = ConfigDict(from_attributes=True)


class CertificateMasterWithInstallations(CertificateMasterResponse):
    """Response schema with full installation details."""
    installations: List[CertificateInstallationResponse] = []


class PaginatedCertificateMasterResponse(BaseModel):
    """Paginated response for certificate master list."""
    items: List[CertificateMasterResponse]
    total: int
    skip: int
    limit: int
    has_more: bool


# -------------------------------------------------------------------
# DASHBOARD / SUMMARY SCHEMAS
# -------------------------------------------------------------------

class TeamSummary(BaseModel):
    """Summary of installations by team."""
    team: str
    total: int
    pending: int
    installed: int
    verified: int
    failed: int


class LocationTypeSummary(BaseModel):
    """Summary of installations by location type."""
    location_type: str
    total: int
    pending: int
    verified: int


class CertMasterDashboardSummary(BaseModel):
    """Dashboard summary for Certificate Master."""
    total_certificates: int
    active_certificates: int
    expiring_soon: int  # Within renewal_lead_days
    expired: int
    
    total_installations: int
    pending_installations: int
    installed_installations: int
    verified_installations: int
    failed_installations: int
    
    by_team: List[TeamSummary]
    by_location_type: List[LocationTypeSummary]
    
    # Certificates needing attention
    certificates_expiring_7_days: int
    certificates_expiring_30_days: int
    installations_needing_update: int  # Where installed cert != current cert


class BulkInstallationCreate(BaseModel):
    """Schema for bulk creating installations for a master certificate."""
    installations: List[CertificateInstallationCreate]


class SyncFromF5Request(BaseModel):
    """Request to sync master certificates from F5 scan data."""
    create_missing: bool = True  # Create master records for certs not in table
    update_existing: bool = True  # Update expiration/issuer for existing
    auto_create_installations: bool = True  # Create F5 installation records
