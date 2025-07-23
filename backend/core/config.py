# backend/app/core/config.py
import os
from dotenv import load_dotenv

load_dotenv() # Carga variables desde un archivo .env si existe

DATABASE_URL = os.getenv("DATABASE_URL")