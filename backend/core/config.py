import os
from dotenv import load_dotenv

load_dotenv()  # Carga variables desde un archivo .env si existe

# Mantén compatibilidad con la variable existente, pero provee un valor por defecto claro en dev
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/cmt_db")