# backend/api/endpoints/digicert_renewals.py
"""
Endpoints del módulo DigiCert. Router paralelo al flujo clásico (renewals.py).
Prefix montado en main.py: /api/v1/digicert
"""
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from core import config as app_config
from db.base import get_db
from db.models import (
    DIGICERT_ACTIVE_STATUSES,
    DigicertOrderStatus,
    DigicertRenewalAuditLog,
    DigicertRenewalOrder,
    User,
    UserRole,
)
from schemas.digicert import (
    AuditEvent,
    DcvStatusResponse,
    DcvToken,
    HealthResponse,
    RenewalCancelRequest,
    RenewalCreateRequest,
    RenewalDeployRequest,
    RenewalOrderResponse,
    RenewalPrecheckResponse,
    RenewalPreviewResponse,
)
from services import (
    auth_service,
    digicert_renewal_service as renewal_svc,
    digicert_service,
)
from services.digicert_tasks import (
    deploy_digicert_order_task,
    submit_digicert_order_task,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Feature flag guard
# ---------------------------------------------------------------------------

def _ensure_enabled():
    if not app_config.ENABLE_DIGICERT_RENEWAL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DigiCert renewal module is disabled",
        )


# ---------------------------------------------------------------------------
# Precheck / preview
# ---------------------------------------------------------------------------

