# backend/schemas/device.py
from pydantic import BaseModel, ConfigDict, IPvAnyAddress, computed_field
from datetime import datetime
from typing import Optional

class DeviceResponse(BaseModel):
    id: int
    hostname: str
    ip_address: IPvAnyAddress
    site: Optional[str] | None
    version: Optional[str] | None
    last_scan_status: Optional[str] | None
    last_scan_message: Optional[str] | None 
    last_scan_timestamp: Optional[datetime] | None

    # ✅ Campo computado para que el frontend pueda leer `last_sync`
    #    (muchas vistas lo esperan con ese nombre).
    @computed_field
    @property
    def last_sync(self) -> Optional[str]:
        if self.last_scan_timestamp is None:
            return None
        # Se serializa en ISO 8601 (la GUI ya lo convierte con dayjs/formatters)
        return self.last_scan_timestamp.isoformat()

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        # Permitimos campos extra (por si el modelo agrega otros)
        extra='ignore'
    )