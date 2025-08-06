# backend/api/endpoints/certificates.py

from fastapi import APIRouter, Depends, Query, HTTPException, File, UploadFile, Form, status
from sqlalchemy.orm import Session, joinedload, aliased
from sqlalchemy import select, func, or_
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel
from icontrol.exceptions import iControlUnexpectedHTTPError
from cryptography.fernet import Fernet

# --- Imports para la lógica y la seguridad ---
from db.base import get_db
from db.models import Certificate, RenewalRequest, RenewalStatus, User, UserRole, Device
from schemas.certificate import CertificateResponse
from services import certificate_service, f5_service_logic, encryption_service, auth_service
from services import pfx_service 
from services.f5_service_tasks import scan_f5_task 
from sqlalchemy.orm import joinedload


router = APIRouter()

# --- Schemas para Peticiones/Respuestas ---
class RenewalInitiateRequest(BaseModel):
    private_key_content: str # La clave ahora es obligatoria para este flujo

class DeployRequest(BaseModel):
    signed_cert_content: str

class RenewalDetailsResponse(BaseModel):
    renewal_id: int
    csr: str
    private_key: str

# --- Endpoint GET / : Cualquiera puede ver, solo necesita estar logueado ---
@router.get("/", response_model=List[CertificateResponse])
def get_certificates(
    db: Session = Depends(get_db),
    expires_in_days: int | None = Query(default=None, description="Filter certificates expiring within this many days"),
    search: str | None = Query(default=None, description="Search term for CN or cert name"),
    current_user: User = Depends(auth_service.get_current_active_user) # Requiere login
):
    # (La lógica de esta función se queda igual, ya era correcta)
    latest_renewal_sq = select(
        RenewalRequest.original_certificate_id,
        func.max(RenewalRequest.id).label("max_id")
    ).where(
        RenewalRequest.status == RenewalStatus.CSR_GENERATED
    ).group_by(RenewalRequest.original_certificate_id).subquery()

    RenewalAlias = aliased(RenewalRequest)

    query = select(
        Certificate,
        RenewalAlias.id,
        RenewalAlias.status
    ).outerjoin(
        latest_renewal_sq, Certificate.id == latest_renewal_sq.c.original_certificate_id
    ).outerjoin(
        RenewalAlias, RenewalAlias.id == latest_renewal_sq.c.max_id
    )

    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Certificate.common_name.ilike(search_term),
                Certificate.name.ilike(search_term)
            )
        )
    elif expires_in_days is not None:
        limit_date = datetime.utcnow() + timedelta(days=expires_in_days)
        query = query.where(
            Certificate.expiration_date <= limit_date,
            Certificate.expiration_date > datetime.utcnow()
        )

    query = query.order_by(Certificate.expiration_date.asc())
    results = db.execute(query).all()
    
    response_certs = []
    for cert, renewal_id, renewal_status in results:
        days_remaining = (cert.expiration_date - datetime.utcnow()).days if cert.expiration_date else None
        
        # cert.__dict__ ya contiene 'device_id' porque es una columna del modelo.
        # Pero para ser explícitos y seguros, lo añadimos.
        cert_data = cert.__dict__
        cert_data['days_remaining'] = days_remaining
        cert_data['renewal_id'] = renewal_id
        cert_data['renewal_status'] = renewal_status.name if renewal_status else None
        
        # Aseguramos que el device_id esté presente.
        cert_data['device_id'] = cert.device_id 

        response_certs.append(cert_data)

    return response_certs

