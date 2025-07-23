# backend/schemas/device.py
from pydantic import BaseModel
from datetime import datetime

class DeviceResponse(BaseModel):
    id: int
    hostname: str
    ip_address: str
    site: str | None
    version: str | None
    last_scan_status: str | None
    last_scan_message: str | None 
    last_scan_timestamp: datetime | None

    class Config:
        from_attributes = True