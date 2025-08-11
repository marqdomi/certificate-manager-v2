from celery import Celery
from celery.schedules import crontab
from . import celery_config

# Use a stable, descriptive app name
celery_app = Celery("certificate_manager")
celery_app.config_from_object(celery_config)

# Autodiscover tasks inside the 'services' package (and subpackages)
celery_app.autodiscover_tasks(packages=["services"])

# --- Beat schedule ---
# NOTE: The key name previously claimed "every 5 minutes" but actually ran daily at 03:00.
# Keeping behavior the same, but correcting the label. Make this configurable later if needed.
celery_app.conf.beat_schedule = {
    "scan-all-devices-daily-03:00": {
        # If your task is registered with a custom name, keep that here;
        # otherwise prefer the dotted path. We retain the current name to avoid breaking changes.
        "task": "trigger_scan_for_all_devices_task",
        "schedule": crontab(hour=3, minute=0),
    },
}