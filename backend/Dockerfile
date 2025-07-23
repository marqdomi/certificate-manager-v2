# backend/Dockerfile

FROM python:3.11-slim

WORKDIR /app

# Copia SOLO el archivo de requerimientos e instala las dependencias.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Ahora, copia TODO el resto de tu código del backend al WORKDIR.
COPY . .

# Ejecuta la aplicación con el "reloader" activado
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]