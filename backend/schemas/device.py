# backend/schemas/device.py
from pydantic import BaseModel, ConfigDict, IPvAnyAddress
from datetime import datetime

class DeviceResponse(BaseModel):
    id: int
    hostname: str
    ip_address: IPvAnyAddress
    site: str | None
    version: str | None
    last_scan_status: str | None
    last_scan_message: str | None 
    last_scan_timestamp: datetime | None

    model_config = ConfigDict(from_attributes=True)