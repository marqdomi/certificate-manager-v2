# backend/api/endpoints/devices.py

from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List, Optional
from pydantic import BaseModel
import logging
from datetime import datetime

from db.base import get_db
from db.models import Device, Certificate, User, UserRole
from schemas.device import DeviceResponse
from services import encryption_service, auth_service
from services import f5_service_logic
from schemas.certificate import CertificateResponse

logger = logging.getLogger(__name__)
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
    
    # Agregar campo has_credentials a cada dispositivo
    device_responses = []
    for device in devices:
        # Crear el objeto DeviceResponse con has_credentials calculado
        device_data = {}
        
        # Copiar todos los campos del modelo original
        for field_name in DeviceResponse.model_fields.keys():
            if hasattr(device, field_name):
                value = getattr(device, field_name)
                # Convertir ip_address a string si es un objeto IP
                if field_name == 'ip_address' and value is not None:
                    value = str(value)
                device_data[field_name] = value
        
        # Agregar el campo has_credentials calculado
        device_data['has_credentials'] = bool(device.encrypted_password)
        
        device_response = DeviceResponse(**device_data)
        device_responses.append(device_response)
    
    return device_responses

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


# --- Endpoint para discovery real de clusters consultando F5 ---
@router.post("/cluster/discover", status_code=200)
def discover_clusters_from_f5(
    device_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """
    Descubre clusters consultando directamente los F5 en lugar de usar heurísticas de nombres.
    
    Args:
        device_id: Si se especifica, solo descubre cluster para ese dispositivo.
                   Si no se especifica, descubre todos los clusters.
    
    Returns:
        JSON con información detallada de clusters obtenida directamente de los F5
    """
    from services.f5_cluster_discovery import discover_cluster_from_f5, discover_all_clusters
    
    try:
        if device_id:
            # Descubrir cluster para un dispositivo específico
            result = discover_cluster_from_f5(device_id)
            
            if result['status'] != 'success':
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content=result
                )
                
            return {
                "status": "success",
                "message": f"Cluster discovery completed for device {device_id}",
                "discovery_result": result
            }
            
        else:
            # Descubrir todos los clusters
            result = discover_all_clusters()
            
            # Actualizar la base de datos con la información descubierta
            updated_devices = 0
            
            for cluster in result['discovered_clusters']:
                cluster_id = cluster['cluster_id']
                trust_domain = cluster.get('trust_domain', '')
                sync_status = cluster.get('sync_status')

                # Actualizar cluster_key para todos los dispositivos del cluster
                for device_info in cluster['devices']:
                    device = db.get(Device, device_info.get('device_id')) if device_info.get('device_id') else None
                    if device:
                        device.cluster_key = cluster_id
                        device.trust_domain = trust_domain
                        if sync_status:
                            device.sync_status = sync_status
                        if device_info.get('ha_state'):
                            device.ha_state = device_info['ha_state']
                        elif device_info.get('failover_state'):
                            device.ha_state = str(device_info['failover_state']).upper()

                        device.is_primary_preferred = (device.ha_state or '').upper() == 'ACTIVE'
                        device.last_cluster_discovery = datetime.utcnow()
                        device.cluster_discovery_source = 'f5_api'

                        updated_devices += 1
                        
            # Marcar dispositivos standalone
            for device_id in result['standalone_devices']:
                device = db.get(Device, device_id)
                if device:
                    device.cluster_key = None
                    device.sync_status = 'N/A'
                    device.is_primary_preferred = False
                    device.last_cluster_discovery = datetime.utcnow()
                    device.cluster_discovery_source = 'f5_api'
                    updated_devices += 1
                    
            db.commit()
            
            return {
                "status": result['status'],
                "message": result['message'],
                "discovered_clusters": result['discovered_clusters'],
                "standalone_devices": result['standalone_devices'],
                "failed_devices": result['failed_devices'],
                "total_processed": result['total_processed'],
                "updated_devices": updated_devices
            }
            
    except Exception as e:
        logger.error(f"Error in cluster discovery endpoint: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "message": f"Cluster discovery failed: {str(e)}"
            }
        )

