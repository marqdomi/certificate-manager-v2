# backend/schemas/certificate.py

from pydantic import BaseModel
from datetime import datetime

class CertificateResponse(BaseModel):
    id: int
    name: str
    common_name: str | None
    issuer: str | None
    f5_device_hostname: str
    partition: str
    expiration_date: datetime | None
    days_remaining: int | None
    
    # --- ¡AÑADE ESTA LÍNEA! ---
    device_id: int  # El ID del dispositivo al que pertenece

    renewal_id: int | None = None
    renewal_status: str | None = None

    class Config:
        from_attributes = True