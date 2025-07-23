# backend/core/django_settings.py

# Este archivo es un "stub" para que django-celery-beat funcione sin instalar todo Django.

import os

# Reutilizamos la clave de encriptación como clave secreta, ya que está en el .env
SECRET_KEY = os.getenv("ENCRYPTION_KEY", "a-default-secret-key-if-not-found")

# Esta es la parte importante: le decimos a Django cómo encontrar nuestra base de datos.
# Los valores deben coincidir con los de tu docker-compose.yml
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'cmt_db',
        'USER': 'user',
        'PASSWORD': 'password',
        'HOST': 'db',       # El nombre del servicio de la BBDD en Docker
        'PORT': '5432',
    }
}

# Le decimos a Django que la única "app" que debe conocer es la de celery beat.
INSTALLED_APPS = (
    'django_celery_beat',
)