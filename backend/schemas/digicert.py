# backend/schemas/digicert.py
"""
Schemas Pydantic para el módulo DigiCert (renovación automatizada).
Se mantiene como contrato estable para frontend y tests.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Renewal order: request / response
# ---------------------------------------------------------------------------

class RenewalPrecheckResponse(BaseModel):
    """Info que el wizard usa antes del POST real para avisar al usuario."""
    certificate_id: int
    common_name: str
    current_sans: List[str] = Field(default_factory=list)
    approval_required: bool = False
    approvers: List[str] = Field(default_factory=list)
    early_renewal_warning: bool = False
    days_until_expiration: Optional[int] = None
    new_sans_detected: List[str] = Field(default_factory=list)
    dcv_hint: Optional[str] = None  # p.ej. "validación previa aplicable"


class RenewalCreateRequest(BaseModel):
    certificate_id: int
    san_list: Optional[List[str]] = None   # Si es None, usa los SANs actuales / solo CN.
    validity_years: Optional[int] = None   # Si es None, usa default de config.
    product: Optional[str] = None          # Override de producto default.
    organization_id: Optional[str] = None  # Override
    container_id: Optional[str] = None     # Override
    key_size: Optional[int] = None         # Override
    idempotency_key: Optional[str] = None  # Si el cliente lo manda, previene doble orden.


class RenewalPreviewResponse(BaseModel):
    """Dry-run: igual que precheck pero resume lo que se enviará a DigiCert."""
    certificate_id: int
    common_name: str
    san_list: List[str]
    validity_years: int
    product: str
    organization_id: Optional[str]
    container_id: Optional[str]
    key_size: int
    approval_required: bool
    quota_consumed: int = 1
    early_renewal_warning: bool = False


class RenewalOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    certificate_id: int
    status: str
    digicert_order_id: Optional[str] = None
    digicert_certificate_id: Optional[str] = None
    common_name: str
    san_list: List[str] = Field(default_factory=list)
    validity_years: int
    product: Optional[str] = None
    container_id: Optional[str] = None
    organization_id: Optional[str] = None
    key_size: int

    serial_number: Optional[str] = None
    thumbprint: Optional[str] = None
    valid_from: Optional[datetime] = None
    valid_till: Optional[datetime] = None

    approval_required: bool
    approval_detected_at: Optional[datetime] = None
    last_approval_reminder_at: Optional[datetime] = None

    dcv_method: Optional[str] = None
    dcv_completed_at: Optional[datetime] = None

    deploy_results: Optional[Dict[str, Any]] = None
    deployed_at: Optional[datetime] = None

    error_message: Optional[str] = None
    private_key_purged_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None


class RenewalDeployRequest(BaseModel):
    device_ids: Optional[List[int]] = None  # None = todos los devices del cert original.
    auto_deploy: bool = False               # Si True y viene de un webhook, puede auto-desplegar; default False.


class RenewalCancelRequest(BaseModel):
    reason: Optional[str] = None


# ---------------------------------------------------------------------------
# DCV
# ---------------------------------------------------------------------------

class DcvToken(BaseModel):
    san: str
    method: str                 # dns-cname | dns-txt | email | http | reused
    record_name: Optional[str] = None
    record_value: Optional[str] = None
    http_file_name: Optional[str] = None
    http_file_content: Optional[str] = None
    email: Optional[str] = None


class DcvStatusResponse(BaseModel):
    order_id: int
    tokens: List[DcvToken] = Field(default_factory=list)
    completed_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

class AuditEvent(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    username: Optional[str] = None
    event_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Admin config
# ---------------------------------------------------------------------------

class DigicertConfigUpdate(BaseModel):
    """PUT config. api_key es write-only y solo se actualiza si viene en el body."""
    api_key: Optional[str] = None
    container_id: Optional[str] = None
    organization_id: Optional[str] = None
    default_product: Optional[str] = None
    default_validity_years: Optional[int] = Field(default=None, ge=1, le=3)
    default_key_size: Optional[int] = Field(default=None, ge=2048, le=8192)
    approval_notify_emails: Optional[List[str]] = None
    approval_reminder_interval_hours: Optional[int] = Field(default=None, ge=1, le=168)


class DigicertConfigResponse(BaseModel):
    """GET config. api_key viene redactada."""
    api_key_set: bool = False
    api_key_last4: Optional[str] = None
    container_id: Optional[str] = None
    organization_id: Optional[str] = None
    default_product: Optional[str] = None
    default_validity_years: int = 1
    default_key_size: int = 2048
    approval_notify_emails: List[str] = Field(default_factory=list)
    approval_reminder_interval_hours: int = 24
    base_url: str
    feature_enabled: bool = False


class TestConnectionResponse(BaseModel):
    ok: bool
    message: str
    account: Optional[Dict[str, Any]] = None


class HealthResponse(BaseModel):
    digicert_api: str  # ok | degraded | down | disabled
    last_successful_call: Optional[datetime] = None
    active_orders: int = 0
    stuck_orders: int = 0
    feature_enabled: bool = False
