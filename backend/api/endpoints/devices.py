# backend/api/endpoints/devices.py

from fastapi import APIRouter, Depends, Query, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List
from pydantic import BaseModel

from db.base import get_db
from db.models import Device, Certificate, User, UserRole
from schemas.device import DeviceResponse
from services import encryption_service, auth_service
from services import f5_service_logic
from schemas.certificate import CertificateResponse

router = APIRouter()

# --- WebSocket notification helper ---
async def _notify_ws(event_type: str, device_id: int = None, data: dict = None):
    """Helper to send WebSocket notifications."""
    try:
        from api.endpoints.websocket import notify_device_change
        await notify_device_change(event_type, device_id, data)
    except Exception as e:
        # Don't fail the main operation if WS notification fails
        pass

def notify_device_event(background_tasks: BackgroundTasks, event_type: str, device_id: int = None, data: dict = None):
    """Schedule a WebSocket notification in the background."""
    import asyncio
    async def _send():
        await _notify_ws(event_type, device_id, data)
    background_tasks.add_task(asyncio.run, _send())

# --- Schemas para la data de entrada ---
class DeviceCreate(BaseModel):
    hostname: str
    ip_address: str
    site: str | None = None
    version: str | None = None
    cluster_key: str | None = None
    is_primary_preferred: bool | None = False

class DeviceCredentialsUpdate(BaseModel):
    username: str
    password: str

class DeviceUpdate(BaseModel):
    hostname: str | None = None
    ip_address: str | None = None
    site: str | None = None
    cluster_key: str | None = None
    is_primary_preferred: bool | None = None
    active: bool | None = None

# --- Endpoints Protegidos ---

@router.get("/", response_model=List[DeviceResponse])
def get_all_devices(
    db: Session = Depends(get_db),
    search: str | None = Query(default=None),
    only_active: bool = Query(default=False),
    only_in_sync: bool = Query(default=False),
    only_primary: bool = Query(default=False),  # ACTIVE
    current_user: User = Depends(auth_service.get_current_active_user),
    only_preferred_primary: bool = Query(default=False),
    primaries_only: bool = Query(default=False),
    distinct_clusters: bool = Query(default=False),
):
    query = db.query(Device)

    if search:
        term = f"%{search}%"
        query = query.filter(or_(Device.hostname.ilike(term), Device.ip_address.ilike(term)))

    if only_active:
        query = query.filter(Device.active.is_(True))
    if only_in_sync:
        query = query.filter(Device.sync_status == "In Sync")
    if only_primary:
        query = query.filter(Device.ha_state == "ACTIVE")
    if only_preferred_primary:
        query = query.filter(Device.is_primary_preferred.is_(True))
    if primaries_only:
        query = query.filter(Device.is_primary_preferred.is_(True))
    devices = query.order_by(Device.hostname.asc()).all()

    if distinct_clusters:
        # Agrupar por cluster_key y devolver solo un device por cluster (el primario si hay)
        clusters = {}
        for dev in devices:
            key = dev.cluster_key or dev.hostname
            if key not in clusters:
                clusters[key] = dev
            else:
                # Si ya hay uno, preferimos el primario
                if getattr(dev, "is_primary_preferred", False):
                    # Si el nuevo es primario y el guardado no, lo reemplazamos
                    if not getattr(clusters[key], "is_primary_preferred", False):
                        clusters[key] = dev
        devices = list(clusters.values())
    return devices

# --- Endpoint para auto-asignar cluster_key e is_primary_preferred ---
import re
from fastapi import status


