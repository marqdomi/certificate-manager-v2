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


# -------------------------------------------------------------------
# HOST SEARCH - Search for hostnames across F5 devices
# -------------------------------------------------------------------

from pydantic import BaseModel

class HostSearchRequest(BaseModel):
    search_terms: List[str]
    device_ids: Optional[List[int]] = None  # None = search all devices
    case_sensitive: bool = False

class HostSearchResultItem(BaseModel):
    device_id: int
    device_hostname: str
    device_ip: str
    site: Optional[str] = None
    virtual_servers: List[dict] = []
    pools: List[dict] = []
    pool_members: List[dict] = []
    nodes: List[dict] = []
    irules: List[dict] = []
    data_groups: List[dict] = []
    total_matches: int = 0
    error: Optional[str] = None

class HostSearchResponse(BaseModel):
    search_terms: List[str]
    devices_searched: int
    devices_with_matches: int
    total_matches: int
    results: List[HostSearchResultItem]


class HostSearchAsyncResponse(BaseModel):
    """Response for async host search - returns task_id for polling"""
    task_id: str
    message: str
    devices_to_search: int


@router.post("/host-search", response_model=HostSearchResponse)
def search_hosts_across_devices(
    request: HostSearchRequest,
    db: Session = Depends(get_db)
):
    """
    Search for hostnames/IPs across all or selected F5 devices using parallel execution.
    Searches in Virtual Servers, Pools, Pool Members, Nodes, iRules, and Data Groups.
    
    OPTIMIZED: Uses Celery workers to search devices in parallel for faster results.
    
    Useful for decommissioning tasks where you need to find all references to specific servers.
    """
    from services.credential_resolver import resolve_credentials
    from concurrent.futures import ThreadPoolExecutor, as_completed
    
    # Clean and validate search terms
    search_terms = [term.strip() for term in request.search_terms if term.strip()]
    if not search_terms:
        raise HTTPException(status_code=400, detail="No valid search terms provided")
    
    if len(search_terms) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 search terms allowed")
    
    # Get devices to search
    query = db.query(Device)
    if request.device_ids:
        query = query.filter(Device.id.in_(request.device_ids))
    
    devices = query.all()
    
    if not devices:
        raise HTTPException(status_code=404, detail="No devices found")
    
    # Build device configs with credentials
    device_configs = []
    no_credential_results = []
    
    for device in devices:
        credentials = resolve_credentials(device)
        if not credentials:
            no_credential_results.append(HostSearchResultItem(
                device_id=device.id,
                device_hostname=device.hostname,
                device_ip=device.ip_address,
                site=device.site,
                error="No credentials available"
            ))
            continue
        
        device_configs.append({
            'device_id': device.id,
            'device_hostname': device.hostname,
            'device_ip': device.ip_address,
            'device_site': device.site,
            'username': credentials.username,
            'password': credentials.password
        })
    
    # If no devices with credentials, return early
    if not device_configs:
        return HostSearchResponse(
            search_terms=search_terms,
            devices_searched=len(devices),
            devices_with_matches=0,
            total_matches=0,
            results=no_credential_results
        )
    
    # Function to search a single device
    def search_device(config):
        try:
            device_results = f5_service_logic.search_hosts_on_device(
                hostname=config['device_ip'],
                username=config['username'],
                password=config['password'],
                search_terms=search_terms,
                case_sensitive=request.case_sensitive
            )
            
            device_match_count = (
                len(device_results.get("virtual_servers", [])) +
                len(device_results.get("pools", [])) +
                len(device_results.get("pool_members", [])) +
                len(device_results.get("nodes", [])) +
                len(device_results.get("irules", [])) +
                len(device_results.get("data_groups", []))
            )
            
            return HostSearchResultItem(
                device_id=config['device_id'],
                device_hostname=config['device_hostname'],
                device_ip=config['device_ip'],
                site=config['device_site'],
                virtual_servers=device_results.get("virtual_servers", []),
                pools=device_results.get("pools", []),
                pool_members=device_results.get("pool_members", []),
                nodes=device_results.get("nodes", []),
                irules=device_results.get("irules", []),
                data_groups=device_results.get("data_groups", []),
                total_matches=device_match_count,
                error=device_results.get("error")
            )
        except Exception as e:
            return HostSearchResultItem(
                device_id=config['device_id'],
                device_hostname=config['device_hostname'],
                device_ip=config['device_ip'],
                site=config['device_site'],
                error=str(e)
            )
    
    # Execute searches in parallel using ThreadPoolExecutor
    # Max 10 concurrent connections to avoid overwhelming F5 devices
    results = list(no_credential_results)
    max_workers = min(10, len(device_configs))
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_device = {executor.submit(search_device, cfg): cfg for cfg in device_configs}
        for future in as_completed(future_to_device, timeout=300):  # 5 minutes total
            try:
                result = future.result(timeout=120)  # 2 minutes per device
                results.append(result)
            except Exception as e:
                cfg = future_to_device[future]
                results.append(HostSearchResultItem(
                    device_id=cfg['device_id'],
                    device_hostname=cfg['device_hostname'],
                    device_ip=cfg['device_ip'],
                    site=cfg['device_site'],
                    error=f"Timeout or error: {str(e)}"
                ))
    
    # Calculate totals
    devices_with_matches = sum(1 for r in results if r.total_matches > 0)
    total_matches = sum(r.total_matches for r in results)
    
    # Sort results: devices with matches first, then by match count
    results.sort(key=lambda x: (-x.total_matches, x.device_hostname))
    
    return HostSearchResponse(
        search_terms=search_terms,
        devices_searched=len(devices),
        devices_with_matches=devices_with_matches,
        total_matches=total_matches,
        results=results
    )


