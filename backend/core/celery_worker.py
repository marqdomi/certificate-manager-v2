from celery import Celery
from celery.schedules import crontab
from . import celery_config

celery_app = Celery(
    "tasks",
    include=['services.f5_service_tasks']
)
celery_app.config_from_object(celery_config)

# --- LA AGENDA ---
celery_app.conf.beat_schedule = {
    'scan-all-devices-every-5-minutes': { # Le damos un nombre único
        'task': 'trigger_scan_for_all_devices_task', # La tarea que va a llamar
        # Para probar, lo ejecutamos a las 3 am todos los dias
        'schedule': crontab(hour=3, minute=0), 
    },
}