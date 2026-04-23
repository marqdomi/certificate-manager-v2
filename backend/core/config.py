import os
from dotenv import load_dotenv

load_dotenv()  # Carga variables desde un archivo .env si existe

# Mantén compatibilidad con la variable existente, pero provee un valor por defecto claro en dev
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/cmt_db")

# -----------------------------------------------------------------------------
# DigiCert renewal module (paralelo al flujo manual; ver plan de session memory)
# -----------------------------------------------------------------------------
# Feature flag maestro: si es False, endpoints y tasks DigiCert no hacen nada.
ENABLE_DIGICERT_RENEWAL = os.getenv("ENABLE_DIGICERT_RENEWAL", "false").lower() == "true"

# Base URL de DigiCert CertCentral API.
#   Producción: https://www.digicert.com/services/v2
#   Sandbox:    https://www.digicert.com/services/v2 (en tests se apunta a la base de sandbox
#               configurada en la cuenta; CertCentral usa la misma URL con API key distinta).
# Para pruebas contra una URL alternativa (p.ej. mock server), override con esta variable.
DIGICERT_BASE_URL = os.getenv("DIGICERT_BASE_URL", "https://www.digicert.com/services/v2")

# HTTP timeouts y reintentos
DIGICERT_HTTP_TIMEOUT_SECONDS = int(os.getenv("DIGICERT_HTTP_TIMEOUT_SECONDS", "30"))
DIGICERT_MAX_RETRIES = int(os.getenv("DIGICERT_MAX_RETRIES", "3"))

# Polling (Celery self-reschedule con backoff exponencial hasta este máximo)
DIGICERT_POLL_INITIAL_DELAY_SECONDS = int(os.getenv("DIGICERT_POLL_INITIAL_DELAY_SECONDS", "30"))
DIGICERT_POLL_MAX_DELAY_SECONDS = int(os.getenv("DIGICERT_POLL_MAX_DELAY_SECONDS", "300"))
DIGICERT_POLL_MAX_TOTAL_HOURS = int(os.getenv("DIGICERT_POLL_MAX_TOTAL_HOURS", "24"))

# Retención de private key tras DEPLOYED (paso 30): días antes de purga.
DIGICERT_PRIVATE_KEY_RETENTION_DAYS = int(os.getenv("DIGICERT_PRIVATE_KEY_RETENTION_DAYS", "7"))

# Recordatorio de aprobación: intervalo en horas para re-notificar approvers
# mientras una orden siga en NEEDS_APPROVAL.
DIGICERT_APPROVAL_REMINDER_INTERVAL_HOURS = int(os.getenv("DIGICERT_APPROVAL_REMINDER_INTERVAL_HOURS", "24"))

# Renewal window: si el cert actual expira a más de N días, el precheck mostrará warning.
DIGICERT_EARLY_RENEWAL_WARNING_DAYS = int(os.getenv("DIGICERT_EARLY_RENEWAL_WARNING_DAYS", "90"))
