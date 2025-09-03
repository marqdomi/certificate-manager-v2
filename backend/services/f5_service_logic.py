from __future__ import annotations
from typing import Optional
def derive_object_name_from_pem(cert_pem: str) -> str:
    """
    Given a PEM certificate, sanitize and derive a safe F5 object name: <safe_cn>_<not_after>
    """
    cert_pem_clean = _sanitize_pem_cert(cert_pem)
    cert_obj = x509.load_pem_x509_certificate(cert_pem_clean.encode("utf-8"))
    cn = cert_obj.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)[0].value
    not_after = _get_not_after_dt(cert_obj).date().isoformat()
    safe_cn = cn.replace("*.", "star_").replace(".", "_")
    return f"{safe_cn}_{not_after}"

def derive_object_name_from_pfx(pfx_data: bytes, pfx_password: Optional[str]) -> str:
    """
    Given a PFX (PKCS12) file and password, derive a safe F5 object name: <safe_cn>_<not_after>
    """
    pfx_password_bytes = pfx_password.encode("utf-8") if pfx_password else None
    _key_obj, cert_obj, _extra = pkcs12.load_key_and_certificates(pfx_data, pfx_password_bytes)
    cn = cert_obj.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)[0].value
    not_after = _get_not_after_dt(cert_obj).date().isoformat()
    safe_cn = cn.replace("*.", "star_").replace(".", "_")
    return f"{safe_cn}_{not_after}"
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
import time
# ----------------------------
# Helper utilities (REST upload + tmsh + PEM sanitize)
# ----------------------------
from typing import Tuple
import math
import requests

def _sanitize_pem_cert(cert_pem: str) -> str:
    """Re-serializa el certificado a un PEM canónico (limpio)."""
    cert = x509.load_pem_x509_certificate(cert_pem.encode('utf-8'))
    return cert.public_bytes(serialization.Encoding.PEM).decode('utf-8')

def _get_not_after_dt(cert_obj) -> datetime:
    """Compatibilidad entre versiones de cryptography para obtener not_valid_after."""
    try:
        return cert_obj.not_valid_after_utc  # cryptography >= 42
    except AttributeError:
        return cert_obj.not_valid_after      # versiones anteriores

def _rest_upload_bytes(mgmt: ManagementRoot, data: bytes, remote_filename: str, timeout: int = 120) -> str:
    """Sube bytes a /var/config/rest/downloads/<remote_filename> usando uploads (chunked)."""
    session: requests.Session = mgmt._meta_data['icr_session']
    uri = f"https://{mgmt.hostname}/mgmt/shared/file-transfer/uploads/{remote_filename}"
    size = len(data)
    chunk = 1024 * 1024  # 1 MiB
    start = 0
    while start < size:
        end = min(start + chunk, size)
        # Content-Range: start-end/total  (end es inclusivo)
        content_range = f"{start}-{end - 1}/{size}"
        headers = {
            'Content-Type': 'application/octet-stream',
            'Content-Range': content_range
        }
        resp = session.post(uri, data=data[start:end], headers=headers, timeout=timeout)
        if resp.status_code not in (200, 202):
            raise ValueError(f"Upload failed for {remote_filename}: {resp.status_code} {resp.text}")
        start = end
    # Archivo quedará en /var/config/rest/downloads/<remote_filename>
    return f"/var/config/rest/downloads/{remote_filename}"

def _tmsh_run(mgmt: ManagementRoot, cmd: str, timeout: int = 120) -> str:
    session: requests.Session = mgmt._meta_data['icr_session']
    uri = f"https://{mgmt.hostname}/mgmt/tm/util/bash"
    payload = {"command": "run", "utilCmdArgs": f"-c \"{cmd}\""}
    resp = session.post(uri, json=payload, timeout=timeout)
    if resp.status_code not in (200, 202):
        raise ValueError(f"tmsh run failed: {resp.status_code} {resp.text}")
    return resp.json().get('commandResult', '')

import re

