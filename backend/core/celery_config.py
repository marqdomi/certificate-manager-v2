import os
from dotenv import load_dotenv

load_dotenv()

# Single source of truth for Redis (works for broker and backend)
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# Allow overrides but default to REDIS_URL
broker_url = os.getenv("CELERY_BROKER_URL", REDIS_URL)
result_backend = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)

# Serialization & content
task_serializer = "json"
result_serializer = "json"
accept_content = ["json"]

# Timezone
timezone = os.getenv("CELERY_TIMEZONE", "UTC")
enable_utc = True

# Queues (simple default; can be overridden via env/route map)
task_default_queue = os.getenv("CELERY_DEFAULT_QUEUE", "celery")

# Optional: basic routing so scan tasks can be isolated if desired
task_routes = {
    # Keep dotted path here; if the task is renamed, this can be updated without touching worker code
    "services.f5_service_tasks.trigger_scan_for_all_devices_task": {
        "queue": os.getenv("CELERY_SCAN_QUEUE", "scans")
    }
}

# Worker tuning (safe, conservative defaults)
worker_prefetch_multiplier = int(os.getenv("CELERY_WORKER_PREFETCH", "1"))
task_acks_late = os.getenv("CELERY_ACKS_LATE", "true").lower() == "true"