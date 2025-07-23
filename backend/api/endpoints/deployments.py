# backend/api/endpoints/deployments.py

from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

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
                pfx_password=pfx_password
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