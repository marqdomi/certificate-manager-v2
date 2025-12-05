# backend/services/certificate_service.py

from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives import serialization
from sqlalchemy.orm import Session
from typing import Dict, Any

from core.logger import get_service_logger
from db.models import RenewalRequest, RenewalStatus
from . import encryption_service

logger = get_service_logger()


def create_renewal_from_provided_key(
    db: Session, 
    original_cert_id: int, 
    common_name: str, 
    private_key_pem: str
) -> Dict[str, Any]:
    """
    Create or update a renewal request with user-provided private key.
    
    Args:
        db: Database session
        original_cert_id: ID of certificate to renew
        common_name: CN for the CSR
        private_key_pem: PEM-encoded private key
    
    Returns:
        Dict with renewal_id, csr, and message
    
    Raises:
        ValueError: If private key is invalid
    """
    if not private_key_pem or not private_key_pem.strip():
        raise ValueError("A private key is required to initiate a renewal.")

    try:
        # Intentamos cargar la clave
        private_key = serialization.load_pem_private_key(
            private_key_pem.strip().encode(),
            password=None
        )
    except (ValueError, TypeError) as e:
        error_detail = str(e)
        if "Could not deserialize key data" in error_detail:
            raise ValueError("The provided key has an invalid format. Ensure you copied the full content, including -----BEGIN... and -----END... lines.")
        else:
            raise ValueError(f"Error validating private key: {error_detail}")

    # 3. Construir y firmar el CSR con esa clave
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, common_name)])
    builder = x509.CertificateSigningRequestBuilder().subject_name(subject)
    csr = builder.sign(private_key, hashes.SHA256())
    csr_pem = csr.public_bytes(serialization.Encoding.PEM).decode('utf-8')

    # 4. Encriptar la clave para guardarla
    encrypted_key = encryption_service.encrypt_data(private_key_pem)

    # 5. Buscar si ya hay una renovación activa para actualizarla
    renewal_request = db.query(RenewalRequest).filter(
        RenewalRequest.original_certificate_id == original_cert_id,
        RenewalRequest.status == RenewalStatus.CSR_GENERATED
    ).first()
    
    if renewal_request:
        logger.info(f"Updating existing renewal request ID {renewal_request.id}")
        renewal_request.csr_content = csr_pem
        renewal_request.encrypted_private_key = encrypted_key
    else:
        logger.info(f"Creating new renewal request for certificate ID {original_cert_id}")
        renewal_request = RenewalRequest(
            original_certificate_id=original_cert_id,
            status=RenewalStatus.CSR_GENERATED,
            csr_content=csr_pem,
            encrypted_private_key=encrypted_key
        )
        db.add(renewal_request)
    
    db.commit()
    db.refresh(renewal_request)

    return {
        "renewal_id": renewal_request.id,
        "csr": csr_pem,
        "message": "Renewal process initiated successfully. CSR is ready."
    }