@router.post("/host-search/async", response_model=HostSearchAsyncResponse)
def search_hosts_async(
    request: HostSearchRequest,
    db: Session = Depends(get_db)
):
    """
    Start an async host search across F5 devices using Celery workers.
    Returns a task_id that can be polled for results.
    
    Use this endpoint for large searches across many devices.
    """
    from services.credential_resolver import resolve_credentials
    from core.celery_worker import hostsearch_search_bulk
    
    # Clean and validate search terms
    search_terms = [term.strip() for term in request.search_terms if term.strip()]
    if not search_terms:
        raise HTTPException(status_code=400, detail="No valid search terms provided")
    
    if len(search_terms) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 search terms allowed")
    
    # Get devices to search
    query = db.query(Device)
    if request.device_ids:
        query = query.filter(Device.id.in_(request.device_ids))
    
    devices = query.all()
    
    if not devices:
        raise HTTPException(status_code=404, detail="No devices found")
    
    # Build device configs with credentials
    device_configs = []
    for device in devices:
        credentials = resolve_credentials(device)
        if credentials:
            device_configs.append({
                'device_id': device.id,
                'hostname': device.hostname,
                'ip': device.ip_address,
                'site': device.site,
                'username': credentials.username,
                'password': credentials.password
            })
    
    if not device_configs:
        raise HTTPException(status_code=400, detail="No devices with valid credentials found")
    
    # Submit to Celery
    task = hostsearch_search_bulk.delay(
        device_configs=device_configs,
        search_terms=search_terms,
        case_sensitive=request.case_sensitive
    )
    
    return HostSearchAsyncResponse(
        task_id=task.id,
        message="Host search started in background",
        devices_to_search=len(device_configs)
    )


@router.get("/host-search/status/{task_id}")
def get_host_search_status(task_id: str):
    """
    Get the status and results of an async host search task.
    """
    from celery.result import AsyncResult
    from core.celery_worker import celery_app
    
    result = AsyncResult(task_id, app=celery_app)
    
    if result.state == 'PENDING':
        return {"status": "pending", "message": "Task is waiting to start"}
    elif result.state == 'STARTED':
        return {"status": "running", "message": "Task is running"}
    elif result.state == 'SUCCESS':
        return {"status": "completed", "results": result.result}
    elif result.state == 'FAILURE':
        return {"status": "failed", "error": str(result.info)}
    else:
        return {"status": result.state, "message": "Unknown state"}