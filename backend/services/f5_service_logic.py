# backend/services/f5_service_logic.py

import os
from datetime import datetime
from base64 import b64encode
from cryptography import x509
from cryptography.x509.oid import NameOID  # <-- CAMBIO 1: Importar NameOID aquí
from cryptography.hazmat.primitives import serialization, hashes
from f5.bigip import ManagementRoot
from f5.sdk_exception import F5SDKError
from sqlalchemy.orm import Session
from db.models import Certificate, Device 
from cryptography.hazmat.primitives.serialization import pkcs12
from typing import Optional
import paramiko # <-- Importar la nueva librería
import time
from db.models import Certificate, Device #<-- Asegúrate de que F5Device esté importado, no solo Device

    
# -------------------------------------------------------------------
# FUNCIÓN DE LÓGICA DE ESCANEO
# -------------------------------------------------------------------
# El nombre de la función y sus parámetros están bien.
def _perform_scan(db: Session, device: Device, username: str, password: str):
    """
    Se conecta a un F5, escanea sus certificados y los sincroniza
    con la base de datos local, asegurando que el device_id se asigne.
    """
    try:
        mgmt = ManagementRoot(device.ip_address, username, password, token=True)
        print(f"Successfully connected to {device.hostname} ({device.ip_address})")

        f5_certs_stubs = mgmt.tm.sys.file.ssl_certs.get_collection()
        
        new_certs_count = 0
        updated_certs_count = 0

        for cert_stub in f5_certs_stubs:
            try:
                # Cargamos el objeto completo del certificado para obtener todos los detalles
                cert = mgmt.tm.sys.file.ssl_certs.ssl_cert.load(
                    name=cert_stub.name, partition=cert_stub.partition
                )
                
                cert_name = getattr(cert, 'name', 'N/A')
                
                # Lógica para extraer el Common Name del 'subject'
                subject_str = getattr(cert, 'subject', '') or getattr(cert, 'issuer', '')
                parts = subject_str.replace('/', ',').split(',')
                common_name = None
                for part in parts:
                    part = part.strip()
                    if part.startswith('CN='):
                        common_name = part[3:]
                        break
                
                issuer = getattr(cert, 'issuer', None)
                partition = getattr(cert, 'partition', 'Common')
                expiration_date_str = getattr(cert, 'expirationString', None)
                
                # Lógica para parsear la fecha de expiración
                expiration_dt = None
                if expiration_date_str:
                    try:
                        expiration_dt = datetime.strptime(expiration_date_str, '%b %d %H:%M:%S %Y %Z')
                    except ValueError:
                        print(f"WARN: Could not parse date string for cert '{cert_name}': {expiration_date_str}")
                else:
                    print(f"WARN: Certificate '{cert_name}' is missing expirationString attribute.")

                # --- LÓGICA DE BÚSQUEDA Y CREACIÓN CORREGIDA ---
                
                # Buscamos el certificado en nuestra BBDD por su nombre Y el ID del dispositivo.
                db_cert = db.query(Certificate).filter(
                    Certificate.name == cert_name,
                    Certificate.device_id == device.id 
                ).first()

                if db_cert:
                    # Si el certificado ya existe, actualizamos sus datos.
                    db_cert.common_name = common_name
                    db_cert.issuer = issuer
                    db_cert.expiration_date = expiration_dt
                    db_cert.last_scanned = datetime.utcnow()
                    updated_certs_count += 1
                else:
                    # Si el certificado es nuevo, lo creamos asignando el device_id.
                    new_cert = Certificate(
                        name=cert_name,
                        common_name=common_name,
                        issuer=issuer,
                        expiration_date=expiration_dt,
                        f5_device_hostname=device.hostname, # Guardamos el hostname como referencia
                        device_id=device.id,             # ¡LA CLAVE! Asignamos el ID del dispositivo padre
                        partition=partition,
                        last_scanned=datetime.utcnow()
                    )
                    db.add(new_cert)
                    new_certs_count += 1

            except Exception as e_inner:
                print(f"ERROR: Failed to process certificate stub '{getattr(cert_stub, 'name', 'UNKNOWN')}'. Skipping. Error: {e_inner}")
        
        result_message = f"Scan complete for {device.hostname}. New: {new_certs_count}, Updated: {updated_certs_count}."
        print(result_message)
        return {"status": "success", "message": result_message}

    except Exception as e_outer:
        import traceback
        error_message = f"FATAL ERROR during scan of {device.hostname}: {str(e_outer)}\n{traceback.format_exc()}"
        print(error_message)
        return {"status": "error", "message": str(e_outer)}


