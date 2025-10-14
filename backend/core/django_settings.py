# backend/core/django_settings.py
# "Stub" mínimo para que django-celery-beat funcione sin instalar todo Django completo.

import os

# Reutilizamos la clave de encriptación como clave secreta, ya que está en el .env
SECRET_KEY = os.getenv("ENCRYPTION_KEY", "a-default-secret-key-if-not-found")

# Zona horaria coherente con Celery
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "UTC")
USE_TZ = True

# Base de datos: coincide con docker-compose por defecto pero permite override via env
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "cmt_db"),
        "USER": os.getenv("POSTGRES_USER", "user"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "password"),
        "HOST": os.getenv("POSTGRES_HOST", "db"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
    }
}

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