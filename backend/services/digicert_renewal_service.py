# backend/services/digicert_renewal_service.py
"""
Orquestación de renovaciones DigiCert.

Maneja:
- Generación de keypair (RSA) y CSR por renovación (key rotation automática).
- Creación/búsqueda de DigicertRenewalOrder con idempotencia.
- Transiciones de estado con mapeo DigiCert status -> DigicertOrderStatus local.
- Descarga de cert emitido y parseo de metadata.
- Deploy a F5 reutilizando f5_service_logic (per-device con rollback logic).
- Audit log interno (DigicertRenewalAuditLog).

NO implementa Celery tasks (ver digicert_tasks.py).
NO llama directamente a DigiCert HTTP; usa digicert_service.
"""
from __future__ import annotations

import json
import logging
import secrets
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from sqlalchemy.orm import Session

from core import config as app_config
from db.models import (
    DIGICERT_ACTIVE_STATUSES,
    Certificate,
    DigicertOrderStatus,
    DigicertRenewalAuditLog,
    DigicertRenewalOrder,
)
from services import digicert_service, encryption_service

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# DigiCert status mapping
# ---------------------------------------------------------------------------

# Mapeo de status DigiCert (string) -> DigicertOrderStatus local.
# Los valores string de DigiCert vienen en lowercase según la API.
DIGICERT_STATUS_MAP: Dict[str, DigicertOrderStatus] = {
    "pending": DigicertOrderStatus.SUBMITTED,
    "needs_approval": DigicertOrderStatus.NEEDS_APPROVAL,
    "awaiting_approval": DigicertOrderStatus.NEEDS_APPROVAL,
    "approved": DigicertOrderStatus.PENDING_VALIDATION,
    "rejected": DigicertOrderStatus.APPROVAL_REJECTED,
    "issued": DigicertOrderStatus.ISSUED,
    "canceled": DigicertOrderStatus.CANCELLED,
    "cancelled": DigicertOrderStatus.CANCELLED,
    "expired": DigicertOrderStatus.FAILED,
    "revoked": DigicertOrderStatus.FAILED,
}


def map_digicert_status(remote_status: str, *, has_dcv_pending: bool = False) -> DigicertOrderStatus:
    s = (remote_status or "").lower()
    if has_dcv_pending and s == "pending":
        return DigicertOrderStatus.PENDING_DCV
    return DIGICERT_STATUS_MAP.get(s, DigicertOrderStatus.SUBMITTED)


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

def record_audit(
    db: Session,
    *,
    order_id: int,
    event_type: str,
    username: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    commit: bool = True,
) -> DigicertRenewalAuditLog:
    """Agrega un evento al audit log interno. Nunca incluir secretos en metadata."""
    entry = DigicertRenewalAuditLog(
        order_id=order_id,
        event_type=event_type,
        username=username,
        event_metadata=json.dumps(metadata) if metadata else None,
    )
    db.add(entry)
    if commit:
        db.commit()
        db.refresh(entry)
    return entry


# ---------------------------------------------------------------------------
# Crypto: keypair + CSR
# ---------------------------------------------------------------------------

def generate_keypair_and_csr(
    common_name: str,
    san_list: Optional[List[str]] = None,
    key_size: int = 2048,
) -> Tuple[str, str]:
    """
    Genera una RSA private key nueva y un CSR X.509 SHA256.
    Retorna (private_key_pem, csr_pem). Key rotation por renovación
    (alineado con ACME / cert-manager / NIST SP 800-57).
    """
    if key_size < 2048:
        raise ValueError("key_size debe ser >= 2048")

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=key_size)

    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, common_name)])
    builder = x509.CertificateSigningRequestBuilder().subject_name(subject)

    if san_list:
        san_objects = [x509.DNSName(s) for s in san_list if s]
        if san_objects:
            builder = builder.add_extension(
                x509.SubjectAlternativeName(san_objects),
                critical=False,
            )

    csr = builder.sign(private_key, hashes.SHA256())

    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    csr_pem = csr.public_bytes(serialization.Encoding.PEM).decode("utf-8")
    return private_key_pem, csr_pem


# ---------------------------------------------------------------------------
# Precheck / preview
# ---------------------------------------------------------------------------

def _current_sans_from_certificate(cert: Certificate) -> List[str]:
    """Best-effort: devuelve SANs del cert actual. Si no hay info estructurada,
    devuelve solo el CN."""
    cn = cert.common_name or cert.name or ""
    return [cn] if cn else []


