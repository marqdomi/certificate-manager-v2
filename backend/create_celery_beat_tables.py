# backend/create_celery_beat_tables.py

import os
import sys

# --- INICIO DEL "MAZO" ---
# Forzamos la adición del directorio actual al path de Python.
# Esto asegura que imports como 'from core...' funcionen sin ambigüedad.
# El directorio actual dentro del contenedor es /app.
sys.path.append(os.getcwd())
# --- FIN DEL "MAZO" ---


# Establecemos la variable de entorno que Django necesita
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.django_settings')

try:
    print("Attempting to import Django...")
    from django.core.management import call_command
    from django.apps import apps
    print("Django imported successfully.")
    
    # Le decimos a Django que "conozca" la app de celery_beat
    if not apps.ready:
        apps.populate(['django_celery_beat'])

    print("Creating Celery Beat database tables...")
    # Este es el comando mágico que crea las tablas
    call_command('migrate', 'django_celery_beat')
    
    print("Celery Beat tables created successfully.")

except ImportError:
    print("\nERROR: Could not import Django.")
    print("This is strange, as it seems to be installed.")
    print("Please check the Python path inside the container.")
    # Imprimimos el sys.path desde dentro del script para comparar
    print("\n--- sys.path from within the script ---")
    import pprint
    pprint.pprint(sys.path)
    print("---------------------------------------")

except Exception as e:
    print(f"\nAn unexpected error occurred: {e}")
    print("Please ensure your database container is running and accessible.")