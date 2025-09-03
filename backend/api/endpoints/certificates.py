# backend/api/endpoints/certificates.py
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
from db.models import CertProfileLinksCache, SslProfileVipsCache
from schemas.certificate import CertificateResponse
from services import certificate_service, f5_service_logic, encryption_service, auth_service
from services import pfx_service 
from services.f5_service_tasks import scan_f5_task 



router = APIRouter()

# ---- Unified Schemas (single source of truth) ----
class RenewalInitiateRequest(BaseModel):
    private_key_content: Optional[str] = None

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
    primaries_only: bool = Query(default=False, description="If true, return only Standalone devices and cluster primaries"),
    dedupe: bool = Query(default=False, description="If true, de-duplicate by (cluster_key, cert_name) keeping cluster primary"),
    current_user: User = Depends(auth_service.get_current_active_user) # Requiere login
):
    # (La lógica de esta función se queda igual, ya era correcta)
    latest_renewal_sq = select(
        RenewalRequest.original_certificate_id,
        func.max(RenewalRequest.id).label("max_id")
    ).where(
        RenewalRequest.status == RenewalStatus.CSR_GENERATED
    ).group_by(RenewalRequest.original_certificate_id).subquery()

    # --- DEVICE LOOKUP HELPER ---
    def _is_standalone(dev: Device) -> bool:
        if not dev:
            return False
        ha = (dev.ha_state or "").lower()
        if ha == "standalone":
            return True
        # treat devices without cluster_key as standalone
        return not (dev.cluster_key and dev.cluster_key.strip())

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

    # ---- Preload devices to allow filtering and dedupe without changing existing query ----
    device_ids_all: set[int] = set()
    for cert, _, _ in results:
        if cert and cert.device_id:
            device_ids_all.add(cert.device_id)

    devices_by_id: dict[int, Device] = {}
    if device_ids_all:
        for d in db.query(Device).filter(Device.id.in_(device_ids_all)).all():
            devices_by_id[d.id] = d

    # Optionally filter to primaries_only (Standalone OR cluster primary)
    filtered_rows = []
    if primaries_only:
        for cert, rid, rstatus in results:
            dev = devices_by_id.get(cert.device_id) if cert else None
            if not dev:
                continue
            if _is_standalone(dev) or bool(dev.is_primary_preferred):
                filtered_rows.append((cert, rid, rstatus))
    else:
        filtered_rows = results

    # Optionally de-duplicate within cluster by cert name
    if dedupe:
        # key: (cluster_key_or_empty, cert_name) -> pick best
        best_by_key = {}
        for cert, rid, rstatus in filtered_rows:
            dev = devices_by_id.get(cert.device_id) if cert else None
            if not dev:
                continue
            key = ((dev.cluster_key or "").strip(), cert.name)
            # choose preferred: primary first, then newest last_scan_timestamp, then smallest device_id
            score = (
                0 if dev.is_primary_preferred else 1,
                (dev.last_scan_timestamp or datetime.min),
                -dev.id,  # larger id loses; we invert to keep deterministic
            )
            prev = best_by_key.get(key)
            if not prev:
                best_by_key[key] = (score, (cert, rid, rstatus))
            else:
                if score < prev[0]:
                    best_by_key[key] = (score, (cert, rid, rstatus))
        rows = [tpl for _, tpl in (v[1] for v in best_by_key.items())]
    else:
        rows = filtered_rows

    # --- USAGE STATE BATCH LOGIC ---
    # Build keys for all certs: (device_id, cert.name)
    keys = []
    device_ids = set()
    cert_names = set()
    for cert, _, _ in rows:
        if cert and cert.device_id is not None and cert.name is not None:
            keys.append((cert.device_id, cert.name))
            device_ids.add(cert.device_id)
            cert_names.add(cert.name)

    # Query CertProfileLinksCache in batch
    links_by_key = {}
    profiles_fp_by_device = set()
    if device_ids and cert_names:
        links = db.query(CertProfileLinksCache).filter(
            CertProfileLinksCache.device_id.in_(device_ids),
            CertProfileLinksCache.cert_name.in_(cert_names)
        ).all()
        for l in links:
            k = (l.device_id, l.cert_name)
            links_by_key.setdefault(k, set()).add(l.profile_full_path)
            profiles_fp_by_device.add((l.device_id, l.profile_full_path))

    # Query SslProfileVipsCache in batch
    vips_by_profile = {}
    all_profile_full_paths = set(fp for (_, fp) in profiles_fp_by_device)
    if device_ids and all_profile_full_paths:
        vips = db.query(SslProfileVipsCache).filter(
            SslProfileVipsCache.device_id.in_(device_ids),
            SslProfileVipsCache.profile_full_path.in_(all_profile_full_paths)
        ).all()
        for v in vips:
            k = (v.device_id, v.profile_full_path)
            vips_by_profile.setdefault(k, 0)
            vips_by_profile[k] += 1

    # Compute usage_state_by_key
    usage_state_by_key = {}
    for k in keys:
        profiles = links_by_key.get(k, set())
        if not profiles:
            usage_state_by_key[k] = 'no-profiles'
        else:
            total_vips = 0
            for pf in profiles:
                total_vips += vips_by_profile.get((k[0], pf), 0)
            if total_vips == 0:
                usage_state_by_key[k] = 'profiles-no-vips'
            else:
                usage_state_by_key[k] = 'in-use'

    # Build response certs
    response_certs = []
    for cert, renewal_id, renewal_status in rows:
        days_remaining = (cert.expiration_date - datetime.utcnow()).days if cert.expiration_date else None
        cert_data = cert.__dict__
        cert_data['days_remaining'] = days_remaining
        cert_data['renewal_id'] = renewal_id
        cert_data['renewal_status'] = renewal_status.name if renewal_status else None
        cert_data['device_id'] = cert.device_id
        dev_obj = devices_by_id.get(cert.device_id)
        if dev_obj:
            cert_data['device_hostname'] = dev_obj.hostname
            cert_data['cluster_key'] = dev_obj.cluster_key
            cert_data['is_primary_preferred'] = bool(dev_obj.is_primary_preferred)
        # Set usage_state
        cert_data['usage_state'] = usage_state_by_key.get((cert.device_id, cert.name))
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