def _parse_openssl_text(openssl_text: str) -> dict:
    """Extrae campos clave del texto de `openssl x509 -text`."""
    info = {"version": None, "san": [], "serial": None, "not_after": None, "subject": None, "issuer": None}
    # Version
    m = re.search(r"Version:\s*(\d+)", openssl_text)
    if m:
        info["version"] = m.group(1)
    # Serial
    m = re.search(r"Serial Number:\s*([0-9A-F:]+)", openssl_text, re.IGNORECASE)
    if m:
        info["serial"] = m.group(1)
    # Not After
    m = re.search(r"Not After\s*:\s*(.*)", openssl_text)
    if m:
        info["not_after"] = m.group(1).strip()
    # Subject
    m = re.search(r"Subject:\s*(.*)", openssl_text)
    if m:
        info["subject"] = m.group(1).strip()
    # Issuer
    m = re.search(r"Issuer:\s*(.*)", openssl_text)
    if m:
        info["issuer"] = m.group(1).strip()
    # SAN block
    san_block = re.search(r"X509v3 Subject Alternative Name:\s*\n\s*((?:.+\n)+?)\n\s*X509v3", openssl_text)
    if not san_block:
        # Try until end of string
        san_block = re.search(r"X509v3 Subject Alternative Name:\s*\n\s*((?:.+\n)+)", openssl_text)
    if san_block:
        entries = [s.strip() for s in san_block.group(1).strip().split(',')]
        # Flatten lines
        flat = []
        for line in entries:
            flat.extend([p.strip() for p in line.split(',') if p.strip()])
        info["san"] = [re.sub(r"^(DNS:|IP Address:)", "", x).strip() for x in flat if x]
    return info

def _parse_tmsh_oneline_cert(output: str) -> dict:
    """Parsea la salida de 'tmsh list sys file ssl-cert <name> one-line'."""
    # Ejemplo de línea:
    # sys file ssl-cert star_identifix_com_2026-08-04 { ... version 3 subject-alternative-name "DNS:*.identifix.com, DNS:identifix.com" fingerprint SHA256/05:97:... }
    info = {
        "version": None,
        "san": [],
        "serial": None,
        "not_after": None,
        "subject": None,
        "issuer": None,
        "fingerprint_sha256": None,
        "object_name": None,
        "source": "tmsh-list",
    }
    line = output.strip()
    if not line:
        return info
    # object name
    m = re.search(r"sys file ssl-cert\s+([^\s{]+)", line)
    if m:
        info["object_name"] = m.group(1)
    # version
    m = re.search(r"\bversion\s+(\d+)", line)
    if m:
        info["version"] = m.group(1)
    # SAN (quoted)
    m = re.search(r"subject-alternative-name\s+\"([^\"]*)\"", line)
    if m:
        raw = m.group(1)
        parts = [p.strip() for p in raw.split(',') if p.strip()]
        sans = []
        for p in parts:
            p = re.sub(r"^(DNS:|IP Address:)\s*", "", p)
            if p:
                sans.append(p)
        info["san"] = sans
    # serial
    m = re.search(r"\bserial-number\s+([0-9A-F:]+)", line, re.IGNORECASE)
    if m:
        info["serial"] = m.group(1)
    # not_after (expiration-string)
    m = re.search(r"expiration-string\s+\"([^\"]+)\"", line)
    if m:
        info["not_after"] = m.group(1)
    # subject
    m = re.search(r"\bsubject\s+\"([^\"]+)\"", line)
    if m:
        info["subject"] = m.group(1)
    # issuer
    m = re.search(r"\bissuer\s+\"([^\"]+)\"", line)
    if m:
        info["issuer"] = m.group(1)
    # fingerprint SHA256/..  (tomamos la parte después de la barra)
    m = re.search(r"fingerprint\s+SHA256/([0-9A-F:]+)", line)
    if m:
        info["fingerprint_sha256"] = m.group(1)
    return info