def _derive_cluster_key(hostname: str) -> str:
    """
    Derive a cluster key from an F5 hostname to group HA pairs.

    Handles multiple naming conventions:
      New format:    eudc01-lb-001-black.network.axadmin.net  →  eudc01-lb-black
      Legacy format: USDC01-LB02-BLACK-SEC.solera.farm        →  usdc01-lb-black
      With fab:      usdc01-fab1-lb-001-black-nonprod.net     →  usdc01-lb-black-nonprod
      Bare chassis:  usdc01-fab1-lb-001.network.axadmin.net   →  usdc01-lb
      Old Russian:   axrudc10lb150.network.axadmin.net        →  axrudc10lb
      Omnitracs:     dc1-f5-xrs-prod-01.mgmt.omnitracs.com   →  dc1-f5-xrs-prod
      AWS standalone: ip-10-32-0-115.monitor.smartdrive...    →  ip-10-32-0-115
    """
    h = hostname.lower().strip()

    # 1. Strip domain (everything after first dot)
    dot_idx = h.find('.')
    if dot_idx > 0:
        h = h[:dot_idx]

    # 2. Remove HA role suffix: -pri, -sec
    h = re.sub(r'-(pri|sec)$', '', h)

    # 3. Remove fabric identifier (e.g., -fab1-) to normalize across naming conventions
    h = re.sub(r'-fab\d+-', '-', h)

    # 4. Normalize lb instance numbers to group HA pairs:
    #    -lb-001, -lb-002 → -lb   (new format: eudc01-lb-001-black)
    #    -lb01,  -lb02    → -lb   (legacy format: USDC01-LB01-BLUE)
    h = re.sub(r'(-lb)-?\d{2,3}', r'\1', h)

    # 5. Handle old format without dash before lb: axrudc10lb150 → axrudc10lb
    h = re.sub(r'(lb)\d{2,3}$', r'\1', h)

    # 6. For non-F5 naming (Omnitracs): strip trailing -NN instance number
    #    dc1-f5-xrs-prod-01 → dc1-f5-xrs-prod
    if 'lb' not in h:
        h = re.sub(r'-(\d{2})$', '', h)

    return h


@router.post("/cluster/auto-assign", status_code=200)
def auto_assign_clusters(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN]))
):
    """
    Recorre los devices, deriva cluster_key heurística y marca is_primary_preferred por cluster.
    Uses hostname normalization to group HA pairs automatically.
    """
    devices = db.query(Device).all()

    # 1. Derive cluster_key for each device
    cluster_map: dict[str, list] = {}
    for dev in devices:
        key = _derive_cluster_key(dev.hostname)
        dev.cluster_key = key
        cluster_map.setdefault(key, []).append(dev)

    # 2. For each cluster, assign is_primary_preferred
    updated = 0
    for cluster, devs in cluster_map.items():
        # Pick the device with ha_state=ACTIVE and sync_status starting with 'In Sync'
        primary = None
        for d in devs:
            if (d.ha_state or "").upper() == "ACTIVE" and (d.sync_status or "").lower().startswith("in sync"):
                primary = d
                break
        # If no ACTIVE+InSync found, try just ACTIVE
        if not primary:
            for d in devs:
                if (d.ha_state or "").upper() == "ACTIVE":
                    primary = d
                    break
        # If still no primary and the cluster has only one device (standalone), mark it
        if not primary and len(devs) == 1:
            primary = devs[0]

        for d in devs:
            d.is_primary_preferred = False
        if primary:
            primary.is_primary_preferred = True
            updated += 1

    db.commit()
    return {
        "clusters": len(cluster_map),
        "primaries_assigned": updated,
        "total_devices": len(devices),
        "sample_keys": {dev.hostname: dev.cluster_key for dev in devices[:10]}
    }

@router.post("/", response_model=DeviceResponse, status_code=201)
def create_device(
    device_data: DeviceCreate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    # Requiere rol de Admin para crear dispositivos
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN]))
):
    """Creates a new device."""
    existing_device = db.query(Device).filter(
        or_(Device.hostname == device_data.hostname, Device.ip_address == device_data.ip_address)
    ).first()
    if existing_device:
        raise HTTPException(status_code=409, detail="A device with this hostname or IP already exists.")
    
    new_device = Device(**device_data.model_dump())
    db.add(new_device)
    db.commit()
    db.refresh(new_device)
    
    # Notify WebSocket clients
    notify_device_event(background_tasks, "device_added", new_device.id, {
        "hostname": new_device.hostname,
        "ip_address": new_device.ip_address
    })
    
    return new_device

@router.put("/{device_id}", response_model=DeviceResponse)
def update_device(
    device_id: int,
    device_data: DeviceUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN]))
):
    """Updates a device's information (hostname, IP, site, cluster, etc)."""
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Solo actualizar campos que fueron enviados (no None)
    update_data = device_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(device, field, value)
    
    db.commit()
    db.refresh(device)
    
    # Notify WebSocket clients
    notify_device_event(background_tasks, "device_updated", device.id, {
        "hostname": device.hostname,
        "ip_address": device.ip_address
    })
    
    return device