@router.get("/{cert_id}/usage", summary="Get usage details for a specific certificate")
def get_cert_usage_details(
    cert_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    """
    Finds where a certificate is being used (SSL Profiles, Virtual Servers).
    """
    db_cert = db.query(Certificate).filter(Certificate.id == cert_id).first()
    if not db_cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    device = db_cert.device
    if not device or not device.encrypted_password:
        raise HTTPException(status_code=400, detail="Credentials for the device are not set.")

    f5_hostname = device.ip_address # Usamos la IP para la conexión
    f5_username = device.username
    f5_password = encryption_service.decrypt_data(device.encrypted_password)

    try:
        usage_data = f5_service_logic.get_certificate_usage(
            hostname=f5_hostname,
            username=f5_username,
            password=f5_password,
            cert_name=db_cert.name,
            partition=db_cert.partition
        )
        return usage_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get usage data from F5: {str(e)}")

# 1. Definimos el schema para el cuerpo de la petición.
#    El campo para la clave es opcional.
class RenewalInitiateRequest(BaseModel):
    private_key_content: Optional[str] = None

# 2. El endpoint corregido
@router.post("/{cert_id}/initiate-renewal", summary="Initiate a certificate renewal")
def initiate_certificate_renewal(
    cert_id: int, 
    request: RenewalInitiateRequest, 
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    # --- ¡AÑADIMOS EL PRINT DE DEPURACIÓN! ---
    print("="*20, "DEBUGGING RENEWAL REQUEST", "="*20)
    print(f"Received request for cert_id: {cert_id}")
    print(f"Request Body Content (raw): {request}")
    print(f"Extracted Private Key: '{request.private_key_content[:30]}...'") # Imprimimos solo los primeros 30 caracteres
    print("="*60)
    # --- FIN DEL BLOQUE DE DEPURACIÓN ---
    
    db_cert = db.query(Certificate).filter(Certificate.id == cert_id).first()
    if not db_cert or not db_cert.common_name:
        raise HTTPException(status_code=404, detail="Certificate with a valid Common Name not found")

    try:
        # Llamamos a nuestra única y clara función de servicio
        renewal_data = certificate_service.create_renewal_from_provided_key(
            db=db, 
            original_cert_id=cert_id, 
            common_name=db_cert.common_name,
            private_key_pem=request.private_key_content
        )
        return renewal_data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Asegúrate de que la clase RenewalInitiateRequest está definida antes de esta función,
# tal como la definimos en los pasos anteriores.
class RenewalInitiateRequest(BaseModel):
    private_key_content: Optional[str] = None

# Definimos el schema de la respuesta para ser explícitos
class RenewalDetailsResponse(BaseModel):
    renewal_id: int
    csr: str
    private_key: str

@router.get("/renewals/{renewal_id}/details", response_model=RenewalDetailsResponse)
def get_renewal_details(
    renewal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    renewal = db.query(RenewalRequest).filter(RenewalRequest.id == renewal_id).first()
    if not renewal:
        raise HTTPException(status_code=404, detail="Renewal request not found.")
    
    private_key = encryption_service.decrypt_data(renewal.encrypted_private_key)
    return RenewalDetailsResponse(
        renewal_id=renewal.id, 
        csr=renewal.csr_content, 
        private_key=private_key
    )



# --- Endpoint POST /deploy : Protegido para Admin y Operator ---
class DeployRequest(BaseModel):
    signed_cert_content: str

@router.post("/{renewal_id}/deploy", summary="Deploy signed certificate to F5")
def deploy_signed_certificate(
    renewal_id: int, 
    request: DeployRequest, 
    db: Session = Depends(get_db),
    # ¡AQUÍ LA PROTECCIÓN!
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    renewal = db.query(RenewalRequest).filter(RenewalRequest.id == renewal_id).first()
    if not renewal or renewal.status != RenewalStatus.CSR_GENERATED:
        raise HTTPException(status_code=400, detail="This renewal request is not in a deployable state.")

    db_cert = renewal.original_certificate
    if not db_cert:
         raise HTTPException(status_code=404, detail="Original certificate associated with this renewal not found.")

    private_key = encryption_service.decrypt_data(renewal.encrypted_private_key)

    try:
        f5_hostname = db_cert.f5_device_hostname
        
        # Obtenemos las credenciales del dispositivo asociado al certificado original
        device = db_cert.device
        if not device or not device.encrypted_password:
            raise ValueError(f"No credentials configured for device {f5_hostname}")
        
        f5_username = device.username
        f5_password = encryption_service.decrypt_data(device.encrypted_password)
        
        result = f5_service_logic.deploy_and_update_f5(
            hostname=f5_hostname, 
            username=f5_username, 
            password=f5_password,
            old_cert_name=db_cert.name,
            new_cert_content=request.signed_cert_content,
            new_key_content=private_key
        )

        renewal.status = RenewalStatus.COMPLETED
        renewal.encrypted_private_key = "[REDACTED]"
        db.commit()

        return {"status": "success", "message": "Certificate deployed successfully!", "details": result}
    except ValueError as e:
        renewal.status = RenewalStatus.FAILED
        db.commit()
        raise HTTPException(status_code=400, detail=str(e))
    
@router.delete("/{cert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_certificate(
    cert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user)
):
    # 1. Buscamos el certificado en nuestra base de datos
    db_cert = db.query(Certificate).options(joinedload(Certificate.device)).filter(Certificate.id == cert_id).first()
    if not db_cert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found in DB.")

    device = db_cert.device
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated device not found for this certificate.")

    # ✅ --- LA CORRECCIÓN CLAVE ESTÁ AQUÍ --- ✅
    # Hacemos exactamente lo mismo que en tus otras funciones:
    # Desencriptamos la contraseña ANTES de llamar al servicio de lógica.
    try:
        if not device.encrypted_password:
            raise ValueError(f"Credentials not set for device {device.hostname}.")
            
        decrypted_password = encryption_service.decrypt_data(device.encrypted_password)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    

    # 2. Llamamos a la función de servicio con los parámetros correctos
    try:
        f5_service_logic.delete_certificate_from_f5(
            hostname=device.hostname,
            username=device.username,
            password=decrypted_password, # <-- Le pasamos la contraseña ya desencriptada
            cert_name=db_cert.name,
            partition=db_cert.partition
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred during F5 operation: {e}")

    # 3. Si todo va bien, borramos el certificado de nuestra base de datos
    db.delete(db_cert)
    db.commit()
    
    return
    
# 1. Definimos el schema de la respuesta para ser explícitos y claros.
class RenewalDetailsResponse(BaseModel):
    renewal_id: int
    csr: str
    private_key: str

@router.get("/renewals/{renewal_id}", 
            response_model=RenewalDetailsResponse, 
            summary="Get CSR and Private Key for an active renewal")
def get_renewal_details(
    renewal_id: int,
    db: Session = Depends(get_db),
    # Cualquiera que esté logueado puede ver los detalles de una renovación
    current_user: User = Depends(auth_service.get_current_active_user)
):
    """
    Retrieves the details (CSR and decrypted Private Key) for a specific
    renewal request that is in a 'CSR_GENERATED' state.
    """
    # 2. Buscamos la solicitud de renovación en la base de datos por su ID.
    renewal = db.query(RenewalRequest).filter(RenewalRequest.id == renewal_id).first()

    if not renewal:
        raise HTTPException(status_code=404, detail="Renewal request not found.")
        
    # Opcional: Podríamos añadir una comprobación de que el estado es 'CSR_GENERATED'
    # if renewal.status != RenewalStatus.CSR_GENERATED:
    #     raise HTTPException(status_code=400, detail="This renewal is not in an active state.")

    # 3. Desencriptamos la clave privada que tenemos guardada.
    try:
        private_key = encryption_service.decrypt_data(renewal.encrypted_private_key)
    except Exception:
        # Si la desencripción falla (ej. la clave de encriptación cambió), devolvemos un error.
        raise HTTPException(status_code=500, detail="Failed to decrypt the stored private key.")

    # 4. Devolvemos los datos en el formato que espera el frontend.
    return {
        "renewal_id": renewal.id,
        "csr": renewal.csr_content,
        "private_key": private_key
    }

# --- ¡NUEVO ENDPOINT PARA DESPLIEGUE CON PFX! ---
@router.post(
    "/{cert_id}/deploy-pfx", 
    summary="Renew/Update a certificate from a PFX file",
    # El response_model es el mismo que el de deploy normal
)
async def deploy_certificate_from_pfx(
    cert_id: int, 
    pfx_file: UploadFile = File(...),
    pfx_password: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    # 1. Obtenemos el certificado original para saber su nombre y el F5 de destino
    db_cert = db.query(Certificate).options(joinedload(Certificate.device)).filter(Certificate.id == cert_id).first()
    if not db_cert:
        raise HTTPException(status_code=404, detail="Original certificate not found in database.")

    device = db_cert.device
    if not device or not device.encrypted_password:
        raise HTTPException(status_code=400, detail=f"No credentials configured for device {device.hostname}")
    
    # Leemos el contenido binario del archivo PFX subido
    pfx_data = await pfx_file.read()
    
    try:
        # Obtenemos las credenciales del F5
        f5_username = device.username
        f5_password = encryption_service.decrypt_data(device.encrypted_password)

        # --- ¡AQUÍ ESTÁ EL CAMBIO CLAVE! ---
        # Llamamos a nuestra nueva y robusta función de servicio, pasándole los datos binarios del PFX.
        result = f5_service_logic.deploy_and_update_f5(
            hostname=device.ip_address,
            username=f5_username,
            password=f5_password,
            old_cert_name=db_cert.name,
            pfx_data=pfx_data,           # <-- Usamos pfx_data
            pfx_password=pfx_password,   # <-- Usamos pfx_password
        )
        
        # Opcional: Actualizar el estado de la renovación si existe una.
        # renewal = db.query(RenewalRequest).filter(...).first()
        # if renewal:
        #     renewal.status = RenewalStatus.COMPLETED
        #     db.commit()

        return {"status": "success", "message": "Certificate deployed successfully via native PFX import!", "details": result}

    except ValueError as e:
        # Capturamos cualquier error legible que venga del servicio
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Para cualquier otro error inesperado
        print(f"UNEXPECTED ERROR during PFX deploy: {e}")
        raise HTTPException(status_code=500, detail="An unexpected internal server error occurred.")

@router.post("/new-deployment/pfx", summary="Deploy a new certificate from PFX to multiple devices")
async def new_deployment_from_pfx(
    # Recibimos los datos del formulario como campos individuales
    pfx_file: UploadFile = File(...),
    # Esperamos una lista de IDs, que FastAPI puede parsear si se envían correctamente
    target_device_ids: List[int] = Form(...), 
    pfx_password: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    # 'target_device_ids' ya es una lista de enteros gracias a FastAPI
    devices = db.query(Device).filter(Device.id.in_(target_device_ids)).all()
    if not devices:
        raise HTTPException(status_code=404, detail="No valid target devices found.")

    pfx_data = await pfx_file.read()
    
    # Desempaquetamos el PFX una sola vez
    try:
        unpacked_data = pfx_service.unpack_pfx(pfx_data, pfx_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    results = []
    # Iteramos sobre cada dispositivo seleccionado
    for device in devices:
        try:
            if not device.encrypted_password:
                raise ValueError("Credentials not set")
            
            f5_username = device.username
            f5_password = encryption_service.decrypt_data(device.encrypted_password)

            # Usamos una función de F5 Service que solo sube, no actualiza perfiles
            result = f5_service_logic.upload_cert_and_key(
                hostname=device.ip_address,
                username=f5_username,
                password=f5_password,
                cert_content=unpacked_data["cert"],
                key_content=unpacked_data["key"]
            )
            
            # Opcional: registrar el nuevo certificado en nuestra BBDD
            # ...

            results.append({"device": device.hostname, "status": "success", "details": result})
        except Exception as e:
            results.append({"device": device.hostname, "status": "failed", "error": str(e)})
    
    return {"deployment_results": results}

class ProfileUpdateRequest(BaseModel):
    device_id: int
    old_cert_name: str
    new_cert_name: str
    # La cadena es opcional, usaremos la por defecto
    chain_name: Optional[str] = "DigiCert_Global_G2_TLS_RSA_SHA256_2020_CA1"

@router.post("/update-profiles", summary="Update SSL profiles to use a new certificate")
def update_ssl_profiles(
    request: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    device = db.query(Device).filter(Device.id == request.device_id).first()
    if not device or not device.encrypted_password:
        raise HTTPException(status_code=404, detail="Device not found or credentials not set.")

    f5_username = device.username
    f5_password = encryption_service.decrypt_data(device.encrypted_password)

    try:
        # ¡Necesitamos una nueva función de servicio para esto!
        updated_profiles = f5_service_logic.update_profiles_with_new_cert(
            hostname=device.ip_address,
            username=f5_username,
            password=f5_password,
            old_cert_name=request.old_cert_name,
            new_cert_name=request.new_cert_name,
            chain_name=request.chain_name
        )
        # Actualizamos nuestro inventario después de cambiar el F5
        # (Lanzamos una tarea de re-escaneo para ese dispositivo)
        scan_f5_task.delay(device.id)

        return {
            "status": "success",
            "message": f"Successfully updated {len(updated_profiles)} SSL profile(s).",
            "updated_profiles": updated_profiles
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# --- SCHEMA PARA LA PETICIÓN DE ACTUALIZACIÓN ---
class ProfileUpdateRequest(BaseModel):
    device_id: int
    old_cert_name: str
    new_cert_name: str
    # La cadena es opcional, pero permitimos que el frontend la envíe
    chain_name: Optional[str] = "DigiCert_Global_G2_TLS_RSA_SHA256_2020_CA1"


# --- ENDPOINT ACTUALIZADO PARA ACTUALIZAR PERFILES SSL ---
@router.post(
    "/update-profiles", 
    summary="Update SSL profiles to use a new certificate",
    # Podríamos definir un response_model si quisiéramos
)
def update_ssl_profiles(
    request: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    """
    Finds all SSL profiles using an old certificate and updates them to use
    a new certificate/key pair and a specified chain.
    """
    # Buscamos el dispositivo y sus credenciales
    device = db.query(Device).filter(Device.id == request.device_id).first()
    if not device or not device.encrypted_password:
        raise HTTPException(status_code=404, detail="Device not found or credentials are not set.")

    f5_username = device.username
    f5_password = encryption_service.decrypt_data(device.encrypted_password)

    try:
        # Llamamos a la función de servicio que hace el trabajo en el F5
        updated_profiles_list = f5_service_logic.update_profiles_with_new_cert(
            hostname=device.ip_address,
            username=f5_username,
            password=f5_password,
            old_cert_name=request.old_cert_name,
            new_cert_name=request.new_cert_name,
            chain_name=request.chain_name
        )
        
        # Después del éxito, lanzamos una tarea para re-escanear el inventario de ese F5
        # y mantener nuestra base de datos actualizada.
        scan_f5_task.delay(device.id)

        return {
            "status": "success",
            "message": f"Successfully updated {len(updated_profiles_list)} SSL profile(s). A background sync has been initiated.",
            "updated_profiles": updated_profiles_list
        }
    except Exception as e:
        # Si algo falla en el F5, devolvemos el error
        raise HTTPException(status_code=500, detail=f"Failed to update profiles on F5: {str(e)}")