def verify_cert_object(mgmt: ManagementRoot, object_name: str) -> dict:
    """Verifica usando filestore (tmsh list) sin depender de rutas en /config/ssl/ssl.crt."""
    # 1) Intento principal: tmsh one-line
    out = _tmsh_run(mgmt, f"tmsh list sys file ssl-cert {object_name} one-line")
    details = _parse_tmsh_oneline_cert(out)
    if details.get("version") or details.get("san") or details.get("fingerprint_sha256"):
        return details
    # 2) Fallback: listar multiline y parsear con regex simples
    out_ml = _tmsh_run(mgmt, f"tmsh list sys file ssl-cert {object_name}")
    # Reutilizamos el parser de openssl si detectamos bloque SAN/Version en texto
    # (algunas builds incluyen el cert PEM en el list)
    parsed_os = _parse_openssl_text(out_ml)
    if parsed_os.get("version") or parsed_os.get("san"):
        parsed_os.update({"object_name": object_name, "source": "tmsh-list-ml"})
        return parsed_os
    # 3) Fallback final: intentar descargar el archivo vía REST $download y pasar openssl
    try:
        # Ruta REST del objeto (selfLink) puede variar; intentamos usar el endpoint JSON
        cert_res = mgmt.tm.sys.file.ssl_certs.ssl_cert.load(name=object_name)
        # $download devuelve el archivo; guardamos temporalmente en /var/tmp y lo inspeccionamos
        # Nota: la librería f5-sdk no expone directo $download aquí; usamos util/bash para leer el contenido del objeto si está incrustado
        # Como último recurso, devolvemos lo que tengamos del list
        fallback = {"object_name": object_name, "source": "tmsh-list-empty"}
        fallback.update({k: None for k in ("version","san","serial","not_after","subject","issuer","fingerprint_sha256")})
        return fallback
    except Exception:
        fb = {"object_name": object_name, "source": "not-found"}
        fb.update({k: None for k in ("version","san","serial","not_after","subject","issuer","fingerprint_sha256")})
        return fb
    
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
# NUEVAS FUNCIONES DE DESPLIEGUE: PEM y PFX, y alias legacy
# -------------------------------------------------------------------

def _install_cert_and_key_from_local(mgmt: ManagementRoot, cert_local_path: str, key_local_path: str, object_name: str, timeout: int = 120) -> None:
    # Instala el cert y key en objetos sys crypto usando rutas locales ya subidas
    _tmsh_run(mgmt, f"tmsh install sys crypto cert {object_name} from-local-file {cert_local_path}", timeout=timeout)
    _tmsh_run(mgmt, f"tmsh install sys crypto key {object_name} from-local-file {key_local_path}", timeout=timeout)

def _install_chain_from_local(mgmt: ManagementRoot, chain_local_path: str, chain_object_name: str, timeout: int = 120) -> None:
    _tmsh_run(mgmt, f"tmsh install sys crypto cert {chain_object_name} from-local-file {chain_local_path}", timeout=timeout)