@router.put("/{device_id}/credentials", response_model=DeviceResponse)
def update_device_credentials(
    device_id: int, 
    credentials: DeviceCredentialsUpdate, 
    db: Session = Depends(get_db),
    # Requiere rol de Admin u Operator para cambiar credenciales
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    """Updates the credentials for a specific device."""
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    device.username = credentials.username
    device.encrypted_password = encryption_service.encrypt_data(credentials.password)
    db.commit()
    db.refresh(device)
    return device

@router.delete("/{device_id}", status_code=204)
def delete_device(
    device_id: int, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    # Requiere rol de Admin para eliminar dispositivos
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN]))
):
    """Deletes a device and its associated certificates."""
    device = db.query(Device).options(joinedload(Device.certificates)).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    hostname = device.hostname  # Save before delete
    
    # SQLAlchemy se encargará del borrado en cascada gracias a la configuración del modelo
    db.delete(device)
    db.commit()
    
    # Notify WebSocket clients
    notify_device_event(background_tasks, "device_deleted", device_id, {"hostname": hostname})
    
    return

# backend/api/endpoints/devices.py
# ... (imports existentes)
from services import f5_service_logic
from schemas.certificate import CertificateResponse # Reutilizamos nuestro schema

# ... (endpoints existentes: GET /, POST /, PUT /, DELETE /)

@router.get(
    "/{device_id}/certificates", 
    response_model=List[CertificateResponse],
    summary="List all certificates on a specific F5 device"
)
def list_certificates_on_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user)
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device or not device.encrypted_password:
        raise HTTPException(status_code=404, detail="Device not found or credentials not set.")

    f5_username = device.username
    f5_password = encryption_service.decrypt_data(device.encrypted_password)

    try:
        # ¡Le pasamos el device_id a la función de servicio!
        certs_from_f5 = f5_service_logic.get_realtime_certs_from_f5(
            hostname=device.ip_address,
            username=f5_username,
            password=f5_password,
            device_id=device.id # <-- PASAMOS EL ID
        )
        return certs_from_f5
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get(
    "/{device_id}/chains", 
    response_model=List[str],
    summary="List all certificate chains on a specific F5 device"
)
def list_certificate_chains_on_device(
    device_id: int,
    db: Session = Depends(get_db),
    # Protegemos el endpoint para que solo usuarios logueados puedan acceder
    current_user: User = Depends(auth_service.get_current_active_user)
):
    """
    Connects to a specific F5 device and retrieves a list of all installed
    SSL certificates that can be used as a chain.
    """
    # Buscamos el dispositivo y sus credenciales
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device or not device.encrypted_password:
        raise HTTPException(status_code=404, detail="Device not found or credentials are not set.")

    f5_username = device.username
    f5_password = encryption_service.decrypt_data(device.encrypted_password)

    try:
        # Llamamos a la función de servicio que se conecta al F5 en tiempo real
        chain_names = f5_service_logic.get_realtime_chains_from_f5(
            hostname=device.ip_address,
            username=f5_username,
            password=f5_password
        )
        # Devolvemos la lista de nombres de cadenas
        return chain_names
    except Exception as e:
        # Si algo falla (ej. no se puede conectar al F5), devolvemos un error
        raise HTTPException(status_code=500, detail=f"Failed to retrieve chains from F5: {str(e)}")
    

@router.post("/{device_id}/refresh-facts")
def refresh_facts(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    from services.f5_service_tasks import refresh_device_facts_task
    refresh_device_facts_task.delay(device_id)
    return {"message": f"Facts refresh queued for device {device_id}"}

@router.post("/{device_id}/refresh-cache")
def refresh_cache(
    device_id: int,
    limit_certs: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    from services.cache_builder import task_refresh_device_profiles
    task_refresh_device_profiles.delay(device_id, limit_certs=limit_certs)
    return {"message": f"Cache refresh queued for device {device_id}", "limit_certs": limit_certs}

@router.post("/refresh-facts-all")
def refresh_facts_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    from services.f5_service_tasks import refresh_device_facts_all_task
    res = refresh_device_facts_all_task.delay()
    return {"message":"Queued facts refresh for all devices"}