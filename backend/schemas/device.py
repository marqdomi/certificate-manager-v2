# backend/schemas/device.py
from pydantic import BaseModel, ConfigDict, IPvAnyAddress, computed_field
from datetime import datetime
from typing import Optional

class DeviceResponse(BaseModel):
    id: int
    hostname: str
    ip_address: IPvAnyAddress | str  # permite IP o FQDN IP-like si llega a variar
    site: Optional[str] = None
    version: Optional[str] = None

    # --- NUEVOS FACTS ---
    platform: Optional[str] = None
    serial_number: Optional[str] = None
    ha_state: Optional[str] = None          # ACTIVE | STANDBY | ...
    sync_status: Optional[str] = None       # In Sync | Changes Pending | ...
    last_sync_color: Optional[str] = None   # green | yellow | red
    dns_servers: Optional[str] = None       # CSV o JSON string (como lo guardas)
    last_facts_refresh: Optional[datetime] = None

    # --- SCAN INFO ---
    last_scan_status: Optional[str] = None
    last_scan_message: Optional[str] = None 
    last_scan_timestamp: Optional[datetime] = None

    # --- Flags ---
    active: bool = True
    cluster_key: Optional[str] = None
    is_primary_preferred: bool = False

    # Campo computado para compatibilidad con la GUI (si espera last_sync)
    @computed_field
    @property
    def last_sync(self) -> Optional[str]:
        if self.last_scan_timestamp is None:
            return None
        return self.last_scan_timestamp.isoformat()

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        extra='ignore'
    )