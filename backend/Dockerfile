# backend/Dockerfile

FROM python:3.11-slim

# Evita .pyc y buffer en logs, y no cache de pip
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Instala dependencias Python primero para aprovechar la capa de cache
COPY requirements.txt .
RUN python -m pip install --upgrade pip && \
    pip install -r requirements.txt

# Crea usuario no-root para ejecutar la app
RUN useradd -m appuser
USER appuser

# Copia el código con ownership correcto
COPY --chown=appuser:appuser . .

EXPOSE 8000

# Healthcheck sin instalar curl/wget (usa stdlib)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys;\n\n\
try:\n\
    r=urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=3)\n\
    sys.exit(0 if getattr(r,'status',200)==200 else 1)\n\
except Exception:\n\
    sys.exit(1)"

# Ejecuta la aplicación con autoreload (ideal para desarrollo)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]