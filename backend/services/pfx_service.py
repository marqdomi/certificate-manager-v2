from cryptography import x509
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.hazmat.primitives import serialization
from datetime import timezone
from typing import Optional, Tuple

from core.logger import get_service_logger

logger = get_service_logger()


# ✅ --- FUNCIÓN CREATE_PFX MEJORADA Y A PRUEBA DE ERRORES --- ✅
def create_pfx(
    cert_pem: bytes, 
    key_pem: bytes, 
    chain_pem: Optional[bytes], 
    password: Optional[str]
) -> bytes:
    """
    Generate a PFX file from certificate, key, and optional chain.
    
    Args:
        cert_pem: PEM-encoded certificate
        key_pem: PEM-encoded private key
        chain_pem: Optional PEM-encoded chain certificates
        password: Optional password for the PFX
    
    Returns:
        PFX file as bytes
    
    Raises:
        ValueError: If inputs are invalid
        Exception: On unexpected errors
    """
    try:
        # 1. Cargar la clave privada. Si falla, es un error de formato.
        private_key = serialization.load_pem_private_key(key_pem, password=None)

        # 2. Cargar el certificado principal. Si falla, es un error de formato.
        main_cert = x509.load_pem_x509_certificate(cert_pem)
        
        # 3. Lógica de parsing de la cadena de certificados (a prueba de balas)
        ca_certs = []
        if chain_pem:
            cert_strings = chain_pem.decode().split("-----END CERTIFICATE-----")
            for cert_str in cert_strings:
                if cert_str.strip():
                    full_cert_str = cert_str + "-----END CERTIFICATE-----"
                    try:
                        ca_cert = x509.load_pem_x509_certificate(full_cert_str.encode())
                        ca_certs.append(ca_cert)
                    except ValueError:
                        logger.warning("Could not parse a certificate from chain file, skipping")
                        pass

        # 4. Preparar los datos para la serialización
        friendly_name = main_cert.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)[0].value.encode('utf-8')
        pfx_password_bytes = password.encode('utf-8') if password else None
        
        encryption_algo = serialization.BestAvailableEncryption(pfx_password_bytes) if pfx_password_bytes else serialization.NoEncryption()

        # 5. Serializar el PFX
        pfx_data = pkcs12.serialize_key_and_certificates(
            name=friendly_name,
            key=private_key,
            cert=main_cert,
            cas=ca_certs if ca_certs else None,
            encryption_algorithm=encryption_algo
        )
        
        return pfx_data

    except ValueError as e:
        raise ValueError(f"Failed to process input files. Check if the certificate and key are valid PEM format and match. Details: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in create_pfx: {e}")
        raise Exception("An unexpected error occurred during PFX creation.")


# --- ¡NUEVA FUNCIÓN! ---
def unpack_pfx(pfx_data: bytes, password: str | None):
    """
    Desempaqueta un archivo PFX y devuelve la clave privada y el certificado principal
    en formato PEM (texto).
    """
    pfx_password_bytes = password.encode('utf-8') if password else None
    
    try:
        # La librería nos devuelve 3 cosas: la clave, el cert principal, y una lista de certs adicionales (la cadena)
        private_key, main_cert, _ = pkcs12.load_key_and_certificates(
            pfx_data, pfx_password_bytes
        )

        # Convertimos la clave a formato de texto PEM
        key_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        ).decode('utf-8')
        
        # Convertimos el certificado a formato de texto PEM
        cert_pem = main_cert.public_bytes(
            encoding=serialization.Encoding.PEM
        ).decode('utf-8')
        
        info = cert_metadata_from_pem(cert_pem.encode("utf-8"))
        return { "key": key_pem, "cert": cert_pem, "info": info, "san": info.get("san", []) }
    
    except ValueError:
        # Este error suele ocurrir si la contraseña es incorrecta
        raise ValueError("Incorrect password or corrupted PFX file.")
    except Exception as e:
        # Para cualquier otro error inesperado
        raise ValueError(f"Failed to unpack PFX file. Details: {e}")


# --- NEW: helpers to extract certificate metadata ---

def _extract_cert_metadata(cert: x509.Certificate) -> dict:
    cn = None
    try:
        attrs = cert.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)
        cn = attrs[0].value if attrs else None
    except Exception:
        pass

    not_after = cert.not_valid_after.replace(tzinfo=timezone.utc).isoformat()

    san_list: list[str] = []
    try:
        ext = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName)
        # collect DNS names and IPs as strings
        for name in ext.value:
            if isinstance(name, x509.DNSName):
                san_list.append(name.value)
            elif isinstance(name, x509.IPAddress):
                san_list.append(str(name.value))
    except x509.ExtensionNotFound:
        pass

    return {"cn": cn, "not_after": not_after, "san": san_list}


def cert_metadata_from_pem(cert_pem: bytes) -> dict:
    cert = x509.load_pem_x509_certificate(cert_pem)
    return _extract_cert_metadata(cert)