def precheck(db: Session, certificate_id: int, product: Optional[str] = None) -> Dict[str, Any]:
    cert = db.query(Certificate).filter(Certificate.id == certificate_id).first()
    if not cert:
        raise ValueError(f"Certificate {certificate_id} not found")

    days_to_exp: Optional[int] = None
    early = False
    if cert.expiration_date:
        delta = (cert.expiration_date - datetime.utcnow()).days
        days_to_exp = delta
        if delta > app_config.DIGICERT_EARLY_RENEWAL_WARNING_DAYS:
            early = True

    # Approval: heurística simple. Hoy asumimos que la info real llega de DigiCert al enviar.
    # Si la cuenta/container configurado indica que requiere aprobación, se marcará.
    approval_required = False
    approvers: List[str] = digicert_service.get_approval_notify_emails(db)

    return {
        "certificate_id": cert.id,
        "common_name": cert.common_name or cert.name,
        "current_sans": _current_sans_from_certificate(cert),
        "approval_required": approval_required,
        "approvers": approvers,
        "early_renewal_warning": early,
        "days_until_expiration": days_to_exp,
        "new_sans_detected": [],
        "dcv_hint": None,
    }


def preview(
    db: Session,
    certificate_id: int,
    *,
    san_list: Optional[List[str]] = None,
    validity_years: Optional[int] = None,
    product: Optional[str] = None,
    organization_id: Optional[str] = None,
    container_id: Optional[str] = None,
    key_size: Optional[int] = None,
) -> Dict[str, Any]:
    cert = db.query(Certificate).filter(Certificate.id == certificate_id).first()
    if not cert:
        raise ValueError(f"Certificate {certificate_id} not found")

    effective_sans = san_list if san_list else _current_sans_from_certificate(cert)
    pre = precheck(db, certificate_id, product=product)

    return {
        "certificate_id": cert.id,
        "common_name": cert.common_name or cert.name,
        "san_list": effective_sans,
        "validity_years": validity_years or digicert_service.get_default_validity_years(db),
        "product": product or digicert_service.get_default_product(db),
        "organization_id": organization_id or digicert_service.get_organization_id(db),
        "container_id": container_id or digicert_service.get_container_id(db),
        "key_size": key_size or digicert_service.get_default_key_size(db),
        "approval_required": pre["approval_required"],
        "quota_consumed": 1,
        "early_renewal_warning": pre["early_renewal_warning"],
    }


# ---------------------------------------------------------------------------
# Initiate renewal (crea orden en DB; Celery task se encarga del submit async)
# ---------------------------------------------------------------------------

def _has_active_order(db: Session, certificate_id: int) -> Optional[DigicertRenewalOrder]:
    return (
        db.query(DigicertRenewalOrder)
        .filter(
            DigicertRenewalOrder.certificate_id == certificate_id,
            DigicertRenewalOrder.status.in_(list(DIGICERT_ACTIVE_STATUSES)),
        )
        .first()
    )


def _find_by_idempotency(
    db: Session, certificate_id: int, idempotency_key: str
) -> Optional[DigicertRenewalOrder]:
    return (
        db.query(DigicertRenewalOrder)
        .filter(
            DigicertRenewalOrder.certificate_id == certificate_id,
            DigicertRenewalOrder.idempotency_key == idempotency_key,
        )
        .first()
    )


