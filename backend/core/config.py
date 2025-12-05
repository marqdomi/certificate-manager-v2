import os
import sys
from dotenv import load_dotenv

load_dotenv()  # Carga variables desde un archivo .env si existe

# =============================================================================
# SECURITY: All sensitive configuration MUST be provided via environment variables
# No default values for credentials - fail fast if not configured
# =============================================================================

def _require_env(var_name: str, description: str) -> str:
    """Require an environment variable, fail with helpful message if missing."""
    value = os.getenv(var_name)
    if not value:
        print(f"\n❌ FATAL: Required environment variable '{var_name}' is not set.", file=sys.stderr)
        print(f"   Description: {description}", file=sys.stderr)
        print(f"   Please set it in your .env file or environment.\n", file=sys.stderr)
        raise ValueError(f"Required environment variable '{var_name}' is not configured.")
    return value

# Database configuration - REQUIRED
DATABASE_URL = _require_env(
    "DATABASE_URL",
    "PostgreSQL connection string (e.g., postgresql://user:pass@host:5432/dbname)"
)

# Encryption key for sensitive data (passwords, private keys) - REQUIRED
ENCRYPTION_KEY = _require_env(
    "ENCRYPTION_KEY", 
    "Fernet encryption key for encrypting sensitive data. Generate with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
)

# JWT Secret - REQUIRED, must be different from ENCRYPTION_KEY
JWT_SECRET = _require_env(
    "JWT_SECRET",
    "Secret key for JWT token signing. Must be different from ENCRYPTION_KEY. Generate with: openssl rand -hex 32"
)

# Validate that JWT_SECRET != ENCRYPTION_KEY (security best practice)
if JWT_SECRET == ENCRYPTION_KEY:
    print("\n⚠️  WARNING: JWT_SECRET and ENCRYPTION_KEY are the same!", file=sys.stderr)
    print("   For security, these should be different values.", file=sys.stderr)
    print("   Generate a new JWT_SECRET with: openssl rand -hex 32\n", file=sys.stderr)

# Optional configurations with safe defaults
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))  # 8 hours

# Celery configuration
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/0")

# Certificate chain configuration
# This is the default intermediate CA chain name on F5 devices
# Override if your organization uses a different CA
DEFAULT_CHAIN_NAME = os.getenv(
    "DEFAULT_CHAIN_NAME", 
    "DigiCert_Global_G2_TLS_RSA_SHA256_2020_CA1"
)