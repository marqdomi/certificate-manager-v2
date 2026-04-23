# backend/api/endpoints/admin_providers.py
"""
Admin endpoints para configurar proveedores externos.
Hoy: DigiCert.

Prefix: /api/v1/admin/providers
Rol requerido: SUPER_ADMIN.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from core import config as app_config
from db.base import get_db
from db.models import SystemConfig, User, UserRole
from schemas.digicert import (
    DigicertConfigResponse,
    DigicertConfigUpdate,
    TestConnectionResponse,
)
from services import auth_service, digicert_service, encryption_service

logger = logging.getLogger(__name__)
router = APIRouter()

CATEGORY = "digicert"


def _super_admin():
    return auth_service.require_role([UserRole.SUPER_ADMIN.value])


def _set_config(db: Session, key: str, value: Optional[str], *, encrypted: bool, username: Optional[str]) -> None:
    row = db.query(SystemConfig).filter(SystemConfig.category == CATEGORY, SystemConfig.key == key).first()
    stored_value: Optional[str]
    if value is None:
        stored_value = None
    elif encrypted:
        stored_value = encryption_service.encrypt_data(value)
    else:
        stored_value = value

    if row:
        row.value = stored_value
        row.encrypted = encrypted
        row.updated_by = username
        row.updated_at = datetime.utcnow()
    else:
        row = SystemConfig(
            category=CATEGORY,
            key=key,
            value=stored_value,
            encrypted=encrypted,
            updated_by=username,
        )
        db.add(row)


def _get_config_raw(db: Session, key: str) -> Optional[SystemConfig]:
    return db.query(SystemConfig).filter(SystemConfig.category == CATEGORY, SystemConfig.key == key).first()


def _get_config_plain(db: Session, key: str) -> Optional[str]:
    row = _get_config_raw(db, key)
    return row.value if row and not row.encrypted else None


# ---------------------------------------------------------------------------
# GET / PUT config
# ---------------------------------------------------------------------------

@router.get(
    "/digicert/config",
    response_model=DigicertConfigResponse,
    dependencies=[Depends(_super_admin())],
)
def get_digicert_config(db: Session = Depends(get_db)):
    api_key_row = _get_config_raw(db, "api_key")
    api_key_set = False
    api_key_last4: Optional[str] = None
    if api_key_row and api_key_row.value:
        api_key_set = True
        try:
            decrypted = encryption_service.decrypt_data(api_key_row.value) if api_key_row.encrypted else api_key_row.value
            if decrypted and len(decrypted) >= 4:
                api_key_last4 = decrypted[-4:]
        except Exception:  # noqa: BLE001
            api_key_last4 = None

    notify_emails_raw = _get_config_plain(db, "approval_notify_emails") or ""
    notify_emails = [e.strip() for e in notify_emails_raw.split(",") if e.strip()]

    return DigicertConfigResponse(
        api_key_set=api_key_set,
        api_key_last4=api_key_last4,
        container_id=_get_config_plain(db, "container_id"),
        organization_id=_get_config_plain(db, "organization_id"),
        default_product=_get_config_plain(db, "default_product"),
        default_validity_years=int(_get_config_plain(db, "default_validity_years") or 1),
        default_key_size=int(_get_config_plain(db, "default_key_size") or 2048),
        approval_notify_emails=notify_emails,
        approval_reminder_interval_hours=int(
            _get_config_plain(db, "approval_reminder_interval_hours")
            or app_config.DIGICERT_APPROVAL_REMINDER_INTERVAL_HOURS
        ),
        base_url=app_config.DIGICERT_BASE_URL,
        feature_enabled=app_config.ENABLE_DIGICERT_RENEWAL,
    )


@router.put(
    "/digicert/config",
    response_model=DigicertConfigResponse,
    dependencies=[Depends(_super_admin())],
)
def update_digicert_config(
    payload: DigicertConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user),
):
    username = current_user.username

    if payload.api_key is not None:
        if payload.api_key == "":
            _set_config(db, "api_key", None, encrypted=True, username=username)
        else:
            _set_config(db, "api_key", payload.api_key, encrypted=True, username=username)

    for field, encrypted in [
        ("container_id", False),
        ("organization_id", False),
        ("default_product", False),
    ]:
        val = getattr(payload, field)
        if val is not None:
            _set_config(db, field, val, encrypted=encrypted, username=username)

    if payload.default_validity_years is not None:
        _set_config(db, "default_validity_years", str(payload.default_validity_years), encrypted=False, username=username)
    if payload.default_key_size is not None:
        _set_config(db, "default_key_size", str(payload.default_key_size), encrypted=False, username=username)
    if payload.approval_reminder_interval_hours is not None:
        _set_config(
            db,
            "approval_reminder_interval_hours",
            str(payload.approval_reminder_interval_hours),
            encrypted=False,
            username=username,
        )
    if payload.approval_notify_emails is not None:
        _set_config(
            db,
            "approval_notify_emails",
            ",".join(payload.approval_notify_emails),
            encrypted=False,
            username=username,
        )

    db.commit()
    logger.info("[digicert] config updated by %s", username)
    return get_digicert_config(db)


# ---------------------------------------------------------------------------
# Test connection
# ---------------------------------------------------------------------------

@router.post(
    "/digicert/test-connection",
    response_model=TestConnectionResponse,
    dependencies=[Depends(_super_admin())],
)
def test_connection(db: Session = Depends(get_db)):
    try:
        data = digicert_service.test_connection(db)
    except digicert_service.DigicertAuthError as e:
        return TestConnectionResponse(ok=False, message=f"Auth error: {e}")
    except digicert_service.DigicertApiError as e:
        return TestConnectionResponse(ok=False, message=str(e))
    except Exception as e:  # noqa: BLE001
        return TestConnectionResponse(ok=False, message=f"Unexpected error: {e}")
    return TestConnectionResponse(ok=True, message="Connection OK", account=data if isinstance(data, dict) else None)


# ---------------------------------------------------------------------------
# Discovery endpoints
# ---------------------------------------------------------------------------

@router.get("/digicert/containers", dependencies=[Depends(_super_admin())])
def list_containers(db: Session = Depends(get_db)):
    try:
        return digicert_service.list_containers(db)
    except digicert_service.DigicertApiError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/digicert/organizations", dependencies=[Depends(_super_admin())])
def list_organizations(
    container_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    try:
        return digicert_service.list_organizations(db, container_id=container_id)
    except digicert_service.DigicertApiError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/digicert/products", dependencies=[Depends(_super_admin())])
def list_products(db: Session = Depends(get_db)):
    try:
        return digicert_service.list_products(db)
    except digicert_service.DigicertApiError as e:
        raise HTTPException(status_code=502, detail=str(e))