def initiate_renewal(
    db: Session,
    *,
    certificate_id: int,
    created_by: Optional[str] = None,
    san_list: Optional[List[str]] = None,
    validity_years: Optional[int] = None,
    product: Optional[str] = None,
    organization_id: Optional[str] = None,
    container_id: Optional[str] = None,
    key_size: Optional[int] = None,
    idempotency_key: Optional[str] = None,
) -> Tuple[DigicertRenewalOrder, bool]:
    """
    Crea una orden DigicertRenewalOrder en estado PENDING_SUBMIT.
    Devuelve (order, created) donde created=False si fue retornada por idempotency
    o ya existía una orden activa para el cert.

    No llama a la API DigiCert; ese paso lo hace submit_digicert_order_task (Celery).
    """
    if not app_config.ENABLE_DIGICERT_RENEWAL:
        raise RuntimeError("DigiCert renewal module is disabled (ENABLE_DIGICERT_RENEWAL=false)")

    cert = db.query(Certificate).filter(Certificate.id == certificate_id).first()
    if not cert:
        raise ValueError(f"Certificate {certificate_id} not found")

    # Idempotency: si viene key y ya existe una orden con esa combinación, devolverla.
    if idempotency_key:
        existing = _find_by_idempotency(db, certificate_id, idempotency_key)
        if existing:
            return existing, False

    # Si ya hay una orden activa (no terminal) para este cert, no se permite otra.
    active = _has_active_order(db, certificate_id)
    if active:
        return active, False

    effective_cn = cert.common_name or cert.name
    effective_sans = list(san_list) if san_list else _current_sans_from_certificate(cert)
    effective_validity = validity_years or digicert_service.get_default_validity_years(db)
    effective_product = product or digicert_service.get_default_product(db)
    effective_org = organization_id or digicert_service.get_organization_id(db)
    effective_container = container_id or digicert_service.get_container_id(db)
    effective_key_size = key_size or digicert_service.get_default_key_size(db)

    # Generar keypair + CSR
    private_key_pem, csr_pem = generate_keypair_and_csr(
        common_name=effective_cn,
        san_list=effective_sans,
        key_size=effective_key_size,
    )
    encrypted_key = encryption_service.encrypt_data(private_key_pem)

    order = DigicertRenewalOrder(
        certificate_id=certificate_id,
        status=DigicertOrderStatus.PENDING_SUBMIT.value,
        csr_pem=csr_pem,
        encrypted_private_key=encrypted_key,
        key_size=effective_key_size,
        common_name=effective_cn,
        san_list=json.dumps(effective_sans) if effective_sans else None,
        validity_years=effective_validity,
        product=effective_product,
        container_id=str(effective_container) if effective_container else None,
        organization_id=str(effective_org) if effective_org else None,
        idempotency_key=idempotency_key or secrets.token_hex(16),
        created_by=created_by,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    record_audit(
        db,
        order_id=order.id,
        event_type="INITIATED",
        username=created_by,
        metadata={
            "common_name": effective_cn,
            "sans": effective_sans,
            "validity_years": effective_validity,
            "product": effective_product,
        },
    )

    logger.info(
        "[digicert] renewal initiated order_id=%s cert_id=%s cn=%s",
        order.id,
        certificate_id,
        effective_cn,
    )
    return order, True


# ---------------------------------------------------------------------------
# State helpers
# ---------------------------------------------------------------------------

def update_order_status(
    db: Session,
    order: DigicertRenewalOrder,
    new_status: DigicertOrderStatus,
    *,
    error_message: Optional[str] = None,
    commit: bool = True,
) -> None:
    order.status = new_status.value
    if error_message is not None:
        order.error_message = error_message
    order.updated_at = datetime.utcnow()
    if commit:
        db.commit()
        db.refresh(order)


def get_private_key_pem(order: DigicertRenewalOrder) -> Optional[str]:
    """Desencripta y devuelve el PEM de la private key. None si ya fue purgada."""
    if not order.encrypted_private_key:
        return None
    return encryption_service.decrypt_data(order.encrypted_private_key)


def purge_private_key(db: Session, order: DigicertRenewalOrder, *, commit: bool = True) -> None:
    order.encrypted_private_key = None
    order.private_key_purged_at = datetime.utcnow()
    record_audit(db, order_id=order.id, event_type="KEY_PURGED", commit=False)
    if commit:
        db.commit()


# ---------------------------------------------------------------------------
# Serialization helpers (schemas)
# ---------------------------------------------------------------------------

def order_to_dict(order: DigicertRenewalOrder) -> Dict[str, Any]:
    return {
        "id": order.id,
        "certificate_id": order.certificate_id,
        "status": order.status,
        "digicert_order_id": order.digicert_order_id,
        "digicert_certificate_id": order.digicert_certificate_id,
        "common_name": order.common_name,
        "san_list": json.loads(order.san_list) if order.san_list else [],
        "validity_years": order.validity_years,
        "product": order.product,
        "container_id": order.container_id,
        "organization_id": order.organization_id,
        "key_size": order.key_size,
        "serial_number": order.serial_number,
        "thumbprint": order.thumbprint,
        "valid_from": order.valid_from,
        "valid_till": order.valid_till,
        "approval_required": order.approval_required,
        "approval_detected_at": order.approval_detected_at,
        "last_approval_reminder_at": order.last_approval_reminder_at,
        "dcv_method": order.dcv_method,
        "dcv_completed_at": order.dcv_completed_at,
        "deploy_results": json.loads(order.deploy_results) if order.deploy_results else None,
        "deployed_at": order.deployed_at,
        "error_message": order.error_message,
        "private_key_purged_at": order.private_key_purged_at,
        "created_at": order.created_at,
        "updated_at": order.updated_at,
        "created_by": order.created_by,
    }
