# backend/api/endpoints/devices.py

from fastapi import APIRouter, Depends, Query, HTTPException
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

@router.post("/cluster/auto-assign", status_code=200)
def auto_assign_clusters(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN]))
):
    """
    Recorre los devices, deriva cluster_key heurística y marca is_primary_preferred por cluster.
    cluster_key: hostname normalizado quitando -LB0\d-(PRI|SEC)
    """
    devices = db.query(Device).all()
    # 1. Derivar cluster_key
    cluster_map = {}
    regex = re.compile(r"(-LB0\d+-(PRI|SEC))$", re.IGNORECASE)
    for dev in devices:
        # Normalizamos el hostname quitando sufijos -LB0x-PRI/SEC
        base = regex.sub("", dev.hostname)
        dev.cluster_key = base
        if base not in cluster_map:
            cluster_map[base] = []
        cluster_map[base].append(dev)
    # 2. Por cada cluster, marcar is_primary_preferred
    updated = 0
    for cluster, devs in cluster_map.items():
        # Elegir el device con ha_state=ACTIVE y sync_status ILIKE 'In Sync%'
        primary = None
        for d in devs:
            if (d.ha_state or "").upper() == "ACTIVE" and (d.sync_status or "").lower().startswith("in sync"):
                primary = d
                break
        # Si no hay, dejar todos en False
        for d in devs:
            d.is_primary_preferred = False
        if primary:
            primary.is_primary_preferred = True
            updated += 1
    db.commit()
    return {"clusters": len(cluster_map), "primaries_assigned": updated}

@router.post("/", response_model=DeviceResponse, status_code=201)
def create_device(
    device_data: DeviceCreate, 
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
    return new_device

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
    db: Session = Depends(get_db),
    # Requiere rol de Admin para eliminar dispositivos
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN]))
):
    """Deletes a device and its associated certificates."""
    device = db.query(Device).options(joinedload(Device.certificates)).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # SQLAlchemy se encargará del borrado en cascada gracias a la configuración del modelo
    db.delete(device)
    db.commit()
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