# 2. El endpoint corregido
@router.post("/{cert_id}/initiate-renewal", summary="Initiate a certificate renewal")
def initiate_certificate_renewal(
    cert_id: int, 
    request: RenewalInitiateRequest, 
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
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
        device = db_cert.device
        if not device or not device.encrypted_password:
            raise ValueError(f"No credentials configured for device {f5_hostname}")
        f5_username = device.username
        f5_password = encryption_service.decrypt_data(device.encrypted_password)
        result = f5_service_logic.deploy_from_pem_and_update_profiles(
            hostname=f5_hostname,
            username=f5_username,
            password=f5_password,
            old_cert_name=db_cert.name,
            cert_pem=request.signed_cert_content,
            key_pem=private_key
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
            hostname=device.ip_address,
            username=device.username,
            password=decrypted_password,
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
# --- Verify installed certificate endpoint ---
class VerifyCertResponse(BaseModel):
    version: Optional[str]
    san: List[str] = []
    serial: Optional[str]
    not_after: Optional[str]
    subject: Optional[str]
    issuer: Optional[str]
    fingerprint_sha256: Optional[str] = None
    object_name: Optional[str] = None
    source: Optional[str] = None
class NormalizeResponse(BaseModel):
    renamed_certs: list
    renamed_keys: list
    updated_profiles: list

@router.post("/devices/{device_id}/normalize-object-names", response_model=NormalizeResponse,
             summary="Normalize F5 cert/key object names (remove .crt/.key suffix and update profiles)")
def normalize_object_names_endpoint(device_id: int,
                                    db: Session = Depends(get_db),
                                    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device or not device.encrypted_password:
        raise HTTPException(status_code=404, detail="Device not found or credentials not set.")
    f5_username = device.username
    f5_password = encryption_service.decrypt_data(device.encrypted_password)
    try:
        report = f5_service_logic.normalize_object_names(
            hostname=device.ip_address,
            username=f5_username,
            password=f5_password,
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/devices/{device_id}/verify/{object_name}", response_model=VerifyCertResponse,
            summary="Verify installed certificate (version & SAN) on F5")
def verify_installed_cert(device_id: int, object_name: str,
                          db: Session = Depends(get_db),
                          current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device or not device.encrypted_password:
        raise HTTPException(status_code=404, detail="Device not found or credentials not set.")
    f5_username = device.username
    f5_password = encryption_service.decrypt_data(device.encrypted_password)
    try:
        details = f5_service_logic.verify_installed_certificate(
            hostname=device.ip_address,
            username=f5_username,
            password=f5_password,
            object_name=object_name
        )
        return details
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))