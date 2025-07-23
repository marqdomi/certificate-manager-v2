# backend/services/encryption_service.py
import os
from cryptography.fernet import Fernet
from dotenv import load_dotenv

# Cargar las variables de entorno del archivo .env
load_dotenv()

# Leemos la clave de encriptación de las variables de entorno
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
if not ENCRYPTION_KEY:
    raise ValueError("No encryption key found. Set ENCRYPTION_KEY in your .env file.")

fernet = Fernet(ENCRYPTION_KEY.encode())

def encrypt_data(data: str) -> str:
    """Encripta un string y devuelve un string."""
    return fernet.encrypt(data.encode()).decode()

def decrypt_data(encrypted_data: str) -> str:
    """Desencripta un string y devuelve el string original."""
    return fernet.decrypt(encrypted_data.encode()).decode()