# -------------------------------------------------------------------
# FUNCIÓN DE LÓGICA DE DESPLIEGUE (sin cambios)
# -------------------------------------------------------------------
def deploy_and_update_f5(
    hostname: str, username: str, password: str,
    old_cert_name: str,
    pfx_data: bytes,
    pfx_password: Optional[str],
    chain_name: str = "DigiCert_Global_G2_TLS_RSA_SHA256_2020_CA1"
):
    """
    Desempaqueta un PFX, sube los archivos .crt y .key por separado,
    y actualiza los perfiles SSL. Este método es el más compatible.
    """
    mgmt = ManagementRoot(hostname, username, password, token=True)

    # 1. Desempaquetar el PFX para obtener el contenido
    try:
        pfx_password_bytes = pfx_password.encode('utf-8') if pfx_password else None
        private_key_obj, main_cert_obj, _ = pkcs12.load_key_and_certificates(pfx_data, pfx_password_bytes)
        
        cn = main_cert_obj.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)[0].value
        exp_date = main_cert_obj.not_valid_after_utc.strftime('%Y-%m-%d')
        
        new_cert_content = main_cert_obj.public_bytes(serialization.Encoding.PEM).decode('utf-8')
        new_key_content = private_key_obj.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        ).decode('utf-8')

        # 2. Construir los nombres de archivo que crearemos en el F5
        safe_cn = cn.replace('*.', 'star_').replace('.', '_')
        new_cert_name_on_f5 = f"{safe_cn}_{exp_date}.crt"
        new_key_name_on_f5 = f"{safe_cn}_{exp_date}.key"

    except Exception as e:
        raise ValueError(f"Could not read data from PFX. Is it valid and password correct? Details: {e}")

    # 3. Subir los archivos .crt y .key por separado
    # Este es el método que usa la API REST sin wrappers complejos
    session = mgmt._meta_data['icr_session']
    base_uri = f"https://{hostname}/mgmt/tm"

    try:
        # Subimos el certificado
        cert_payload = {'command': 'create', 'name': new_cert_name_on_f5, 'source-path': f"file-data:{new_cert_content}"}
        response = session.post(f"{base_uri}/sys/file/ssl-cert", json=cert_payload)
        # Si el archivo ya existe (409), no es un error. Para otros errores, fallamos.
        if response.status_code not in [200, 409]:
            response.raise_for_status()

        # Subimos la clave
        key_payload = {'command': 'create', 'name': new_key_name_on_f5, 'source-path': f"file-data:{new_key_content}"}
        response = session.post(f"{base_uri}/sys/file/ssl-key", json=key_payload)
        if response.status_code not in [200, 409]:
            response.raise_for_status()
            
        print(f"INFO: Successfully uploaded cert/key for '{new_cert_name_on_f5}'")

    except Exception as e:
        error_message = str(e)
        if hasattr(e, 'response') and e.response:
             try: error_message = e.response.json()['message']
             except: pass
        raise ValueError(f"Failed to upload files via API. F5 response: {error_message}")

    # 4. Encontrar y actualizar los perfiles SSL
    updated_profiles = []
    ssl_profiles = mgmt.tm.ltm.profile.client_ssls.get_collection()
    for profile in ssl_profiles:
        if any(old_cert_name in item.get('cert', '') for item in getattr(profile, 'certKeyChain', [])):
            print(f"INFO: Updating profile '{profile.name}'...")
            try:
                profile.modify(
                    certKeyChain=[{
                        'name': 'default',
                        'cert': f"/Common/{new_cert_name_on_f5}",
                        'key': f"/Common/{new_key_name_on_f5}",
                        'chain': f"/Common/{chain_name}"
                    }]
                )
                updated_profiles.append(profile.name)
            except F5SDKError as e_profile:
                print(f"ERROR: Could not update profile '{profile.name}'. Reason: {e_profile.response.text}")

    return { "new_cert_name": new_cert_name_on_f5, "updated_profiles": updated_profiles }

