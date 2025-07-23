# backend/create_tables.py

from db.base import Base, engine
# ¡AQUÍ ESTÁ LA CLAVE! Importamos todo lo que queremos crear.
from db.models import Certificate, RenewalRequest, Device, User

print("Creating database tables...")
Base.metadata.create_all(bind=engine)
print("Tables created successfully.")