# backend/services/pfx_service.py

from cryptography import x509
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.hazmat.primitives import serialization

# ✅ --- FUNCIÓN CREATE_PFX MEJORADA Y A PRUEBA DE ERRORES --- ✅
def create_pfx(cert_pem: bytes, key_pem: bytes, chain_pem: bytes | None, password: str | None):
    """
    Genera un archivo PFX de forma robusta, con manejo de errores granular y
    un parsing de la cadena de certificados a prueba de fallos.
    """
    try:
        # 1. Cargar la clave privada. Si falla, es un error de formato.
        private_key = serialization.load_pem_private_key(key_pem, password=None)

        # 2. Cargar el certificado principal. Si falla, es un error de formato.
        main_cert = x509.load_pem_x509_certificate(cert_pem)
        
        # 3. Lógica de parsing de la cadena de certificados (a prueba de balas)
        ca_certs = []
        if chain_pem:
            # Separamos el archivo de cadena por el delimitador estándar.
            # Esto maneja correctamente archivos con 1 o N certificados.
            cert_strings = chain_pem.decode().split("-----END CERTIFICATE-----")
            for cert_str in cert_strings:
                if cert_str.strip(): # Ignoramos partes vacías
                    full_cert_str = cert_str + "-----END CERTIFICATE-----"
                    try:
                        ca_cert = x509.load_pem_x509_certificate(full_cert_str.encode())
                        ca_certs.append(ca_cert)
                    except ValueError:
                        # Ignoramos si una parte de la cadena no es un certificado válido
                        print(f"WARN: Could not parse a certificate from the provided chain file. Skipping part.")
                        pass

        # 4. Preparar los datos para la serialización (sin cambios, tu lógica era correcta)
        friendly_name = main_cert.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)[0].value.encode('utf-8')
        pfx_password_bytes = password.encode('utf-8') if password else None
        
        # Seleccionamos el algoritmo de encriptación
        encryption_algo = serialization.BestAvailableEncryption(pfx_password_bytes) if pfx_password_bytes else serialization.NoEncryption()

        # 5. Serializar el PFX
        pfx_data = pkcs12.serialize_key_and_certificates(
            name=friendly_name,
            key=private_key,
            cert=main_cert,
            cas=ca_certs if ca_certs else None, # Pasamos None si la lista está vacía
            encryption_algorithm=encryption_algo
        )
        
        return pfx_data

    except ValueError as e:
        # Captura errores comunes como una clave/certificado mal formado o una contraseña de clave incorrecta.
        # Es importante relanzar como ValueError para que el endpoint lo convierta en un error 400.
        raise ValueError(f"Failed to process input files. Check if the certificate and key are valid PEM format and match. Details: {e}")
    except Exception as e:
        # Captura cualquier otro error inesperado (como problemas de la librería)
        # y lo relanza para que el endpoint lo convierta en un error 500.
        print(f"CRITICAL ERROR in create_pfx: {e}")
        # Es importante relanzar un error genérico aquí para no exponer detalles internos.
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
        
        return { "key": key_pem, "cert": cert_pem }
    
    except ValueError:
        # Este error suele ocurrir si la contraseña es incorrecta
        raise ValueError("Incorrect password or corrupted PFX file.")
    except Exception as e:
        # Para cualquier otro error inesperado
        raise ValueError(f"Failed to unpack PFX file. Details: {e}")