def deploy_from_pem_and_update_profiles(
    hostname: str, username: str, password: str,
    old_cert_name: str,
    cert_pem: str,
    key_pem: str,
    chain_name: str = "DigiCert_Global_G2_TLS_RSA_SHA256_2020_CA1",
    timeout: int = 60,
):
    """
    Sube cert/key por file-transfer + instala con tmsh (como la GUI),
    y actualiza los perfiles SSL que usaban old_cert_name.
    """
    mgmt = ManagementRoot(hostname, username, password, token=True)

    # 1) Sanitizar PEM de certificado y asegurar que es v3 con SAN (opcional validar aquí)
    cert_pem_clean = _sanitize_pem_cert(cert_pem)

    # 2) Derivar nombre estable del objeto/archivo
    cert_obj = x509.load_pem_x509_certificate(cert_pem_clean.encode('utf-8'))
    cn = cert_obj.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)[0].value
    not_after = _get_not_after_dt(cert_obj).date().isoformat()
    safe_cn = cn.replace('*.', 'star_').replace('.', '_')
    object_name = f"{safe_cn}_{not_after}"
    cert_filename = f"{object_name}.crt"
    key_filename = f"{object_name}.key"

    # 3) Upload a /var/config/rest/downloads
    cert_path = _rest_upload_bytes(mgmt, cert_pem_clean.encode('utf-8'), cert_filename, timeout=timeout)
    key_path = _rest_upload_bytes(mgmt, key_pem.encode('utf-8'), key_filename, timeout=timeout)

    # 4) Instalar con tmsh (equivalente a GUI)
    _install_cert_and_key_from_local(mgmt, cert_path, key_path, object_name, timeout=timeout)

    # Post-install verification: check version and SAN via openssl
    details = verify_cert_object(mgmt, object_name)
    if str(details.get("version")) != "3":
        raise ValueError("Post-install verification failed: certificate is not Version 3 on device.")
    if not details.get("san"):
        # No SAN found; warning or error depending on policy
        raise ValueError("Post-install verification failed: SAN extension not found on installed certificate.")

    # --- SAFEGUARD: do NOT update profiles if no old_cert_name was provided ---
    if not old_cert_name or str(old_cert_name).strip() == "" or str(old_cert_name).lower() in ("none", "null"):
        # We only return information about the newly installed objects; profiles remain untouched
        return {
            "new_cert_object": object_name,
            "new_cert_name": f"{object_name}.crt",
            "new_key_name": f"{object_name}.key",
            "updated_profiles": [],
            "verification": details
        }

    # 5) Actualizar perfiles
    updated_profiles = []
    ssl_profiles = mgmt.tm.ltm.profile.client_ssls.get_collection()
    chain_ref = f"/Common/{chain_name}"
    for profile in ssl_profiles:
        if any(old_cert_name in item.get('cert', '') for item in getattr(profile, 'certKeyChain', [])):
            profile.modify(
                certKeyChain=[{
                    'name': 'default',
                    # Referenciamos por nombre de objeto, sin extensión, como hace la GUI
                    'cert': f"/Common/{object_name}",
                    'key': f"/Common/{object_name}",
                    'chain': chain_ref
                }]
            )
            updated_profiles.append(profile.name)

    return {
        "new_cert_object": object_name,               # nombre del objeto en F5 (sin extensión)
        "new_cert_name": f"{object_name}.crt",       # compatibilidad con respuesta previa
        "new_key_name": f"{object_name}.key",        # informativo
        "updated_profiles": updated_profiles,
        "verification": details
    }

def deploy_from_pfx_and_update_profiles(
    hostname: str, username: str, password: str,
    old_cert_name: str,
    pfx_data: bytes,
    pfx_password: Optional[str],
    chain_name: str = "DigiCert_Global_G2_TLS_RSA_SHA256_2020_CA1",
    install_chain_from_pfx: bool = False,
    timeout: int = 60,
):
    """Desempaqueta PFX, sanea PEM, sube por file-transfer, instala con tmsh y actualiza perfiles."""
    mgmt = ManagementRoot(hostname, username, password, token=True)
    try:
        pfx_password_bytes = pfx_password.encode('utf-8') if pfx_password else None
        private_key_obj, main_cert_obj, additional_certs = pkcs12.load_key_and_certificates(pfx_data, pfx_password_bytes)
    except Exception as e:
        raise ValueError(f"Could not read data from PFX. Is the password correct? Details: {e}")

    cn = main_cert_obj.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)[0].value
    not_after = _get_not_after_dt(main_cert_obj).date().isoformat()
    cert_pem = main_cert_obj.public_bytes(serialization.Encoding.PEM).decode('utf-8')
    key_pem = private_key_obj.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')
    chain_pem = None
    if additional_certs:
        chain_pem = "".join([c.public_bytes(serialization.Encoding.PEM).decode("utf-8") for c in additional_certs])

    # Respect flag to avoid installing chain objects from the PFX unless explicitly requested
    if not install_chain_from_pfx:
        chain_pem = None

    if chain_pem:
        # Instalar chain y usarla en el profile
        cn = main_cert_obj.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)[0].value
        not_after = _get_not_after_dt(main_cert_obj).date().isoformat()
        safe_cn = cn.replace("*.", "star_").replace(".", "_")
        chain_object_name = f"{safe_cn}_{not_after}_chain"
        chain_filename = f"{chain_object_name}.crt"
        chain_path = _rest_upload_bytes(mgmt, chain_pem.encode('utf-8'), chain_filename, timeout=timeout)
        _install_chain_from_local(mgmt, chain_path, chain_object_name, timeout=timeout)
        return deploy_from_pem_and_update_profiles(
            hostname=hostname, username=username, password=password,
            old_cert_name=old_cert_name,
            cert_pem=cert_pem, key_pem=key_pem, chain_name=chain_object_name,
            timeout=timeout
        )
    else:
        return deploy_from_pem_and_update_profiles(
            hostname=hostname, username=username, password=password,
            old_cert_name=old_cert_name,
            cert_pem=cert_pem, key_pem=key_pem, chain_name=chain_name,
            timeout=timeout
        )

