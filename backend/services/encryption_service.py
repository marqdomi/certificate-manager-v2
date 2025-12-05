# backend/services/encryption_service.py
from cryptography.fernet import Fernet

# Import centralized, validated configuration
from core.config import ENCRYPTION_KEY

# Initialize Fernet with the validated encryption key
fernet = Fernet(ENCRYPTION_KEY.encode())

def encrypt_data(data: str) -> str:
    """Encripta un string y devuelve un string."""
    return fernet.encrypt(data.encode()).decode()

def decrypt_data(encrypted_data: str) -> str:
    """Desencripta un string y devuelve el string original."""
    return fernet.decrypt(encrypted_data.encode()).decode()