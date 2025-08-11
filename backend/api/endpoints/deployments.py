# backend/api/endpoints/deployments.py

from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import json

from db.base import get_db
from db.models import Device, User, UserRole
from services import auth_service, pfx_service, f5_service_logic, encryption_service

router = APIRouter()

@router.post("/new-pfx", summary="Deploy a new certificate from PFX to one or more devices")
async def new_pfx_deployment(
    db: Session = Depends(get_db),
    pfx_file: UploadFile = File(...),
    target_device_ids: List[int] = Form(...),
    pfx_password: Optional[str] = Form(None),
    install_chain_from_pfx: Optional[bool] = Form(False),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    """
    Deploys a new certificate to one or more devices.
    This does not update any existing SSL profiles.
    """
    devices = db.query(Device).filter(Device.id.in_(target_device_ids)).all()
    if not devices:
        raise HTTPException(status_code=404, detail="No valid target devices found.")

    pfx_data = await pfx_file.read()
    
    deployment_results = []
    for device in devices:
        try:
            if not device.encrypted_password:
                raise ValueError("Credentials are not set for this device.")
            
            f5_username = device.username
            f5_password = encryption_service.decrypt_data(device.encrypted_password)

            # --- ¡AQUÍ ESTÁ LA CLAVE! ---
            # Reutilizamos nuestra función de despliegue principal,
            # pero le pasamos un 'old_cert_name' vacío para que sepa
            # que no debe actualizar ningún perfil.
            result = f5_service_logic.deploy_and_update_f5(
                hostname=device.ip_address,
                username=f5_username,
                password=f5_password,
                old_cert_name="", # <-- Esto le dice a la función que es un nuevo despliegue
                pfx_data=pfx_data,
                pfx_password=pfx_password,
                install_chain_from_pfx=install_chain_from_pfx
            )
            
            # Opcional: Registrar el nuevo certificado en nuestra BBDD
            # ...

            deployment_results.append({"device": device.hostname, "status": "success", "details": result})
        except Exception as e:
            error_message = str(e)
            print(f"ERROR deploying to {device.hostname}: {error_message}")
            deployment_results.append({"device": device.hostname, "status": "failed", "error": error_message})
            db.rollback()

    return {"deployment_results": deployment_results}


# Endpoint 1: Preview which profiles/VS would be affected by replacing a cert
@router.post("/preview", summary="Preview which profiles/VS would be affected by replacing a cert")
async def preview_deployment(
    db: Session = Depends(get_db),
    device_id: int = Form(...),
    old_cert_name: str = Form(...),
    partition: str = Form('Common'),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if not device.encrypted_password:
        raise HTTPException(status_code=400, detail="Device credentials not set")
    f5_username = device.username
    f5_password = encryption_service.decrypt_data(device.encrypted_password)
    try:
        usage = f5_service_logic.preview_certificate_usage(
            hostname=device.ip_address,
            username=f5_username,
            password=f5_password,
            cert_name=old_cert_name,
            partition=partition
        )
        return usage
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Endpoint 2: Confirm updating selected profiles to a new cert object
@router.post("/confirm", summary="Confirm updating selected profiles to a new cert object")
async def confirm_deployment(
    db: Session = Depends(get_db),
    device_id: int = Form(...),
    old_cert_name: str = Form(...),
    new_object_name: str = Form(...),
    chain_name: str = Form('DigiCert_Global_G2_TLS_RSA_SHA256_2020_CA1'),
    selected_profiles: Optional[str] = Form(None),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if not device.encrypted_password:
        raise HTTPException(status_code=400, detail="Device credentials not set")
    f5_username = device.username
    f5_password = encryption_service.decrypt_data(device.encrypted_password)
    try:
        profiles_list = None
        if selected_profiles:
            try:
                profiles_list = json.loads(selected_profiles)
                if not isinstance(profiles_list, list):
                    raise ValueError("selected_profiles must be a JSON array")
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid selected_profiles: {e}")
        updated = f5_service_logic.update_profiles_with_new_cert(
            hostname=device.ip_address,
            username=f5_username,
            password=f5_password,
            old_cert_name=old_cert_name,
            new_cert_name=new_object_name,
            chain_name=chain_name,
            selected_profiles=profiles_list
        )
        return {"updated_profiles": updated}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))