# Alias para mantener compatibilidad con llamadas antiguas que usaban el nombre anterior
def deploy_and_update_f5(
    hostname: str, username: str, password: str,
    old_cert_name: str,
    pfx_data: bytes,
    pfx_password: Optional[str],
    chain_name: str = "DigiCert_Global_G2_TLS_RSA_SHA256_2020_CA1",
    install_chain_from_pfx: bool = False
):
    return deploy_from_pfx_and_update_profiles(
        hostname=hostname, username=username, password=password,
        old_cert_name=old_cert_name,
        pfx_data=pfx_data, pfx_password=pfx_password,
        chain_name=chain_name,
        install_chain_from_pfx=install_chain_from_pfx
    )

# Sube e instala cert+key (sin tocar perfiles)
def upload_cert_and_key(hostname: str, username: str, password: str, cert_content: str, key_content: str) -> dict:
    mgmt = ManagementRoot(hostname, username, password, token=True)
    # Sanitiza y crea nombre
    cert_clean = _sanitize_pem_cert(cert_content)
    cert_obj = x509.load_pem_x509_certificate(cert_clean.encode('utf-8'))
    cn = cert_obj.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)[0].value
    not_after = _get_not_after_dt(cert_obj).date().isoformat()
    safe_cn = cn.replace('*.', 'star_').replace('.', '_')
    object_name = f"{safe_cn}_{not_after}"
    cert_filename = f"{object_name}.crt"
    key_filename = f"{object_name}.key"

    cert_path = _rest_upload_bytes(mgmt, cert_clean.encode('utf-8'), cert_filename)
    key_path = _rest_upload_bytes(mgmt, key_content.encode('utf-8'), key_filename)

    _install_cert_and_key_from_local(mgmt, cert_path, key_path, object_name)
    return {"object_name": object_name, "cert": f"{object_name}.crt", "key": f"{object_name}.key"}

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
                "state": getattr(vs, 'enabled', True), # Asumimos 'enabled' si no está 'disabled'
                "profiles": vs_profiles
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
    chain_name: str,
    selected_profiles: Optional[list] = None,
    timeout: int = 60,
):
    """
    Busca perfiles SSL y los actualiza usando el nombre base del objeto,
    imitando el comportamiento de la GUI del F5.
    Si selected_profiles es provisto, solo modifica los perfiles cuyo nombre o fullPath coincida.
    """
    # Note: "timeout" is accepted for compatibility with callers; current F5 SDK modify calls do not expose a timeout,
    # but we keep the parameter to avoid unexpected-keyword errors and for future use.
    mgmt = ManagementRoot(hostname, username, password, token=True)

    new_object_name = new_cert_name
    chain_ref = f"/Common/{chain_name}"

    updated_profiles = []
    ssl_profiles = mgmt.tm.ltm.profile.client_ssls.get_collection()

    sel_names = set()
    if selected_profiles:
        for item in selected_profiles:
            if isinstance(item, str):
                sel_names.add(item)
                # Add tail part if fullPath
                if '/' in item:
                    sel_names.add(item.split('/')[-1])

    for profile in ssl_profiles:
        # If selected_profiles is set, only proceed if match
        if selected_profiles:
            if (profile.fullPath not in sel_names) and (profile.name not in sel_names):
                continue
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


# Semantic alias for API: preview_certificate_usage
def preview_certificate_usage(hostname: str, username: str, password: str, cert_name: str, partition: str):
    return get_certificate_usage(hostname, username, password, cert_name, partition)

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



