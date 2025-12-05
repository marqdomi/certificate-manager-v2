# backend/core/django_settings.py
# "Stub" mínimo para que django-celery-beat funcione sin instalar todo Django completo.

import os

# Import centralized config for validated secrets
from core.config import ENCRYPTION_KEY, DATABASE_URL

# Use the validated encryption key (already checked in config.py)
SECRET_KEY = ENCRYPTION_KEY

# Zona horaria coherente con Celery
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "UTC")
USE_TZ = True

# Parse DATABASE_URL for Django format
# DATABASE_URL format: postgresql://user:password@host:port/dbname
def _parse_database_url(url: str) -> dict:
    """Parse DATABASE_URL into Django DATABASES format."""
    from urllib.parse import urlparse
    parsed = urlparse(url)
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": parsed.path[1:],  # Remove leading /
        "USER": parsed.username or "",
        "PASSWORD": parsed.password or "",
        "HOST": parsed.hostname or "db",
        "PORT": str(parsed.port) if parsed.port else "5432",
    }

DATABASES = {
    "default": _parse_database_url(DATABASE_URL)
}

# Keep these for backward compatibility but they're no longer primary source
# These are derived from DATABASE_URL now
_db_config = DATABASES["default"]

INSTALLED_APPS = (
    "django_celery_beat",
    # Agrega 'django_celery_results' si decides persistir resultados de tareas con Django
    # "django_celery_results",
)

# Para usar el scheduler de base de datos si en algún momento ejecutas:
# celery -A backend.core.celery_worker:celery_app beat
CELERY_BEAT_SCHEDULER = os.getenv(
    "CELERY_BEAT_SCHEDULER", "django_celery_beat.schedulers:DatabaseScheduler"
)