from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class CertificateResponse(BaseModel):
    id: int
    name: str
    common_name: str | None
    issuer: str | None
    f5_device_hostname: str
    partition: str
    expiration_date: datetime | None
    days_remaining: int | None
    
    # --- ¡AÑADE ESTA LÍNEA! ---
    device_id: int  # El ID del dispositivo al que pertenece

    renewal_id: int | None = None
    renewal_status: str | None = None

    usage_state: str | None = None  # 'in-use' | 'no-profiles' | 'profiles-no-vips'

    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════════════════════
# CLEANUP SCHEMAS - v2.5 (December 2025)
# ═══════════════════════════════════════════════════════════════════════════════

class CleanupCategory(str, Enum):
    """Category for cleanup analysis."""
    SAFE_TO_DELETE = "safe_to_delete"         # No SSL profiles, can delete immediately
    BLOCKED_BY_PROFILES = "blocked_by_profiles"  # Has SSL profiles, needs dissociation
    RECENTLY_EXPIRED = "recently_expired"      # Expired < threshold days, might still be needed


class CleanupStrategy(str, Enum):
    """Strategy for certificate deletion."""
    FORCE = "force"                   # Delete only if no profiles (safe)
    DISSOCIATE = "dissociate"         # Remove from profiles first, then delete
    DRY_RUN = "dry_run"               # Preview only, no changes


class CleanupCertificateItem(BaseModel):
    """A certificate in the cleanup analysis."""
    id: int
    name: str
    common_name: Optional[str] = None
    partition: str = "Common"
    expiration_date: Optional[datetime] = None
    days_expired: int = 0  # Positive = days since expiration
    category: CleanupCategory
    ssl_profiles: List[str] = []  # List of profile names using this cert
    ssl_profiles_count: int = 0
    can_delete_safely: bool = False
    
    model_config = ConfigDict(from_attributes=True)


class CleanupAnalysisResponse(BaseModel):
    """Response for cleanup analysis endpoint."""
    device_id: int
    device_hostname: str
    analysis_timestamp: datetime
    days_threshold: int
    
    # Summary counts
    total_certificates: int
    total_expired: int
    safe_to_delete: int
    blocked_by_profiles: int
    
    # Detailed lists
    certificates: List[CleanupCertificateItem]
    
    # Metadata
    message: str


class AssistedDeletionRequest(BaseModel):
    """Request for assisted deletion."""
    cert_id: int
    strategy: CleanupStrategy
    dry_run: bool = False
    create_snapshot: bool = True  # Always create snapshot by default


class AssistedDeletionResponse(BaseModel):
    """Response for assisted deletion."""
    success: bool
    cert_id: int
    cert_name: str
    strategy_used: str
    dry_run: bool
    
    # What was done
    profiles_dissociated: int = 0
    certificate_deleted: bool = False
    snapshot_id: Optional[int] = None
    
    # Dry run info
    would_dissociate_profiles: List[str] = []
    would_delete_certificate: bool = False
    
    message: str
    errors: List[str] = []


class BulkCleanupRequest(BaseModel):
    """Request for bulk cleanup operation."""
    cert_ids: List[int]
    strategy: CleanupStrategy
    dry_run: bool = False
    create_snapshots: bool = True


class BulkCleanupResponse(BaseModel):
    """Response for bulk cleanup operation."""
    success: bool
    operation_id: str  # UUID for the bulk operation
    dry_run: bool
    
    # Counts
    total_requested: int
    successful: int
    failed: int
    skipped: int
    
    # Details
    results: List[AssistedDeletionResponse]
    
    message: str


class DryRunResult(BaseModel):
    """Result of a dry-run operation."""
    cert_id: int
    cert_name: str
    can_proceed: bool
    
    # What would happen
    action: str  # 'delete', 'dissociate_and_delete', 'skip'
    profiles_to_dissociate: List[str] = []
    
    # Warnings
    warnings: List[str] = []
    blockers: List[str] = []


class DryRunPreviewResponse(BaseModel):
    """Response for dry-run preview of bulk operation."""
    operation_type: str
    total_certificates: int
    
    # Breakdown
    can_proceed: int
    blocked: int
    
    # Details
    results: List[DryRunResult]
    
    # Summary
    total_profiles_affected: int
    estimated_duration_seconds: int


# ═══════════════════════════════════════════════════════════════════════════════
# ROLLBACK SCHEMAS - v2.5 (December 2025)
# ═══════════════════════════════════════════════════════════════════════════════

class SnapshotStatusEnum(str, Enum):
    """Snapshot status for API."""
    PENDING = "pending"
    APPLIED = "applied"
    ROLLED_BACK = "rolled_back"
    EXPIRED = "expired"
    FAILED = "failed"


class OperationSnapshotResponse(BaseModel):
    """Response for operation snapshot."""
    id: int
    operation_type: str
    operation_id: str
    status: SnapshotStatusEnum
    
    device_id: int
    device_hostname: str
    cert_name: str
    partition: str
    
    affected_profiles: List[str] = []
    
    created_by: Optional[str] = None
    created_at: datetime
    expires_at: datetime
    executed_at: Optional[datetime] = None
    rolled_back_at: Optional[datetime] = None
    
    can_rollback: bool = False
    
    model_config = ConfigDict(from_attributes=True)


class RollbackPreviewResponse(BaseModel):
    """Preview of what a rollback would do."""
    snapshot_id: int
    operation_type: str
    status: str
    can_rollback: bool
    
    device_hostname: str
    cert_name: str
    partition: str
    affected_profiles: List[str]
    
    created_at: str
    expires_at: str
    executed_at: Optional[str] = None
    created_by: Optional[str] = None
    
    will_restore: Dict[str, Any]


class RollbackExecuteRequest(BaseModel):
    """Request to execute a rollback."""
    snapshot_id: int
    confirm: bool = False  # Must be True to proceed


class RollbackExecuteResponse(BaseModel):
    """Response from rollback execution."""
    success: bool
    snapshot_id: int
    operation_type: str
    
    # What was restored
    cert_restored: bool = False
    profiles_restored: int = 0
    
    message: str
    errors: List[str] = []