# ----------------------------
# Helpers de FALLBACK para construir caché sin depender de certs locales
# ----------------------------

def _safe_tail(path: Optional[str]) -> Optional[str]:
    if not path or not isinstance(path, str):
        return None
    return path.strip().split('/')[-1] or None


def list_client_ssl_profiles_bulk(hostname: str, username: str, password: str):
    """
    Devuelve información "bulk" de client-ssl profiles para usar en el caché
    cuando no tenemos certificados locales. Incluye el cert referenciado.

    Retorno: lista de diccionarios con:
      - name, partition, fullPath, context="clientside"
      - cert_full (p.ej. /Common/foo), cert_name (tail sin partición)
      - key_full, chain_full (si existen)
    """
    mgmt = ManagementRoot(hostname, username, password, token=True)
    out = []
    for prof in mgmt.tm.ltm.profile.client_ssls.get_collection():
        ckc = getattr(prof, 'certKeyChain', []) or []
        cert_full = None
        key_full = None
        chain_full = None
        if ckc:
            # Usamos el primer elemento como hace la GUI (name=default)
            first = dict(ckc[0])
            cert_full = first.get('cert')
            key_full = first.get('key')
            chain_full = first.get('chain')
        out.append({
            "name": getattr(prof, 'name', None),
            "partition": getattr(prof, 'partition', 'Common'),
            "fullPath": getattr(prof, 'fullPath', None) or f"/{getattr(prof,'partition','Common')}/{getattr(prof,'name', '')}",
            "context": "clientside",
            "cert_full": cert_full,
            "cert_name": _safe_tail(cert_full),
            "key_full": key_full,
            "chain_full": chain_full,
        })
    return out


def get_all_ssl_profiles(hostname: str, username: str, password: str):
    """
    Alias semántico usado por el cache-builder para el modo fallback.
    Devuelve la misma estructura que list_client_ssl_profiles_bulk().
    """
    return list_client_ssl_profiles_bulk(hostname, username, password)


def list_virtuals_min(hostname: str, username: str, password: str):
    """
    Devuelve info mínima de Virtual Servers y los perfiles aplicados.
    Retorna lista de dicts:
      { fullPath, partition, name, destination, servicePort, enabled, profiles: [fullPath_de_profile, ...] }
    """
    mgmt = ManagementRoot(hostname, username, password, token=True)
    out = []
    for vs in mgmt.tm.ltm.virtuals.get_collection():
        try:
            profs = vs.profiles_s.get_collection()
            prof_paths = [getattr(p, 'fullPath', None) or f"/{getattr(p,'partition','Common')}/{getattr(p,'name','')}" for p in profs]
        except Exception:
            prof_paths = []
        full_path = getattr(vs, 'fullPath', None) or f"/{getattr(vs,'partition','Common')}/{getattr(vs,'name','')}"
        # destination suele venir como '/Common/1.2.3.4:443' o '1.2.3.4:443'
        raw_dest = getattr(vs, 'destination', None)
        dest_tail = (raw_dest or '').split('/')[-1] if raw_dest else None
        # Extraer puerto si existe
        svc_port = None
        if dest_tail and ':' in dest_tail:
            try:
                svc_port = int(dest_tail.split(':')[-1])
            except Exception:
                svc_port = None
        enabled = True
        # Algunas versiones exponen 'disabled' o 'enabled' como booleano/cadena
        if hasattr(vs, 'disabled') and getattr(vs, 'disabled'):
            enabled = False
        elif hasattr(vs, 'state'):
            # e.g. 'enabled' / 'disabled'
            enabled = str(getattr(vs, 'state')).lower().startswith('enab')
        out.append({
            "fullPath": full_path,
            "partition": getattr(vs, 'partition', 'Common'),
            "name": getattr(vs, 'name', None),
            "destination": dest_tail,
            "servicePort": svc_port,
            "enabled": enabled,
            "profiles": prof_paths,
        })
    return out