def get_certificate_usage(hostname: str, username: str, password: str, cert_name: str, partition: str):
    """
    Encuentra todos los perfiles SSL y Virtual Servers que usan un certificado específico.
    """
    usage_data = {
        "profiles": [],
        "virtual_servers": []
    }
    
    mgmt = ManagementRoot(hostname, username, password, token=True)
    
    # 1. Encontrar los perfiles SSL que usan el certificado
    ssl_profiles = mgmt.tm.ltm.profile.client_ssls.get_collection(params={'partition': partition})
    for profile in ssl_profiles:
        # Revisamos la cadena de cert/key del perfil
        if any(cert_name in item.get('cert', '') for item in getattr(profile, 'certKeyChain', [])):
            usage_data["profiles"].append(profile.fullPath)
    
    if not usage_data["profiles"]:
        return usage_data # Si no se usa en ningún perfil, no puede estar en ningún VS

    # 2. Encontrar los Virtual Servers que usan esos perfiles
    virtual_servers = mgmt.tm.ltm.virtuals.get_collection(params={'partition': partition})
    for vs in virtual_servers:
        # Un VS puede tener múltiples perfiles. Iteramos sobre ellos.
        vs_profiles = [p.fullPath for p in vs.profiles_s.get_collection()]
        
        # Comprobamos si alguno de los perfiles del VS está en nuestra lista de perfiles que usan el cert
        if any(profile_path in vs_profiles for profile_path in usage_data["profiles"]):
            vs_info = {
                "name": vs.fullPath,
                "destination": getattr(vs, 'destination', 'N/A').split('/')[-1], # ej: 10.10.10.5:443
                "state": getattr(vs, 'enabled', True) # Asumimos 'enabled' si no está 'disabled'
            }
            usage_data["virtual_servers"].append(vs_info)
            
    return usage_data

def delete_certificate_from_f5(hostname: str, username: str, password: str, cert_name: str, partition: str):
    mgmt = ManagementRoot(hostname, username, password, token=True)
    
    # CAMBIO 3: Corregimos la lógica para obtener el nombre de la clave
    try:
        cert_obj = mgmt.tm.sys.file.ssl_certs.ssl_cert.load(name=cert_name, partition=partition)
        key_full_path = getattr(cert_obj, 'key', '')
        if not key_full_path:
            key_name_only = cert_name.rsplit('.crt', 1)[0]
            key_name = key_name_only
        else:
            key_name = key_full_path.strip('/').split('/')[-1]
    except F5SDKError as e:
        if e.response.status_code == 404:
            print(f"WARN: Certificate '{cert_name}' not found on {hostname} to get key name. Assuming default name.")
            key_name = cert_name.rsplit('.crt', 1)[0]
        else:
            raise ValueError(f"F5 API Error: {e}")

    # Ahora procedemos a borrar
    try:
        # Re-cargamos el objeto por si acaso, y lo borramos
        cert_obj_to_delete = mgmt.tm.sys.file.ssl_certs.ssl_cert.load(name=cert_name, partition=partition)
        cert_obj_to_delete.delete()
        print(f"INFO: Successfully deleted certificate '{cert_name}' from {hostname}.")
    except F5SDKError as e:
        if e.response.status_code == 404:
            print(f"WARN: Certificate '{cert_name}' not found on {hostname} during deletion. Skipping.")
        else:
            raise ValueError(f"F5 API Error during certificate deletion: {e}")

    try:
        key_obj = mgmt.tm.sys.file.ssl_keys.ssl_key.load(name=key_name, partition=partition)
        key_obj.delete()
        print(f"INFO: Successfully deleted key '{key_name}' from {hostname}.")
    except F5SDKError as e:
        if e.response.status_code == 404:
            print(f"WARN: Key '{key_name}' not found on {hostname} during deletion. Skipping.")
        else:
            raise ValueError(f"F5 API Error during key deletion: {e}")
    
    return {"status": "success", "message": f"Deletion process for {cert_name} completed."}

