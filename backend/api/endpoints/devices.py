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

class DeviceCredentialsUpdate(BaseModel):
    username: str
    password: str

# --- Endpoints Protegidos ---

@router.get("/", response_model=List[DeviceResponse])
def get_all_devices(
    db: Session = Depends(get_db),
    search: str | None = Query(default=None, description="Search term for hostname or IP"),
    # Requiere que el usuario esté logueado, sin importar su rol
    current_user: User = Depends(auth_service.get_current_active_user)
):
    """Retrieves a list of all registered devices, with optional search."""
    query = db.query(Device)
    if search:
        search_term = f"%{search}%"
        query = query.filter(or_(Device.hostname.ilike(search_term), Device.ip_address.ilike(search_term)))
    devices = query.order_by(Device.hostname.asc()).all()
    return devices

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
    
    new_device = Device(**device_data.dict())
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