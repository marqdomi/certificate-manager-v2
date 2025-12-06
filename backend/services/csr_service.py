# backend/services/csr_service.py
"""
CSR Generator Service - Generates CSR and Private Keys locally
Solves the F5 key export limitation by generating keys outside F5.

Flow:
1. User requests CSR for a certificate (existing or new)
2. CMT generates private key + CSR locally
3. Private key is encrypted and stored (DB or Vault)
4. User downloads CSR, submits to CA (DigiCert)
5. User uploads signed certificate
6. CMT assembles PFX and uploads to F5

Author: CMT v2.5
Date: December 2025
"""

from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography import x509
from cryptography.x509.oid import NameOID
from datetime import datetime
from typing import Optional
import logging

from services.encryption_service import encrypt_data, decrypt_data

logger = logging.getLogger(__name__)


class CSRGenerationError(Exception):
    """Custom exception for CSR generation failures"""
    pass


def generate_private_key(key_size: int = 2048) -> rsa.RSAPrivateKey:
    """
    Generate an RSA private key.
    
    Args:
        key_size: Key size in bits (2048, 3072, or 4096)
    
    Returns:
        RSAPrivateKey object
    """
    if key_size not in [2048, 3072, 4096]:
        raise CSRGenerationError(f"Invalid key size: {key_size}. Must be 2048, 3072, or 4096")
    
    return rsa.generate_private_key(
        public_exponent=65537,
        key_size=key_size,
    )


def serialize_private_key(
    private_key: rsa.RSAPrivateKey, 
    passphrase: Optional[str] = None
) -> bytes:
    """
    Serialize private key to PEM format.
    
    Args:
        private_key: RSA private key object
        passphrase: Optional passphrase for encryption (for export)
    
    Returns:
        PEM-encoded private key bytes
    """
    if passphrase:
        encryption = serialization.BestAvailableEncryption(passphrase.encode())
    else:
        encryption = serialization.NoEncryption()
    
    return private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=encryption
    )


def generate_csr(
    private_key: rsa.RSAPrivateKey,
    common_name: str,
    organization: Optional[str] = None,
    organizational_unit: Optional[str] = None,
    locality: Optional[str] = None,
    state: Optional[str] = None,
    country: str = "US",
    email: Optional[str] = None,
    san_dns_names: Optional[list[str]] = None,
    san_ip_addresses: Optional[list[str]] = None,
) -> x509.CertificateSigningRequest:
    """
    Generate a Certificate Signing Request (CSR).
    
    Args:
        private_key: RSA private key to sign the CSR
        common_name: CN for the certificate (e.g., example.com)
        organization: O - Organization name
        organizational_unit: OU - Department
        locality: L - City
        state: ST - State/Province
        country: C - Country code (2 letters)
        email: Email address
        san_dns_names: List of DNS names for SAN extension
        san_ip_addresses: List of IP addresses for SAN extension
    
    Returns:
        CertificateSigningRequest object
    """
    # Build subject name
    name_attributes = []
    
    if country:
        name_attributes.append(x509.NameAttribute(NameOID.COUNTRY_NAME, country[:2].upper()))
    if state:
        name_attributes.append(x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, state))
    if locality:
        name_attributes.append(x509.NameAttribute(NameOID.LOCALITY_NAME, locality))
    if organization:
        name_attributes.append(x509.NameAttribute(NameOID.ORGANIZATION_NAME, organization))
    if organizational_unit:
        name_attributes.append(x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, organizational_unit))
    if common_name:
        name_attributes.append(x509.NameAttribute(NameOID.COMMON_NAME, common_name))
    if email:
        name_attributes.append(x509.NameAttribute(NameOID.EMAIL_ADDRESS, email))
    
    subject = x509.Name(name_attributes)
    
    # Build CSR
    builder = x509.CertificateSigningRequestBuilder().subject_name(subject)
    
    # Add Subject Alternative Names if provided
    san_entries = []
    
    if san_dns_names:
        for dns_name in san_dns_names:
            san_entries.append(x509.DNSName(dns_name))
    
    if san_ip_addresses:
        import ipaddress
        for ip_str in san_ip_addresses:
            try:
                ip = ipaddress.ip_address(ip_str)
                san_entries.append(x509.IPAddress(ip))
            except ValueError:
                logger.warning(f"Invalid IP address in SAN: {ip_str}, skipping")
    
    # Always include CN in SAN if not already there
    if common_name and common_name not in (san_dns_names or []):
        san_entries.insert(0, x509.DNSName(common_name))
    
    if san_entries:
        builder = builder.add_extension(
            x509.SubjectAlternativeName(san_entries),
            critical=False,
        )
    
    # Sign the CSR
    csr = builder.sign(private_key, hashes.SHA256())
    
    return csr


def serialize_csr(csr: x509.CertificateSigningRequest) -> bytes:
    """
    Serialize CSR to PEM format.
    
    Args:
        csr: CertificateSigningRequest object
    
    Returns:
        PEM-encoded CSR bytes
    """
    return csr.public_bytes(serialization.Encoding.PEM)