def export_key_and_create_csr(hostname: str, username: str, password: str, db_cert: Certificate):
    """
    Exporta la clave privada de un certificado existente y genera un nuevo CSR
    usando los datos del certificado guardados en nuestra base de datos.
    """
    mgmt = ManagementRoot(hostname, username, password, token=True)
    
    # Extraemos el nombre y la partición del certificado desde el objeto db_cert
    cert_name = db_cert.name
    partition = db_cert.partition if hasattr(db_cert, 'partition') else 'Common'
    
    try:
        cert_obj = mgmt.tm.sys.file.ssl_certs.ssl_cert.load(name=cert_name, partition=partition)
        
        # Obtenemos el path completo de la clave que el certificado dice que usa
        key_full_path = getattr(cert_obj, 'key', '')
        
        # Si por alguna razón no tiene el path, construimos el nombre sin la extensión .crt
        if not key_full_path:
            key_name_only = cert_name.rsplit('.crt', 1)[0]
            key_full_path = f'/{partition}/{key_name_only}'
        
        # Extraemos el nombre y la partición del path completo
        key_partition, key_name = key_full_path.strip('/').split('/')

    except Exception as e:
        raise ValueError(f"Could not find certificate or its associated key '{cert_name}' on F5. Error: {e}")

    # --- MÉTODO DEFINITIVO DE EXTRACCIÓN DE CLAVE ---
    try:
        print(f"INFO: Attempting to download key '{key_name}' from partition '{key_partition}'...")
        
        # 1. Obtenemos el objeto de la clave sin cargarlo por completo
        key_obj = mgmt.tm.sys.file.ssl_keys.ssl_key.get_collection(
            params={'filter': f'name eq {key_name} and partition eq {key_partition}'}
        )[0]

        # 2. Usamos el método de descarga de bajo nivel
        # Esto devuelve un objeto de respuesta de la librería 'requests'
        response = mgmt.shared.file_transfer.downloads.download_file(
            key_obj.selfLink.replace('https://localhost', ''),
            'temp_key.key' # Nombre temporal, no se usa
        )
        
        # 3. Leemos el contenido de la respuesta
        key_pem_content = response.text
        
        if "-----BEGIN" not in key_pem_content:
             raise ValueError("Downloaded content does not appear to be a valid PEM key.")

        print("INFO: Private key downloaded successfully.")

    except Exception as e:
        print(f"ERROR: Failed to download key. Error: {e}")
        raise ValueError(f"Could not extract private key content for '{key_name}'. This may require specific permissions or be due to F5 version incompatibility.")

    # --- La generación del CSR se queda igual ---
    try:
        private_key = serialization.load_pem_private_key(key_pem_content.encode(), password=None)
        
        # --- LÓGICA DE CONSTRUCCIÓN DE CSR USANDO NUESTRA BBDD ---
        
        # 1. Creamos una lista para los atributos del "Subject"
        subject_attrs = []
        
        # 2. Usamos el common_name que ya tenemos en nuestra base de datos
        if db_cert.common_name:
            subject_attrs.append(x509.NameAttribute(NameOID.COMMON_NAME, db_cert.common_name))
        
        # Opcional: Podríamos añadir más campos si los guardáramos en la BBDD en el futuro
        # (ej. db_cert.organization, db_cert.locality, etc.)
        
        subject_name = x509.Name(subject_attrs)
        
        builder = x509.CertificateSigningRequestBuilder().subject_name(subject_name)

        # 3. Opcional pero recomendado: Si el CN es un wildcard, añadirlo como SAN
        if db_cert.common_name and db_cert.common_name.startswith('*.'):
            # Añadimos el wildcard y el dominio base como SANs
            sans = [
                x509.DNSName(db_cert.common_name),
                x509.DNSName(db_cert.common_name[2:]) # El dominio sin el '*.'
            ]
            builder = builder.add_extension(x509.SubjectAlternativeName(sans), critical=False)

        # Firmamos y serializamos
        csr = builder.sign(private_key, hashes.SHA256())
        csr_pem = csr.public_bytes(serialization.Encoding.PEM).decode('utf-8')

    except Exception as e:
        raise ValueError(f"Failed to generate CSR with the exported key. Error: {e}")

    return { "private_key": key_pem_content, "csr": csr_pem }