# --- Endpoint para discovery unificado (facts + clusters) ---
@router.post("/unified-discovery", status_code=200)
def unified_discovery_operation(
    device_ids: Optional[List[int]] = None,
    discovery_type: str = "full",  # "full", "delta", "health", "cluster"
    include_performance: bool = False,
    max_concurrent: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """
    Unified discovery operation that combines facts scanning and cluster discovery
    following Microsoft monitoring best practices.
    
    Args:
        device_ids: List of device IDs to process. If None, processes all devices.
        discovery_type: Type of discovery ('full', 'delta', 'health', 'cluster')
        include_performance: Whether to include performance metrics collection
        max_concurrent: Maximum concurrent operations
    
    Returns:
        JSON with detailed operation results and performance metrics
    """
    from services.f5_unified_discovery import unified_discovery_service
    import asyncio
    
    try:
        # If no device_ids specified, get all devices based on discovery type
        if device_ids is None:
            if discovery_type == "full":
                # For full discovery, get all active devices
                devices = db.query(Device).filter(Device.is_active == True).all()
            else:
                # For other types, get devices that need discovery based on intervals
                devices = []
                all_devices = db.query(Device).filter(Device.is_active == True).all()
                for device in all_devices:
                    if unified_discovery_service.should_perform_discovery(device, discovery_type):
                        devices.append(device)
            
            device_ids = [device.id for device in devices]
        
        if not device_ids:
            return {
                "status": "success",
                "message": "No devices require discovery at this time",
                "operation": "unified_discovery",
                "discovery_type": discovery_type,
                "total_devices": 0,
                "results": []
            }
        
        logger.info(f"Starting unified discovery for {len(device_ids)} devices, type: {discovery_type}")
        
        # Execute unified discovery operation
        if len(device_ids) == 1:
            # Single device operation
            result = asyncio.run(
                unified_discovery_service.unified_discovery_operation(
                    device_ids[0], db, discovery_type, include_performance
                )
            )
            
            return {
                "status": "success" if result['success'] else "partial_success",
                "message": f"Unified discovery completed for device {device_ids[0]}",
                "operation": "unified_discovery",
                "discovery_type": discovery_type,
                "total_devices": 1,
                "result": result
            }
        else:
            # Bulk operation for multiple devices
            result = asyncio.run(
                unified_discovery_service.bulk_unified_discovery(
                    device_ids, db, discovery_type, max_concurrent
                )
            )
            
            return {
                "status": "success" if result['success_rate'] == 100 else "partial_success",
                "message": f"Unified discovery completed for {result['successful']}/{result['total_devices']} devices",
                "operation": "bulk_unified_discovery",
                "discovery_type": discovery_type,
                "total_devices": result['total_devices'],
                "successful": result['successful'],
                "failed": result['failed'],
                "success_rate": result['success_rate'],
                "duration": result['duration'],
                "results": {
                    "successful_operations": result['successful_operations'],
                    "failed_operations": result['failed_operations']
                }
            }
            
    except Exception as e:
        logger.error(f"Error in unified discovery endpoint: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "message": f"Unified discovery failed: {str(e)}",
                "operation": "unified_discovery",
                "discovery_type": discovery_type
            }
        )

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
    from core.celery_worker import celery_app
    res = celery_app.send_task("devices.refresh_facts", args=[device_id])
    return {"message": f"Facts refresh queued for device {device_id}", "task_id": res.id}

@router.post("/{device_id}/refresh-cache")
def refresh_cache(
    device_id: int,
    limit_certs: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    from core.celery_worker import celery_app
    res = celery_app.send_task("cache.refresh_device_profiles", kwargs={"device_id": int(device_id), "limit_certs": limit_certs})
    return {"message": f"Cache refresh queued for device {device_id}", "limit_certs": limit_certs, "task_id": res.id}

@router.post("/refresh-facts-all")
def refresh_facts_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    from core.celery_worker import celery_app
    res = celery_app.send_task("devices.refresh_facts_all")
    return {"message":"Queued facts refresh for all devices", "task_id": res.id}