@router.get(
    "/renewals/precheck",
    response_model=RenewalPrecheckResponse,
    dependencies=[Depends(auth_service.require_role([UserRole.OPERATOR.value, UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]))],
)
def renewal_precheck(
    certificate_id: int = Query(...),
    product: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    _ensure_enabled()
    try:
        return renewal_svc.precheck(db, certificate_id, product=product)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post(
    "/renewals/preview",
    response_model=RenewalPreviewResponse,
    dependencies=[Depends(auth_service.require_role([UserRole.OPERATOR.value, UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]))],
)
def renewal_preview(payload: RenewalCreateRequest, db: Session = Depends(get_db)):
    _ensure_enabled()
    try:
        return renewal_svc.preview(
            db,
            payload.certificate_id,
            san_list=payload.san_list,
            validity_years=payload.validity_years,
            product=payload.product,
            organization_id=payload.organization_id,
            container_id=payload.container_id,
            key_size=payload.key_size,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ---------------------------------------------------------------------------
# Create renewal (initiate)
# ---------------------------------------------------------------------------

@router.post(
    "/renewals",
    response_model=RenewalOrderResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(auth_service.require_role([UserRole.OPERATOR.value, UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]))],
)
def create_renewal(
    payload: RenewalCreateRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user),
):
    _ensure_enabled()
    key = payload.idempotency_key or idempotency_key
    try:
        order, created = renewal_svc.initiate_renewal(
            db,
            certificate_id=payload.certificate_id,
            created_by=current_user.username,
            san_list=payload.san_list,
            validity_years=payload.validity_years,
            product=payload.product,
            organization_id=payload.organization_id,
            container_id=payload.container_id,
            key_size=payload.key_size,
            idempotency_key=key,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    if created:
        submit_digicert_order_task.apply_async(args=[order.id], countdown=1)
    return renewal_svc.order_to_dict(order)


# ---------------------------------------------------------------------------
# List / get
# ---------------------------------------------------------------------------

@router.get(
    "/renewals",
    response_model=List[RenewalOrderResponse],
    dependencies=[Depends(auth_service.get_current_active_user)],
)
def list_renewals(
    certificate_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    active_only: bool = Query(False),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    _ensure_enabled()
    q = db.query(DigicertRenewalOrder)
    if certificate_id:
        q = q.filter(DigicertRenewalOrder.certificate_id == certificate_id)
    if status_filter:
        q = q.filter(DigicertRenewalOrder.status == status_filter)
    if active_only:
        q = q.filter(DigicertRenewalOrder.status.in_(list(DIGICERT_ACTIVE_STATUSES)))
    orders = (
        q.order_by(DigicertRenewalOrder.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [renewal_svc.order_to_dict(o) for o in orders]


@router.get(
    "/renewals/{order_id}",
    response_model=RenewalOrderResponse,
    dependencies=[Depends(auth_service.get_current_active_user)],
)
def get_renewal(order_id: int, db: Session = Depends(get_db)):
    _ensure_enabled()
    order = db.query(DigicertRenewalOrder).filter(DigicertRenewalOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return renewal_svc.order_to_dict(order)


# ---------------------------------------------------------------------------
# Deploy
# ---------------------------------------------------------------------------

@router.post(
    "/renewals/{order_id}/deploy",
    response_model=RenewalOrderResponse,
    dependencies=[Depends(auth_service.require_role([UserRole.OPERATOR.value, UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]))],
)
def deploy_renewal(
    order_id: int,
    payload: RenewalDeployRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user),
):
    _ensure_enabled()
    order = db.query(DigicertRenewalOrder).filter(DigicertRenewalOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in {
        DigicertOrderStatus.ISSUED.value,
        DigicertOrderStatus.DOWNLOADED.value,
        DigicertOrderStatus.PARTIAL_DEPLOY.value,
    }:
        raise HTTPException(
            status_code=400,
            detail=f"Order is in status '{order.status}' and cannot be deployed",
        )
    renewal_svc.record_audit(
        db,
        order_id=order.id,
        event_type="DEPLOY_REQUESTED",
        username=current_user.username,
        metadata={"device_ids": payload.device_ids},
    )
    deploy_digicert_order_task.apply_async(args=[order.id, payload.device_ids], countdown=1)
    db.refresh(order)
    return renewal_svc.order_to_dict(order)


@router.post(
    "/renewals/{order_id}/deploy/retry",
    response_model=RenewalOrderResponse,
    dependencies=[Depends(auth_service.require_role([UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]))],
)
def retry_deploy(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user),
):
    _ensure_enabled()
    order = db.query(DigicertRenewalOrder).filter(DigicertRenewalOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in {
        DigicertOrderStatus.PARTIAL_DEPLOY.value,
        DigicertOrderStatus.FAILED.value,
    }:
        raise HTTPException(
            status_code=400,
            detail=f"Retry not allowed in state '{order.status}'",
        )
    renewal_svc.record_audit(
        db,
        order_id=order.id,
        event_type="DEPLOY_RETRY",
        username=current_user.username,
    )
    deploy_digicert_order_task.apply_async(args=[order.id, None], countdown=1)
    db.refresh(order)
    return renewal_svc.order_to_dict(order)


# ---------------------------------------------------------------------------
# Cancel / retry
# ---------------------------------------------------------------------------

@router.post(
    "/renewals/{order_id}/cancel",
    response_model=RenewalOrderResponse,
    dependencies=[Depends(auth_service.require_role([UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]))],
)
def cancel_renewal(
    order_id: int,
    payload: RenewalCancelRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user),
):
    _ensure_enabled()
    order = db.query(DigicertRenewalOrder).filter(DigicertRenewalOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status in {
        DigicertOrderStatus.DEPLOYED.value,
        DigicertOrderStatus.CANCELLED.value,
    }:
        raise HTTPException(status_code=400, detail=f"Cannot cancel in state '{order.status}'")

    if order.digicert_order_id:
        try:
            digicert_service.cancel_order(db, order.digicert_order_id, reason=payload.reason or "Cancelled from CMT")
        except digicert_service.DigicertApiError as e:
            logger.warning("[digicert] remote cancel failed order=%s: %s", order.id, e)

    renewal_svc.update_order_status(db, order, DigicertOrderStatus.CANCELLED, error_message=payload.reason)
    renewal_svc.record_audit(
        db,
        order_id=order.id,
        event_type="CANCELLED",
        username=current_user.username,
        metadata={"reason": payload.reason},
    )
    return renewal_svc.order_to_dict(order)


@router.post(
    "/renewals/{order_id}/retry",
    response_model=RenewalOrderResponse,
    dependencies=[Depends(auth_service.require_role([UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]))],
)
def retry_renewal(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user),
):
    """Reintenta un submit fallido (vuelve a PENDING_SUBMIT y encola)."""
    _ensure_enabled()
    order = db.query(DigicertRenewalOrder).filter(DigicertRenewalOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != DigicertOrderStatus.FAILED.value:
        raise HTTPException(status_code=400, detail=f"Retry only valid from FAILED, current={order.status}")
    if order.digicert_order_id:
        raise HTTPException(status_code=400, detail="Order already has a remote submission; use deploy retry instead")

    renewal_svc.update_order_status(db, order, DigicertOrderStatus.PENDING_SUBMIT, error_message=None)
    renewal_svc.record_audit(db, order_id=order.id, event_type="RETRY", username=current_user.username)
    submit_digicert_order_task.apply_async(args=[order.id], countdown=1)
    return renewal_svc.order_to_dict(order)


# ---------------------------------------------------------------------------
# DCV
# ---------------------------------------------------------------------------

@router.get(
    "/renewals/{order_id}/dcv",
    response_model=DcvStatusResponse,
    dependencies=[Depends(auth_service.get_current_active_user)],
)
def get_dcv(order_id: int, db: Session = Depends(get_db)):
    _ensure_enabled()
    order = db.query(DigicertRenewalOrder).filter(DigicertRenewalOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not order.digicert_order_id:
        return DcvStatusResponse(order_id=order.id, tokens=[], completed_at=order.dcv_completed_at)
    try:
        raw = digicert_service.get_order_dcv(db, order.digicert_order_id)
    except digicert_service.DigicertApiError as e:
        raise HTTPException(status_code=502, detail=f"DigiCert DCV fetch failed: {e}")

    tokens: List[DcvToken] = []
    for item in raw.get("dcv_tokens", []) if isinstance(raw, dict) else []:
        tokens.append(
            DcvToken(
                san=item.get("common_name") or item.get("dns_name") or "",
                method=item.get("dcv_method") or "unknown",
                record_name=item.get("token") and f"_dnsauth.{item.get('common_name')}",
                record_value=item.get("token"),
            )
        )
    return DcvStatusResponse(order_id=order.id, tokens=tokens, completed_at=order.dcv_completed_at)


@router.post(
    "/renewals/{order_id}/dcv/check",
    response_model=RenewalOrderResponse,
    dependencies=[Depends(auth_service.require_role([UserRole.OPERATOR.value, UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]))],
)
def check_dcv(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(auth_service.get_current_active_user)):
    _ensure_enabled()
    order = db.query(DigicertRenewalOrder).filter(DigicertRenewalOrder.id == order_id).first()
    if not order or not order.digicert_order_id:
        raise HTTPException(status_code=404, detail="Order not found or not yet submitted")
    try:
        digicert_service.check_dcv(db, order.digicert_order_id)
    except digicert_service.DigicertApiError as e:
        raise HTTPException(status_code=502, detail=f"DCV check failed: {e}")
    renewal_svc.record_audit(db, order_id=order.id, event_type="DCV_CHECK", username=current_user.username)
    return renewal_svc.order_to_dict(order)


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

@router.get(
    "/renewals/{order_id}/audit",
    response_model=List[AuditEvent],
    dependencies=[Depends(auth_service.get_current_active_user)],
)
def get_audit(order_id: int, db: Session = Depends(get_db)):
    _ensure_enabled()
    events = (
        db.query(DigicertRenewalAuditLog)
        .filter(DigicertRenewalAuditLog.order_id == order_id)
        .order_by(DigicertRenewalAuditLog.created_at.asc())
        .all()
    )
    import json as _json
    out = []
    for e in events:
        meta = _json.loads(e.event_metadata) if e.event_metadata else None
        out.append({
            "id": e.id,
            "event_type": e.event_type,
            "username": e.username,
            "event_metadata": meta,
            "created_at": e.created_at,
        })
    return out


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@router.get("/health", response_model=HealthResponse)
def health(db: Session = Depends(get_db)):
    enabled = app_config.ENABLE_DIGICERT_RENEWAL
    if not enabled:
        return HealthResponse(digicert_api="disabled", feature_enabled=False, active_orders=0, stuck_orders=0)

    api_status = "ok"
    try:
        digicert_service.test_connection(db)
    except digicert_service.DigicertAuthError:
        api_status = "degraded"
    except digicert_service.DigicertApiError:
        api_status = "down"
    except Exception:  # noqa: BLE001
        api_status = "down"

    active = (
        db.query(DigicertRenewalOrder)
        .filter(DigicertRenewalOrder.status.in_(list(DIGICERT_ACTIVE_STATUSES)))
        .count()
    )
    from datetime import datetime, timedelta
    stuck_threshold = datetime.utcnow() - timedelta(hours=24)
    stuck = (
        db.query(DigicertRenewalOrder)
        .filter(
            DigicertRenewalOrder.status.in_(list(DIGICERT_ACTIVE_STATUSES)),
            DigicertRenewalOrder.updated_at < stuck_threshold,
        )
        .count()
    )
    return HealthResponse(
        digicert_api=api_status,
        feature_enabled=True,
        active_orders=active,
        stuck_orders=stuck,
    )