def generate_csr_with_key(
    common_name: str,
    organization: Optional[str] = None,
    organizational_unit: Optional[str] = None,
    locality: Optional[str] = None,
    state: Optional[str] = None,
    country: str = "US",
    email: Optional[str] = None,
    san_dns_names: Optional[list[str]] = None,
    san_ip_addresses: Optional[list[str]] = None,
    key_size: int = 2048,
) -> dict:
    """
    Complete CSR generation - creates key and CSR in one call.
    
    Args:
        common_name: CN for the certificate
        ... (see generate_csr for other args)
        key_size: RSA key size (2048, 3072, 4096)
    
    Returns:
        dict with:
            - csr_pem: PEM-encoded CSR (string)
            - key_pem: PEM-encoded private key (string, unencrypted)
            - key_pem_encrypted: Encrypted key for DB storage
            - common_name: CN used
            - san_names: List of all SAN entries
            - created_at: Timestamp
    """
    try:
        # Generate private key
        private_key = generate_private_key(key_size)
        
        # Generate CSR
        csr = generate_csr(
            private_key=private_key,
            common_name=common_name,
            organization=organization,
            organizational_unit=organizational_unit,
            locality=locality,
            state=state,
            country=country,
            email=email,
            san_dns_names=san_dns_names,
            san_ip_addresses=san_ip_addresses,
        )
        
        # Serialize
        csr_pem = serialize_csr(csr).decode('utf-8')
        key_pem = serialize_private_key(private_key).decode('utf-8')
        
        # Encrypt key for DB storage
        key_pem_encrypted = encrypt_data(key_pem)
        
        # Collect all SAN names
        san_names = list(san_dns_names or [])
        if common_name and common_name not in san_names:
            san_names.insert(0, common_name)
        
        logger.info(f"Generated CSR for CN={common_name} with {len(san_names)} SAN entries")
        
        return {
            "csr_pem": csr_pem,
            "key_pem": key_pem,  # Only for immediate download, don't store unencrypted!
            "key_pem_encrypted": key_pem_encrypted,
            "common_name": common_name,
            "san_names": san_names,
            "key_size": key_size,
            "created_at": datetime.utcnow().isoformat(),
        }
        
    except Exception as e:
        logger.error(f"CSR generation failed: {e}")
        raise CSRGenerationError(f"Failed to generate CSR: {str(e)}")


def decrypt_private_key(encrypted_key: str) -> str:
    """
    Decrypt a stored private key.
    
    Args:
        encrypted_key: Fernet-encrypted key string from DB
    
    Returns:
        PEM-encoded private key string
    """
    return decrypt_data(encrypted_key)


def validate_csr(csr_pem: str) -> dict:
    """
    Parse and validate a CSR.
    
    Args:
        csr_pem: PEM-encoded CSR string
    
    Returns:
        dict with CSR details
    """
    try:
        csr = x509.load_pem_x509_csr(csr_pem.encode())
        
        # Extract subject info
        subject_info = {}
        for attr in csr.subject:
            oid_name = attr.oid._name
            subject_info[oid_name] = attr.value
        
        # Extract SANs
        san_names = []
        try:
            san_ext = csr.extensions.get_extension_for_class(x509.SubjectAlternativeName)
            san_names = [str(name.value) for name in san_ext.value]
        except x509.ExtensionNotFound:
            pass
        
        return {
            "valid": True,
            "subject": subject_info,
            "san_names": san_names,
            "signature_valid": csr.is_signature_valid,
            "public_key_type": type(csr.public_key()).__name__,
        }
    
    except Exception as e:
        return {
            "valid": False,
            "error": str(e)
        }


def create_pfx_from_components(
    cert_pem: str,
    key_pem: str,
    chain_pem: Optional[str] = None,
    passphrase: str = "changeit"
) -> bytes:
    """
    Create a PFX/PKCS12 file from certificate components.
    
    Args:
        cert_pem: PEM-encoded certificate
        key_pem: PEM-encoded private key
        chain_pem: PEM-encoded certificate chain (intermediate + root)
        passphrase: Password for the PFX file
    
    Returns:
        PKCS12 bytes
    """
    from cryptography.hazmat.primitives.serialization import pkcs12
    
    # Load certificate
    cert = x509.load_pem_x509_certificate(cert_pem.encode())
    
    # Load private key
    private_key = serialization.load_pem_private_key(
        key_pem.encode(),
        password=None
    )
    
    # Load chain if provided
    chain_certs = None
    if chain_pem:
        chain_certs = []
        # Split chain into individual certs
        pem_certs = chain_pem.split("-----END CERTIFICATE-----")
        for pem in pem_certs:
            pem = pem.strip()
            if pem and "-----BEGIN CERTIFICATE-----" in pem:
                pem += "\n-----END CERTIFICATE-----\n"
                try:
                    chain_certs.append(x509.load_pem_x509_certificate(pem.encode()))
                except Exception as e:
                    logger.warning(f"Failed to load chain cert: {e}")
    
    # Create PKCS12
    pfx_data = pkcs12.serialize_key_and_certificates(
        name=cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value.encode() if cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME) else b"certificate",
        key=private_key,
        cert=cert,
        cas=chain_certs,
        encryption_algorithm=serialization.BestAvailableEncryption(passphrase.encode())
    )
    
    return pfx_data