def get_ssl_profile_vips(hostname: str, username: str, password: str, profile_fullpath: str):
    """
    Dado el fullPath de un client-ssl profile, devuelve la lista de VS que referencian ese perfil.
    Retorna lista de diccionarios:
      { name, fullPath, partition, destination, servicePort, enabled }
    """
    target = profile_fullpath
    target_tail = _safe_tail(profile_fullpath)
    vips = []
    for vs in list_virtuals_min(hostname, username, password):
        profs = vs.get('profiles') or []
        if any(p == target or _safe_tail(p) == target_tail for p in profs):
            vips.append({
                "name": vs.get("name"),
                "fullPath": vs.get("fullPath"),
                "partition": vs.get("partition"),
                "destination": vs.get("destination"),
                "servicePort": vs.get("servicePort"),
                "enabled": vs.get("enabled"),
            })
    return vips

# ----------------------------
# Normalización de nombres de objetos (remover .crt/.key en el nombre)
# ----------------------------

def _list_client_ssl_profiles(mgmt: ManagementRoot):
    return mgmt.tm.ltm.profile.client_ssls.get_collection()

def _rename_cert_object(mgmt: ManagementRoot, old: str, new: str, timeout: int = 120) -> None:
    _tmsh_run(mgmt, f"tmsh mv sys file ssl-cert {old} {new}", timeout=timeout)

def _rename_key_object(mgmt: ManagementRoot, old: str, new: str, timeout: int = 120) -> None:
    _tmsh_run(mgmt, f"tmsh mv sys file ssl-key {old} {new}", timeout=timeout)

def _update_profiles_reference(mgmt: ManagementRoot, old_name: str, new_name: str) -> list:
    """Cambia referencias en client-ssl profiles de /Common/old_name(.crt|.key) a /Common/new_name."""
    updated = []
    for prof in _list_client_ssl_profiles(mgmt):
        ckc = getattr(prof, 'certKeyChain', []) or []
        changed = False
        new_ckc = []
        for item in ckc:
            item = dict(item)
            for field in ('cert','key','chain'):
                if field in item and isinstance(item[field], str):
                    # Normalizamos comparando solo el nombre final
                    tail = item[field].split('/')[-1]
                    if tail == old_name or tail == f"{old_name}.crt" or tail == f"{old_name}.key":
                        item[field] = f"/Common/{new_name}"
                        changed = True
            new_ckc.append(item)
        if changed:
            prof.modify(certKeyChain=new_ckc)
            updated.append(prof.name)
    return updated

def normalize_object_names(hostname: str, username: str, password: str) -> dict:
    mgmt = ManagementRoot(hostname, username, password, token=True)
    certs = mgmt.tm.sys.file.ssl_certs.get_collection()
    keys  = mgmt.tm.sys.file.ssl_keys.get_collection()

    to_fix_certs = [c.name for c in certs if c.name.endswith('.crt')]
    to_fix_keys  = [k.name for k in keys  if k.name.endswith('.key')]

    report = {"renamed_certs": [], "renamed_keys": [], "updated_profiles": []}

    # Renombrar certs
    for old in to_fix_certs:
        new = old[:-4]  # remove .crt
        try:
            _rename_cert_object(mgmt, old, new)
            report["renamed_certs"].append({"old": old, "new": new})
            # Actualizar perfiles que referencien el viejo nombre
            ups = _update_profiles_reference(mgmt, old, new)
            report["updated_profiles"].extend(ups)
        except Exception as e:
            report["renamed_certs"].append({"old": old, "error": str(e)})

    # Renombrar keys
    for old in to_fix_keys:
        new = old[:-4]  # remove .key
        try:
            _rename_key_object(mgmt, old, new)
            report["renamed_keys"].append({"old": old, "new": new})
            ups = _update_profiles_reference(mgmt, old, new)
            report["updated_profiles"].extend(ups)
        except Exception as e:
            report["renamed_keys"].append({"old": old, "error": str(e)})

    # De-duplicar perfiles en reporte
    report["updated_profiles"] = sorted(list(set(report["updated_profiles"])))
    return report

# Public function to verify installed certificate by object name (for API endpoint)
def verify_installed_certificate(hostname: str, username: str, password: str, object_name: str) -> dict:
    mgmt = ManagementRoot(hostname, username, password, token=True)
    return verify_cert_object(mgmt, object_name)