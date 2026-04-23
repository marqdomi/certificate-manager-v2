# backend/services/digicert_service.py
"""
Cliente HTTP puro para DigiCert CertCentral API.

No toca la base de datos. La API key se lee desde SystemConfig (cifrada con Fernet)
o como fallback desde la variable de entorno DIGICERT_API_KEY.

Referencias:
- API docs: https://dev.digicert.com/en/certcentral-apis.html
- Header auth: X-DC-DEVKEY
- Status values (orden): pending | needs_approval | approved | rejected | issued | canceled | ...

Nunca loguea api_key ni csr_pem ni signed_cert_pem.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional, Tuple

import httpx
from sqlalchemy.orm import Session
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from core import config as app_config
from db.models import SystemConfig
from services import encryption_service

logger = logging.getLogger(__name__)

CONFIG_CATEGORY = "digicert"


class DigicertApiError(Exception):
    """Error genérico de API DigiCert. .status_code y .details si aplica."""

    def __init__(self, message: str, status_code: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


class DigicertRateLimitError(DigicertApiError):
    """429 Too Many Requests."""


class DigicertAuthError(DigicertApiError):
    """401/403."""


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

def _get_config_value(db: Session, key: str, *, decrypt: bool = False) -> Optional[str]:
    row = (
        db.query(SystemConfig)
        .filter(SystemConfig.category == CONFIG_CATEGORY, SystemConfig.key == key)
        .first()
    )
    if row is None or row.value is None:
        return None
    if decrypt and row.encrypted:
        try:
            return encryption_service.decrypt_data(row.value)
        except Exception as e:  # noqa: BLE001
            logger.error("[digicert] failed to decrypt config key=%s: %s", key, e)
            return None
    return row.value


def get_api_key(db: Session) -> Optional[str]:
    """Lee API key desde SystemConfig (preferido) o env fallback."""
    db_val = _get_config_value(db, "api_key", decrypt=True)
    if db_val:
        return db_val
    return os.getenv("DIGICERT_API_KEY")


def get_container_id(db: Session) -> Optional[str]:
    return _get_config_value(db, "container_id") or os.getenv("DIGICERT_CONTAINER_ID")


def get_organization_id(db: Session) -> Optional[str]:
    return _get_config_value(db, "organization_id") or os.getenv("DIGICERT_ORGANIZATION_ID")


def get_default_product(db: Session) -> str:
    return _get_config_value(db, "default_product") or os.getenv("DIGICERT_DEFAULT_PRODUCT", "ssl_plus")


def get_default_validity_years(db: Session) -> int:
    val = _get_config_value(db, "default_validity_years")
    return int(val) if val else 1


def get_default_key_size(db: Session) -> int:
    val = _get_config_value(db, "default_key_size")
    return int(val) if val else 2048


def get_approval_notify_emails(db: Session) -> List[str]:
    val = _get_config_value(db, "approval_notify_emails")
    if not val:
        return []
    return [e.strip() for e in val.split(",") if e.strip()]


def get_approval_reminder_interval_hours(db: Session) -> int:
    val = _get_config_value(db, "approval_reminder_interval_hours")
    return int(val) if val else app_config.DIGICERT_APPROVAL_REMINDER_INTERVAL_HOURS


# ---------------------------------------------------------------------------
# HTTP client
# ---------------------------------------------------------------------------

def _build_client(api_key: str) -> httpx.Client:
    return httpx.Client(
        base_url=app_config.DIGICERT_BASE_URL.rstrip("/"),
        headers={
            "X-DC-DEVKEY": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        timeout=app_config.DIGICERT_HTTP_TIMEOUT_SECONDS,
    )


def _handle_response(resp: httpx.Response) -> Any:
    if resp.status_code == 429:
        raise DigicertRateLimitError("DigiCert rate limit exceeded", status_code=429)
    if resp.status_code in (401, 403):
        raise DigicertAuthError(
            f"DigiCert authentication failed (HTTP {resp.status_code})",
            status_code=resp.status_code,
        )
    if resp.status_code >= 400:
        details: Dict[str, Any] = {}
        try:
            details = resp.json()
        except Exception:  # noqa: BLE001
            details = {"body": resp.text[:500]}
        raise DigicertApiError(
            f"DigiCert API error (HTTP {resp.status_code})",
            status_code=resp.status_code,
            details=details,
        )
    # Algunos endpoints de download devuelven bytes (PEM)
    ctype = resp.headers.get("content-type", "")
    if "application/json" in ctype:
        return resp.json() if resp.content else {}
    return resp.content


@retry(
    reraise=True,
    stop=stop_after_attempt(app_config.DIGICERT_MAX_RETRIES),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type((DigicertRateLimitError, httpx.TransportError)),
)
def _request(client: httpx.Client, method: str, path: str, **kwargs) -> Any:
    logger.info("[digicert] %s %s", method, path)
    resp = client.request(method, path, **kwargs)
    return _handle_response(resp)


# ---------------------------------------------------------------------------
# Public API: test & discovery
# ---------------------------------------------------------------------------

def test_connection(db: Session) -> Dict[str, Any]:
    api_key = get_api_key(db)
    if not api_key:
        raise DigicertApiError("No API key configured")
    with _build_client(api_key) as c:
        data = _request(c, "GET", "/user/me")
    return data if isinstance(data, dict) else {"ok": True}


def list_containers(db: Session) -> List[Dict[str, Any]]:
    api_key = _require_api_key(db)
    with _build_client(api_key) as c:
        data = _request(c, "GET", "/container")
    return data.get("containers", []) if isinstance(data, dict) else []


def list_organizations(db: Session, container_id: Optional[str] = None) -> List[Dict[str, Any]]:
    api_key = _require_api_key(db)
    params = {"container_id": container_id} if container_id else None
    with _build_client(api_key) as c:
        data = _request(c, "GET", "/organization", params=params)
    return data.get("organizations", []) if isinstance(data, dict) else []


def list_products(db: Session) -> List[Dict[str, Any]]:
    api_key = _require_api_key(db)
    with _build_client(api_key) as c:
        data = _request(c, "GET", "/product")
    return data.get("products", []) if isinstance(data, dict) else []


# ---------------------------------------------------------------------------
# Public API: orders
# ---------------------------------------------------------------------------

def submit_order(
    db: Session,
    *,
    product_name_id: str,
    csr_pem: str,
    common_name: str,
    san_list: Optional[List[str]] = None,
    validity_years: int = 1,
    organization_id: Optional[str] = None,
    container_id: Optional[str] = None,
    signature_hash: str = "sha256",
) -> Dict[str, Any]:
    """
    Envía una orden para `product_name_id` (p.ej. 'ssl_plus').
    Devuelve el JSON de respuesta con 'id' (order_id) y opcionalmente 'certificate_id'.

    Endpoint: POST /order/certificate/{product_name_id}
    """
    api_key = _require_api_key(db)
    payload: Dict[str, Any] = {
        "certificate": {
            "common_name": common_name,
            "csr": csr_pem,
            "signature_hash": signature_hash,
            "server_platform": {"id": 45},  # Other / Unknown; F5 maneja el material PEM directo
        },
        "validity_years": validity_years,
    }
    if san_list:
        payload["certificate"]["dns_names"] = list(san_list)
    if organization_id:
        payload["organization"] = {"id": int(organization_id)} if str(organization_id).isdigit() else {"id": organization_id}
    if container_id:
        payload["container"] = {"id": int(container_id)} if str(container_id).isdigit() else {"id": container_id}

    with _build_client(api_key) as c:
        return _request(c, "POST", f"/order/certificate/{product_name_id}", json=payload)


def get_order(db: Session, order_id: str) -> Dict[str, Any]:
    """GET /order/certificate/{order_id}"""
    api_key = _require_api_key(db)
    with _build_client(api_key) as c:
        return _request(c, "GET", f"/order/certificate/{order_id}")


def get_order_status(db: Session, order_id: str) -> Tuple[str, Optional[str]]:
    """Devuelve (status_string, certificate_id_if_any). status en lowercase: pending/issued/etc."""
    data = get_order(db, order_id)
    status = (data.get("status") or "").lower()
    cert_block = data.get("certificate") or {}
    cert_id = cert_block.get("id")
    return status, (str(cert_id) if cert_id else None)


def list_orders(
    db: Session,
    *,
    container_id: Optional[str] = None,
    status: Optional[str] = None,
    offset: int = 0,
    limit: int = 100,
) -> Dict[str, Any]:
    api_key = _require_api_key(db)
    params: Dict[str, Any] = {"offset": offset, "limit": limit}
    if container_id:
        params["container_id"] = container_id
    if status:
        params["status"] = status
    with _build_client(api_key) as c:
        return _request(c, "GET", "/order/certificate", params=params)


def cancel_order(db: Session, order_id: str, reason: str = "Cancelled from CMT") -> Dict[str, Any]:
    """PUT /order/certificate/{order_id}/status  body={status: 'CANCELED', note: ...}"""
    api_key = _require_api_key(db)
    with _build_client(api_key) as c:
        return _request(
            c,
            "PUT",
            f"/order/certificate/{order_id}/status",
            json={"status": "CANCELED", "note": reason},
        )


def get_order_history(db: Session, order_id: str) -> Dict[str, Any]:
    """GET /order/certificate/{order_id}/history"""
    api_key = _require_api_key(db)
    with _build_client(api_key) as c:
        return _request(c, "GET", f"/order/certificate/{order_id}/history")


# ---------------------------------------------------------------------------
# Public API: certificates
# ---------------------------------------------------------------------------

def get_certificate(db: Session, certificate_id: str) -> Dict[str, Any]:
    """GET /certificate/{certificate_id}"""
    api_key = _require_api_key(db)
    with _build_client(api_key) as c:
        return _request(c, "GET", f"/certificate/{certificate_id}")


def download_certificate(
    db: Session,
    certificate_id: str,
    *,
    format_type: str = "pem_all",
) -> Tuple[str, str]:
    """
    Descarga cert emitido.

    format_type:
      - 'pem_all'   -> leaf + chain (intermediate + root)
      - 'pem_noroot'-> leaf + chain sin root
      - 'pem_chain' -> solo chain
      - 'pem_issuer'-> solo intermediate

    Retorna (leaf_pem, chain_pem). Si el formato solo trae chain, leaf_pem será "".

    Endpoint: GET /certificate/{certificate_id}/download/format/{format_type}
    """
    api_key = _require_api_key(db)
    with _build_client(api_key) as c:
        data = _request(c, "GET", f"/certificate/{certificate_id}/download/format/{format_type}")

    if isinstance(data, bytes):
        text = data.decode("utf-8", errors="replace")
    elif isinstance(data, str):
        text = data
    elif isinstance(data, dict):
        # Algunos responses vienen wrapped en JSON
        text = data.get("certificate", "") or data.get("body", "")
    else:
        text = ""

    # Parsear: primer bloque = leaf, resto = chain
    leaf_pem, chain_pem = _split_leaf_and_chain(text)
    return leaf_pem, chain_pem


def _split_leaf_and_chain(pem_bundle: str) -> Tuple[str, str]:
    begin = "-----BEGIN CERTIFICATE-----"
    end = "-----END CERTIFICATE-----"
    blocks: List[str] = []
    cursor = 0
    while True:
        start_idx = pem_bundle.find(begin, cursor)
        if start_idx == -1:
            break
        end_idx = pem_bundle.find(end, start_idx)
        if end_idx == -1:
            break
        end_idx += len(end)
        blocks.append(pem_bundle[start_idx:end_idx].strip())
        cursor = end_idx
    if not blocks:
        return "", ""
    leaf = blocks[0] + "\n"
    chain = ("\n".join(blocks[1:]) + "\n") if len(blocks) > 1 else ""
    return leaf, chain


def revoke_certificate(db: Session, certificate_id: str, reason: str = "Revoked from CMT") -> Dict[str, Any]:
    """PUT /certificate/{certificate_id}/revoke"""
    api_key = _require_api_key(db)
    with _build_client(api_key) as c:
        return _request(c, "PUT", f"/certificate/{certificate_id}/revoke", json={"comments": reason})


def reissue_order(
    db: Session,
    *,
    order_id: str,
    csr_pem: str,
    common_name: str,
    san_list: Optional[List[str]] = None,
    signature_hash: str = "sha256",
) -> Dict[str, Any]:
    """POST /order/certificate/{order_id}/reissue"""
    api_key = _require_api_key(db)
    payload: Dict[str, Any] = {
        "certificate": {
            "common_name": common_name,
            "csr": csr_pem,
            "signature_hash": signature_hash,
        }
    }
    if san_list:
        payload["certificate"]["dns_names"] = list(san_list)
    with _build_client(api_key) as c:
        return _request(c, "POST", f"/order/certificate/{order_id}/reissue", json=payload)


# ---------------------------------------------------------------------------
# DCV
# ---------------------------------------------------------------------------

def get_order_dcv(db: Session, order_id: str) -> Dict[str, Any]:
    """GET /order/certificate/{order_id}/dcv/tokens (puede variar según producto/API)."""
    api_key = _require_api_key(db)
    with _build_client(api_key) as c:
        return _request(c, "GET", f"/order/certificate/{order_id}/dcv/tokens")


def check_dcv(db: Session, order_id: str) -> Dict[str, Any]:
    """POST /order/certificate/{order_id}/check-dcv  — fuerza recheck desde DigiCert."""
    api_key = _require_api_key(db)
    with _build_client(api_key) as c:
        return _request(c, "POST", f"/order/certificate/{order_id}/check-dcv")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_api_key(db: Session) -> str:
    key = get_api_key(db)
    if not key:
        raise DigicertApiError("DigiCert API key not configured")
    return key
