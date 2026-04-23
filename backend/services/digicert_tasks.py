# backend/services/digicert_tasks.py
"""
Celery tasks para el módulo DigiCert (módulo paralelo de renovación).

Tasks:
- submit_digicert_order_task(order_row_id)
    Llama API DigiCert para enviar la orden, guarda digicert_order_id, encola poll.
- poll_digicert_order_task(order_row_id, attempt=0)
    Polling con backoff exponencial. Detecta needs_approval, DCV pending, issued.
    Al issued: descarga cert+chain, parsea metadata, marca ISSUED.
- approval_reminder_task(order_row_id)
    Cada N horas re-notifica approvers mientras orden siga en NEEDS_APPROVAL.
- deploy_digicert_order_task(order_row_id, device_ids=None)
    Deploy a F5 reusando f5_service_logic. Rollback por device en caso de falla.
- purge_deployed_private_keys_task()
    Beat task diaria: purga encrypted_private_key de órdenes DEPLOYED con retención vencida.

Nota: el deploy puede llamarse también síncronamente desde el endpoint; esta task
permite deploys diferidos o auto-deploy futuros.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from celery.exceptions import SoftTimeLimitExceeded
from cryptography import x509
from cryptography.hazmat.primitives import hashes

from core import config as app_config
from core.celery_worker import celery_app
from db.base import SessionLocal
from db.models import (
    Certificate,
    Device,
    DigicertOrderStatus,
    DigicertRenewalOrder,
)
from services import (
    digicert_renewal_service as renewal_svc,
    digicert_service,
    encryption_service,
    f5_service_logic,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_order(db, order_row_id: int) -> Optional[DigicertRenewalOrder]:
    return db.query(DigicertRenewalOrder).filter(DigicertRenewalOrder.id == order_row_id).first()


def _next_delay(attempt: int) -> int:
    """Backoff exponencial capped: 30s, 60s, 120s, 240s, 300s(max)."""
    delay = app_config.DIGICERT_POLL_INITIAL_DELAY_SECONDS * (2 ** attempt)
    return min(delay, app_config.DIGICERT_POLL_MAX_DELAY_SECONDS)


def _parse_cert_metadata(cert_pem: str) -> dict:
    """Extrae serial, thumbprint, valid_from, valid_till del PEM."""
    try:
        cert = x509.load_pem_x509_certificate(cert_pem.encode("utf-8"))
    except Exception as e:  # noqa: BLE001
        logger.warning("[digicert] cert parse failed: %s", e)
        return {}
    return {
        "serial_number": format(cert.serial_number, "x"),
        "thumbprint": cert.fingerprint(hashes.SHA256()).hex(),
        "valid_from": cert.not_valid_before,
        "valid_till": cert.not_valid_after,
    }


# ---------------------------------------------------------------------------
# submit_digicert_order_task
# ---------------------------------------------------------------------------

@celery_app.task(name="digicert.submit_order", bind=True, max_retries=3, default_retry_delay=60)
def submit_digicert_order_task(self, order_row_id: int):
    if not app_config.ENABLE_DIGICERT_RENEWAL:
        logger.info("[digicert] module disabled, skipping submit order=%s", order_row_id)
        return

    db = SessionLocal()
    try:
        order = _load_order(db, order_row_id)
        if not order:
            logger.error("[digicert] submit: order %s not found", order_row_id)
            return
        if order.status != DigicertOrderStatus.PENDING_SUBMIT.value:
            logger.info(
                "[digicert] submit: order %s in state %s, skipping",
                order.id,
                order.status,
            )
            return

        san_list = json.loads(order.san_list) if order.san_list else []
        order.submit_attempts = (order.submit_attempts or 0) + 1
        db.commit()

        try:
            resp = digicert_service.submit_order(
                db,
                product_name_id=order.product or "ssl_plus",
                csr_pem=order.csr_pem or "",
                common_name=order.common_name,
                san_list=san_list,
                validity_years=order.validity_years,
                organization_id=order.organization_id,
                container_id=order.container_id,
            )
        except digicert_service.DigicertRateLimitError as e:
            logger.warning("[digicert] rate limited on submit order=%s", order.id)
            raise self.retry(exc=e, countdown=120)
        except digicert_service.DigicertApiError as e:
            logger.error("[digicert] submit failed order=%s: %s", order.id, e)
            renewal_svc.update_order_status(
                db, order, DigicertOrderStatus.FAILED, error_message=str(e)
            )
            renewal_svc.record_audit(
                db,
                order_id=order.id,
                event_type="ERROR",
                metadata={"phase": "submit", "message": str(e)},
            )
            return

        digicert_order_id = str(resp.get("id") or "")
        cert_block = resp.get("certificate") or {}
        digicert_cert_id = cert_block.get("id")

        order.digicert_order_id = digicert_order_id or None
        order.digicert_certificate_id = str(digicert_cert_id) if digicert_cert_id else None

        # DigiCert puede responder con "requests" que indican needs_approval
        requests_block = resp.get("requests") or []
        needs_approval = any(r.get("status") == "pending" for r in requests_block)

        if needs_approval:
            order.approval_required = True
            order.approval_detected_at = datetime.utcnow()
            renewal_svc.update_order_status(db, order, DigicertOrderStatus.NEEDS_APPROVAL)
            renewal_svc.record_audit(
                db,
                order_id=order.id,
                event_type="APPROVAL_REQUIRED",
                metadata={"digicert_order_id": digicert_order_id},
            )
            # Encola recordatorio periódico
            approval_reminder_task.apply_async(args=[order.id], countdown=60)
        else:
            renewal_svc.update_order_status(db, order, DigicertOrderStatus.SUBMITTED)
            renewal_svc.record_audit(
                db,
                order_id=order.id,
                event_type="SUBMITTED",
                metadata={"digicert_order_id": digicert_order_id},
            )

        # Encola polling inicial
        poll_digicert_order_task.apply_async(
            args=[order.id, 0],
            countdown=app_config.DIGICERT_POLL_INITIAL_DELAY_SECONDS,
        )
        logger.info(
            "[digicert] submitted order=%s digicert_order_id=%s needs_approval=%s",
            order.id,
            digicert_order_id,
            needs_approval,
        )
    except SoftTimeLimitExceeded:
        logger.error("[digicert] submit soft-time-limit exceeded order=%s", order_row_id)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# poll_digicert_order_task
# ---------------------------------------------------------------------------

@celery_app.task(name="digicert.poll_order", bind=True, max_retries=5)
def poll_digicert_order_task(self, order_row_id: int, attempt: int = 0):
    if not app_config.ENABLE_DIGICERT_RENEWAL:
        return

    db = SessionLocal()
    try:
        order = _load_order(db, order_row_id)
        if not order or not order.digicert_order_id:
            logger.warning("[digicert] poll: order %s missing or no digicert_order_id", order_row_id)
            return

        # Terminal states: no seguimos puleando
        if order.status in {
            DigicertOrderStatus.ISSUED.value,
            DigicertOrderStatus.DOWNLOADED.value,
            DigicertOrderStatus.DEPLOYED.value,
            DigicertOrderStatus.PARTIAL_DEPLOY.value,
            DigicertOrderStatus.FAILED.value,
            DigicertOrderStatus.CANCELLED.value,
            DigicertOrderStatus.APPROVAL_REJECTED.value,
            DigicertOrderStatus.TIMEOUT_APPROVAL.value,
        }:
            logger.info("[digicert] poll: order %s in terminal state %s", order.id, order.status)
            return

        # Kill-switch: si el polling lleva demasiado tiempo, marcar FAILED
        max_age = timedelta(hours=app_config.DIGICERT_POLL_MAX_TOTAL_HOURS)
        if datetime.utcnow() - order.created_at > max_age:
            logger.warning("[digicert] poll: order %s exceeded max wait time", order.id)
            renewal_svc.update_order_status(
                db,
                order,
                DigicertOrderStatus.FAILED,
                error_message=f"Polling timeout after {app_config.DIGICERT_POLL_MAX_TOTAL_HOURS}h",
            )
            renewal_svc.record_audit(
                db,
                order_id=order.id,
                event_type="ERROR",
                metadata={"phase": "poll", "message": "timeout"},
            )
            return

        try:
            remote_status, remote_cert_id = digicert_service.get_order_status(db, order.digicert_order_id)
        except digicert_service.DigicertRateLimitError:
            logger.warning("[digicert] poll rate-limited order=%s", order.id)
            poll_digicert_order_task.apply_async(
                args=[order.id, attempt + 1],
                countdown=_next_delay(attempt + 1),
            )
            return
        except digicert_service.DigicertApiError as e:
            logger.error("[digicert] poll api error order=%s: %s", order.id, e)
            # Reintentamos con backoff hasta max_retries
            poll_digicert_order_task.apply_async(
                args=[order.id, attempt + 1],
                countdown=_next_delay(attempt + 1),
            )
            return

        new_status = renewal_svc.map_digicert_status(remote_status)
        logger.info(
            "[digicert] poll order=%s remote=%s mapped=%s",
            order.id,
            remote_status,
            new_status.value,
        )

        if new_status == DigicertOrderStatus.NEEDS_APPROVAL:
            if order.status != DigicertOrderStatus.NEEDS_APPROVAL.value:
                order.approval_required = True
                order.approval_detected_at = datetime.utcnow()
                renewal_svc.update_order_status(db, order, new_status)
                renewal_svc.record_audit(db, order_id=order.id, event_type="APPROVAL_REQUIRED")
                approval_reminder_task.apply_async(args=[order.id], countdown=60)
            # Seguir puleando
            poll_digicert_order_task.apply_async(
                args=[order.id, attempt + 1],
                countdown=_next_delay(attempt + 1),
            )
            return

        if new_status == DigicertOrderStatus.APPROVAL_REJECTED:
            renewal_svc.update_order_status(db, order, new_status, error_message="Rejected by approver")
            renewal_svc.record_audit(db, order_id=order.id, event_type="APPROVAL_REJECTED")
            return

        if new_status == DigicertOrderStatus.CANCELLED:
            renewal_svc.update_order_status(db, order, new_status)
            renewal_svc.record_audit(db, order_id=order.id, event_type="CANCELLED")
            return

        if new_status == DigicertOrderStatus.ISSUED:
            # Descargar cert + chain
            cert_id_to_use = remote_cert_id or order.digicert_certificate_id
            if not cert_id_to_use:
                logger.error("[digicert] issued but no certificate_id order=%s", order.id)
                renewal_svc.update_order_status(
                    db, order, DigicertOrderStatus.FAILED, error_message="Issued without cert id"
                )
                return
            try:
                leaf_pem, chain_pem = digicert_service.download_certificate(
                    db, cert_id_to_use, format_type="pem_all"
                )
            except digicert_service.DigicertApiError as e:
                logger.error("[digicert] download failed order=%s: %s", order.id, e)
                poll_digicert_order_task.apply_async(
                    args=[order.id, attempt + 1],
                    countdown=_next_delay(attempt + 1),
                )
                return

            order.digicert_certificate_id = cert_id_to_use
            order.signed_cert_pem = leaf_pem
            order.chain_pem = chain_pem
            meta = _parse_cert_metadata(leaf_pem)
            for k, v in meta.items():
                setattr(order, k, v)
            renewal_svc.update_order_status(db, order, DigicertOrderStatus.ISSUED)
            renewal_svc.record_audit(
                db,
                order_id=order.id,
                event_type="ISSUED",
                metadata={"serial_number": meta.get("serial_number")},
            )
            # No hace auto-deploy. El usuario confirma manualmente via endpoint de deploy.
            return

        # Estados intermedios: sigue puleando
        renewal_svc.update_order_status(db, order, new_status)
        poll_digicert_order_task.apply_async(
            args=[order.id, attempt + 1],
            countdown=_next_delay(attempt + 1),
        )
    except SoftTimeLimitExceeded:
        logger.error("[digicert] poll soft-time-limit exceeded order=%s", order_row_id)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# approval_reminder_task
# ---------------------------------------------------------------------------

@celery_app.task(name="digicert.approval_reminder")
def approval_reminder_task(order_row_id: int):
    if not app_config.ENABLE_DIGICERT_RENEWAL:
        return

    db = SessionLocal()
    try:
        order = _load_order(db, order_row_id)
        if not order:
            return
        if order.status != DigicertOrderStatus.NEEDS_APPROVAL.value:
            return

        interval_hours = digicert_service.get_approval_reminder_interval_hours(db)
        now = datetime.utcnow()

        should_notify = True
        if order.last_approval_reminder_at:
            delta = now - order.last_approval_reminder_at
            if delta < timedelta(hours=interval_hours):
                should_notify = False

        if should_notify:
            approvers = digicert_service.get_approval_notify_emails(db)
            # Email no implementado en MVP. Se registra en audit y logs.
            logger.info(
                "[digicert] approval reminder order=%s approvers=%s interval=%sh",
                order.id,
                approvers,
                interval_hours,
            )
            order.last_approval_reminder_at = now
            db.commit()
            renewal_svc.record_audit(
                db,
                order_id=order.id,
                event_type="APPROVAL_REMINDER_SENT",
                metadata={"approvers_count": len(approvers)},
            )

        # Re-encola para el siguiente ciclo
        approval_reminder_task.apply_async(
            args=[order.id],
            countdown=int(interval_hours * 3600),
        )
    except SoftTimeLimitExceeded:
        logger.error("[digicert] reminder soft-time-limit exceeded order=%s", order_row_id)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# deploy_digicert_order_task
# ---------------------------------------------------------------------------

@celery_app.task(name="digicert.deploy_order", bind=True)
def deploy_digicert_order_task(self, order_row_id: int, device_ids: Optional[List[int]] = None):
    """
    Deploy a F5 reusando f5_service_logic.deploy_from_pem_and_update_profiles.

    Estrategia per-device:
    - Se itera device por device.
    - Si un device falla, se captura en deploy_results pero no aborta al resto.
    - Estado final:
        DEPLOYED si todos OK
        PARTIAL_DEPLOY si algunos OK y otros fail
        FAILED si todos fallaron
    """
    if not app_config.ENABLE_DIGICERT_RENEWAL:
        return

    db = SessionLocal()
    try:
        order = _load_order(db, order_row_id)
        if not order:
            logger.error("[digicert] deploy: order %s not found", order_row_id)
            return
        if order.status not in {
            DigicertOrderStatus.ISSUED.value,
            DigicertOrderStatus.DOWNLOADED.value,
            DigicertOrderStatus.PARTIAL_DEPLOY.value,
        }:
            logger.warning(
                "[digicert] deploy: order %s not in deployable state (%s)",
                order.id,
                order.status,
            )
            return
        if not order.signed_cert_pem or not order.encrypted_private_key:
            logger.error(
                "[digicert] deploy: order %s missing cert_pem or private_key",
                order.id,
            )
            renewal_svc.update_order_status(
                db, order, DigicertOrderStatus.FAILED, error_message="Missing key or cert"
            )
            return

        # Determinar devices destino
        cert: Optional[Certificate] = order.certificate
        if device_ids:
            devices = db.query(Device).filter(Device.id.in_(device_ids)).all()
        elif cert and cert.device_id:
            devices = [cert.device] if cert.device else []
        else:
            devices = []

        if not devices:
            logger.error("[digicert] deploy: no target devices for order %s", order.id)
            renewal_svc.update_order_status(
                db, order, DigicertOrderStatus.FAILED, error_message="No target devices"
            )
            return

        private_key_pem = renewal_svc.get_private_key_pem(order)
        if not private_key_pem:
            renewal_svc.update_order_status(
                db, order, DigicertOrderStatus.FAILED, error_message="Private key not available"
            )
            return

        renewal_svc.update_order_status(db, order, DigicertOrderStatus.DEPLOYING)
        renewal_svc.record_audit(
            db,
            order_id=order.id,
            event_type="DEPLOY_STARTED",
            metadata={"device_ids": [d.id for d in devices]},
        )

        # Cargar deploy_results previos si es retry
        results: dict = json.loads(order.deploy_results) if order.deploy_results else {}
        success_count = 0
        fail_count = 0

        for device in devices:
            device_key = str(device.id)
            # Skip devices ya exitosos en un retry
            prev = results.get(device_key, {})
            if prev.get("status") == "success":
                success_count += 1
                continue

            try:
                password = encryption_service.decrypt_data(device.encrypted_password) if device.encrypted_password else None
                if not password:
                    raise ValueError("Device has no credentials configured")

                # Reutiliza la función existente sin tocarla. Firma:
                # deploy_from_pem_and_update_profiles(hostname, username, password,
                #   old_cert_name, cert_pem, key_pem, chain_name=..., timeout=60)
                old_cert_name = cert.name if cert else order.common_name
                deploy_kwargs = dict(
                    hostname=device.ip_address or device.hostname,
                    username=device.username,
                    password=password,
                    old_cert_name=old_cert_name,
                    cert_pem=order.signed_cert_pem,
                    key_pem=private_key_pem,
                )
                chain_name_override = getattr(app_config, "DIGICERT_DEFAULT_CHAIN_NAME", None)
                if chain_name_override:
                    deploy_kwargs["chain_name"] = chain_name_override
                deploy_result = f5_service_logic.deploy_from_pem_and_update_profiles(**deploy_kwargs)
                results[device_key] = {
                    "status": "success",
                    "device_hostname": device.hostname,
                    "details": deploy_result if isinstance(deploy_result, dict) else None,
                    "timestamp": datetime.utcnow().isoformat(),
                }
                success_count += 1
                renewal_svc.record_audit(
                    db,
                    order_id=order.id,
                    event_type="DEPLOY_DEVICE_SUCCESS",
                    metadata={"device_id": device.id, "hostname": device.hostname},
                    commit=False,
                )
            except Exception as e:  # noqa: BLE001
                logger.exception("[digicert] deploy failed device=%s order=%s", device.id, order.id)
                results[device_key] = {
                    "status": "failed",
                    "device_hostname": device.hostname,
                    "error": str(e)[:500],
                    "timestamp": datetime.utcnow().isoformat(),
                }
                fail_count += 1
                renewal_svc.record_audit(
                    db,
                    order_id=order.id,
                    event_type="DEPLOY_DEVICE_FAILED",
                    metadata={"device_id": device.id, "hostname": device.hostname, "error": str(e)[:500]},
                    commit=False,
                )

            # Persistimos progreso tras cada device
            order.deploy_results = json.dumps(results)
            db.commit()

        # Estado final
        if fail_count == 0 and success_count > 0:
            order.deployed_at = datetime.utcnow()
            renewal_svc.update_order_status(db, order, DigicertOrderStatus.DEPLOYED)
            renewal_svc.record_audit(db, order_id=order.id, event_type="DEPLOY_COMPLETED")
        elif success_count > 0 and fail_count > 0:
            renewal_svc.update_order_status(
                db,
                order,
                DigicertOrderStatus.PARTIAL_DEPLOY,
                error_message=f"{fail_count} of {len(devices)} devices failed",
            )
            renewal_svc.record_audit(
                db,
                order_id=order.id,
                event_type="DEPLOY_COMPLETED",
                metadata={"partial": True, "success": success_count, "failed": fail_count},
            )
        else:
            renewal_svc.update_order_status(
                db,
                order,
                DigicertOrderStatus.FAILED,
                error_message="All devices failed to deploy",
            )
            renewal_svc.record_audit(
                db,
                order_id=order.id,
                event_type="DEPLOY_COMPLETED",
                metadata={"all_failed": True},
            )
    except SoftTimeLimitExceeded:
        logger.error("[digicert] deploy soft-time-limit exceeded order=%s", order_row_id)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# purge_deployed_private_keys_task (beat task)
# ---------------------------------------------------------------------------

@celery_app.task(name="digicert.purge_private_keys")
def purge_deployed_private_keys_task():
    """
    Recorre órdenes en estado DEPLOYED cuyas keys aún no han sido purgadas
    y purga aquellas cuya deployed_at + retention_days < now.
    """
    if not app_config.ENABLE_DIGICERT_RENEWAL:
        return

    retention_days = app_config.DIGICERT_PRIVATE_KEY_RETENTION_DAYS
    if retention_days <= 0:
        logger.info("[digicert] retention=%s: skip purge task", retention_days)
        return

    db = SessionLocal()
    try:
        threshold = datetime.utcnow() - timedelta(days=retention_days)
        candidates = (
            db.query(DigicertRenewalOrder)
            .filter(
                DigicertRenewalOrder.status == DigicertOrderStatus.DEPLOYED.value,
                DigicertRenewalOrder.encrypted_private_key.isnot(None),
                DigicertRenewalOrder.deployed_at.isnot(None),
                DigicertRenewalOrder.deployed_at < threshold,
            )
            .all()
        )
        for order in candidates:
            renewal_svc.purge_private_key(db, order, commit=False)
        if candidates:
            db.commit()
        logger.info("[digicert] purged %s private keys (retention=%sd)", len(candidates), retention_days)
    finally:
        db.close()