def get_realtime_certs_from_f5(hostname: str, username: str, password: str, device_id: int):
    """
    Se conecta a un F5 y devuelve una lista de sus certificados con un formato
    compatible con nuestro schema CertificateResponse.
    """
    mgmt = ManagementRoot(hostname, username, password, token=True)
    f5_certs = mgmt.tm.sys.file.ssl_certs.get_collection()
    
    cert_list = []
    for cert_stub in f5_certs:
        try:
            cert = mgmt.tm.sys.file.ssl_certs.ssl_cert.load(
                name=cert_stub.name, partition=cert_stub.partition
            )

            expiration_dt = None
            exp_str = getattr(cert, 'expirationString', None)
            if exp_str:
                expiration_dt = datetime.strptime(exp_str, '%b %d %H:%M:%S %Y %Z')

            # --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
            cert_data = {
                "id": cert.generation,
                "name": cert.name,
                "common_name": getattr(cert, 'commonName', None),
                "issuer": getattr(cert, 'issuer', None),
                "f5_device_hostname": hostname,
                "partition": cert.partition,
                "expiration_date": expiration_dt,
                "days_remaining": (expiration_dt - datetime.utcnow()).days if expiration_dt else None,
                "device_id": device_id, # <-- AÑADIMOS EL ID DEL DISPOSITIVO
            }
            cert_list.append(cert_data)
        except Exception as e:
            print(f"WARN: Could not process certificate '{cert_stub.name}'. Error: {e}")
    
    return cert_list

def update_profiles_with_new_cert(
    hostname: str, username: str, password: str,
    old_cert_name: str,
    new_cert_name: str, 
    chain_name: str
):
    """
    Busca perfiles SSL y los actualiza usando el nombre base del objeto,
    imitando el comportamiento de la GUI del F5.
    """
    mgmt = ManagementRoot(hostname, username, password, token=True)

    
    new_object_name = new_cert_name
    
   
    chain_ref = f"/Common/{chain_name}"

    updated_profiles = []
    ssl_profiles = mgmt.tm.ltm.profile.client_ssls.get_collection()
    
    for profile in ssl_profiles:
        if any(old_cert_name in item.get('cert', '') for item in getattr(profile, 'certKeyChain', [])):
            print(f"INFO: Updating profile '{profile.name}' to use object '{new_object_name}'")
            try:
                profile.modify(
                    certKeyChain=[{
                        'name': 'default', 
                        'cert': f"/Common/{new_object_name}",
                        'key': f"/Common/{new_object_name}",
                        'chain': chain_ref
                    }]
                )
                updated_profiles.append(profile.name)
            except F5SDKError as e_profile:
                error_text = e_profile.response.text
                print(f"ERROR: Could not update profile '{profile.name}'. Reason: {error_text}")
                raise ValueError(f"Failed to update profile '{profile.name}': {error_text}")
    
    return updated_profiles

def get_realtime_chains_from_f5(hostname: str, username: str, password: str):
    """
    Se conecta a un F5 y devuelve una lista de los nombres de los
    certificados que pueden ser usados como cadenas (chains).
    Técnicamente, son los mismos objetos que los certificados normales.
    """
    mgmt = ManagementRoot(hostname, username, password, token=True)
    # La API no distingue entre "certs" y "chains", son el mismo tipo de objeto.
    # La GUI los separa lógicamente, pero nosotros obtenemos todos.
    f5_certs = mgmt.tm.sys.file.ssl_certs.get_collection()
    
    # Devolvemos solo los nombres completos (ej. /Common/DigiCert_Global_G2...)
    # para que el usuario pueda elegir.
    chain_names = [cert.fullPath for cert in f5_certs]
    return sorted(chain_names)

