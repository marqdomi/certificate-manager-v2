from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from sqlalchemy.orm import Session
from db.base import SessionLocal
from db.models import Device
from services.encryption_service import decrypt_data
from services.credential_resolver import resolve_credentials, get_credential_summary
from services import f5_service_logic
from typing import Optional, List

import os
from requests.exceptions import ConnectionError as RequestsConnectionError, ReadTimeout as RequestsReadTimeout

router = APIRouter(prefix="/f5", tags=["f5"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/credential-config")
def get_credential_config():
    """
    Returns the current fallback credential configuration (without passwords).
    Useful for diagnostics and verifying setup.
    """
    return get_credential_summary()


@router.get("/impact-preview")
def impact_preview(
    device_id: Optional[int] = Query(None, description="ID del device a consultar (opcional)"),
    device_hostname: Optional[str] = Query(None, description="Hostname del device (fallback si no hay ID)"),
    cert_name: str = Query(..., description="CN o nombre del objeto de certificado en F5"),
    timeout: int = Query(10, ge=1, le=60, description="Timeout en segundos (por llamada)"),
    db: Session = Depends(get_db)
):
    """
    Impact Preview (live): devuelve los SSL Profiles que referencian el certificado en el device indicado.
    Uses credential resolver with fallback support.
    """
    # --- 1) Resolver el device por ID o por hostname ---
    device: Optional[Device] = None
    try:
        if device_id is not None:
            device = db.get(Device, device_id)
    except Exception:
        device = None

    if device is None and device_hostname:
        device = db.query(Device).filter(Device.hostname == device_hostname).first()

    if device is None:
        return {
            "device": None,
            "profiles": [],
            "error": f"Device not found (id={device_id}, hostname={device_hostname})"
        }

    # --- 2) Resolve credentials using fallback chain ---
    credentials = resolve_credentials(device)
    
    if not credentials:
        return {
            "device": {
                "id": device.id,
                "hostname": device.hostname,
                "ip_address": device.ip_address,
                "site": device.site,
            },
            "profiles": [],
            "error": "No credentials available (device has none, and no fallback configured)"
        }
    
    username = credentials.username
    password = credentials.password
    cred_source = credentials.source

    # --- 3) Llamada live al F5 (con fallback IP/hostname controlado por env) ---
    # Fallback control:
    #   F5_CONNECT_FALLBACK=1    -> probar host alterno si falla conexión
    #   F5_CONNECT_ORDER=hostname_first -> intenta hostname y luego IP
    #
    # Siempre preferimos IP por defecto (robusto cuando DNS falla).
    try_hosts = []
    order = (os.getenv("F5_CONNECT_ORDER") or "").lower().strip()
    if order == "hostname_first":
        try_hosts = [device.hostname, device.ip_address]
    else:
        try_hosts = [device.ip_address, device.hostname]

    enable_fallback = (os.getenv("F5_CONNECT_FALLBACK") or "1").strip() not in ("0", "false", "False")

    last_err = None
    usage = None

    for idx, host_candidate in enumerate(try_hosts):
        if not host_candidate:
            continue
        try:
            usage = f5_service_logic.get_certificate_usage(
                hostname=host_candidate,
                username=username,
                password=password,
                cert_name=cert_name,
                partition="Common"
            )
            # Éxito: dejamos de intentar siguientes
            break
        except (RequestsConnectionError, RequestsReadTimeout) as e:
            last_err = e
            # si no hay fallback o ya probamos el último, salimos
            if not enable_fallback or idx == len(try_hosts) - 1:
                raise
            # si hay fallback, seguimos al siguiente host
            continue
        except Exception as e:
            # Errores lógicos (auth/SSL/HTTP) no intentan fallback; devolvemos el error
            last_err = e
            raise

    # Si llegamos aquí y no hubo excepción, devolvemos la respuesta transformada
    profiles = []
    profile_fullpaths = usage.get("profiles", []) if usage else []
    virtual_servers = usage.get("virtual_servers", []) if usage else []

    for pf in profile_fullpaths:
        # Parse partition and name from fullPath (e.g. /Common/profilename)
        parts = pf.split("/")
        partition = "Common"
        name = pf
        if len(parts) >= 3:
            partition = parts[1] or "Common"
            name = parts[2]
        context = "clientside"
        # Find VS that reference this profile
        vips = []
        for vs in virtual_servers:
            if "profiles" in vs and pf in vs["profiles"]:
                vips.append(vs["name"])
        profiles.append({
            "name": name,
            "partition": partition,
            "context": context,
            "vips": vips
        })

    return {
        "device": {
            "id": device.id,
            "hostname": device.hostname,
            "ip_address": device.ip_address,
            "site": device.site,
        },
        "profiles": profiles,
        "error": None
    }


# --- New endpoint: queue_scan_all ---
@router.post("/scan-all", status_code=status.HTTP_202_ACCEPTED,
             summary="Queue scans for all devices (or a subset)")
def queue_scan_all(
    payload: dict | None = Body(
        None,
        description="Optional: { device_ids: [int], limit: int, batch_size: int }"
    ),
):
    """
    Encola un *scan_single_f5* por cada dispositivo.
    Frontend llama: POST /api/v1/f5/scan-all con JSON opcional:
      {"device_ids":[1,2,3], "limit": 50, "batch_size": 0}
    """
    from core.celery_worker import celery_app

    device_ids = None
    limit: Optional[int] = None
    batch_size = 0
    if isinstance(payload, dict):
        device_ids = payload.get("device_ids")
        limit = payload.get("limit")
        batch_size = payload.get("batch_size", 0)

    async_result = celery_app.send_task(
        "trigger_scan_for_all_devices_task",
        kwargs={
            "device_ids": device_ids,
            "limit": limit,
            "batch_size": batch_size,
        },
    )
    return {"queued": True, "task_id": async_result.id}