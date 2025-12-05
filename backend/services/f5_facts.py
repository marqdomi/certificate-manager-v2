from datetime import datetime
from typing import Optional, Dict, Any

from f5.bigip import ManagementRoot

from db.base import SessionLocal
from db.models import Device
from services.encryption_service import decrypt_data


def _safe_get(nested: dict, *path: str) -> Optional[Any]:
    """Traverse a nested dict using keys in *path*. Return None if any step is missing."""
    cur = nested
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return None
        cur = cur[key]
    return cur


def _get_version(mgmt: ManagementRoot, fallback: Optional[str]) -> Optional[str]:
    # Primary: tm/sys/version (nestedStats)
    try:
        ver = mgmt.tm.sys.version.load()
        # Expected shape: entries['https://localhost/mgmt/tm/sys/version/0'].nestedStats.entries['Version'].description
        entries = getattr(ver, 'entries', {})
        first_key = next(iter(entries))
        desc = _safe_get(entries[first_key], 'nestedStats', 'entries', 'Version', 'description')
        if desc:
            return str(desc)
    except Exception:
        pass
    # Fallback: shared/identified-devices/config/device-info
    try:
        info = mgmt.shared.identified_devices.config.device_info.load()
        v = getattr(info, 'version', None)
        if v:
            return str(v)
    except Exception:
        pass
    return fallback


def _get_ha_state(mgmt: ManagementRoot) -> Optional[str]:
    # Prefer cm/failover-status (more accurate wording)
    try:
        fo = mgmt.tm.cm.failover_status.load()
        # entries[<url>].nestedStats.entries.status.description
        entries = getattr(fo, 'entries', {})
        if entries:
            first_key = next(iter(entries))
            desc = _safe_get(entries[first_key], 'nestedStats', 'entries', 'status', 'description')
            if desc:
                return str(desc)
    except Exception:
        pass
    # Fallback: sys/failover (older endpoint)
    try:
        so = mgmt.tm.sys.failover.load()
        for attr in ('status', 'mode'):
            val = getattr(so, attr, None)
            if val:
                return str(val)
    except Exception:
        pass
    return None


def _get_sync_status(mgmt: ManagementRoot) -> (Optional[str], Optional[str]):
    # cm/sync-status (nestedStats has status + color)
    try:
        ss = mgmt.tm.cm.sync_status.load()
        entries = getattr(ss, 'entries', {})
        if entries:
            first_key = next(iter(entries))
            nst = _safe_get(entries[first_key], 'nestedStats', 'entries') or {}
            status = _safe_get(nst, 'status', 'description')
            color = _safe_get(nst, 'color', 'description')
            return (str(status) if status else None, str(color) if color else None)
    except Exception:
        pass
    return (None, None)


def _get_dns_servers(mgmt: ManagementRoot) -> Optional[str]:
    try:
        dns = mgmt.tm.sys.dns.load()
        servers = getattr(dns, 'nameServers', None)
        if isinstance(servers, list) and servers:
            return ",".join(map(str, servers))
    except Exception:
        pass
    return None


def _get_serial(mgmt: ManagementRoot) -> Optional[str]:
    try:
        hw = mgmt.tm.sys.hardware.load()
        entries = getattr(hw, 'entries', {})
        for _, entry in entries.items():
            desc = _safe_get(entry, 'nestedStats', 'entries', 'serialNumber', 'description')
            if desc:
                return str(desc)
    except Exception:
        pass
    # Optional alternative fields sometimes present
    try:
        info = mgmt.shared.identified_devices.config.device_info.load()
        for attr in ('platformSerial', 'chassisSerialNumber'):
            val = getattr(info, attr, None)
            if val:
                return str(val)
    except Exception:
        pass
    return None


def update_device_facts_from_mgmt(device: Device, mgmt: ManagementRoot) -> dict:
    """
    Update device facts using an existing ManagementRoot connection.
    
    This function is designed to be called from within a scan operation
    that already has an open connection, avoiding duplicate authentication.
    
    Args:
        device: Device ORM object (will be modified in place)
        mgmt: Already-connected ManagementRoot instance
        
    Returns:
        dict with updated facts for logging purposes
    """
    facts_updated = {}
    
    try:
        # Version
        version = _get_version(mgmt, device.version)
        if version and version != device.version:
            facts_updated['version'] = {'old': device.version, 'new': version}
            device.version = version
        
        # HA State
        ha_state = _get_ha_state(mgmt)
        if ha_state is not None:
            if ha_state != device.ha_state:
                facts_updated['ha_state'] = {'old': device.ha_state, 'new': ha_state}
            device.ha_state = ha_state
        
        # Sync Status
        sync_status, color = _get_sync_status(mgmt)
        if sync_status is not None:
            if sync_status != device.sync_status:
                facts_updated['sync_status'] = {'old': device.sync_status, 'new': sync_status}
            device.sync_status = sync_status
        if color is not None:
            device.last_sync_color = color
        
        # DNS Servers
        dns_servers = _get_dns_servers(mgmt)
        if dns_servers is not None:
            if dns_servers != device.dns_servers:
                facts_updated['dns_servers'] = {'old': device.dns_servers, 'new': dns_servers}
            device.dns_servers = dns_servers
        
        # Serial Number
        serial = _get_serial(mgmt)
        if serial is not None:
            if serial != device.serial_number:
                facts_updated['serial_number'] = {'old': device.serial_number, 'new': serial}
            device.serial_number = serial
        
        # Update timestamp
        device.last_facts_refresh = datetime.utcnow()
        
        return {
            "status": "success",
            "facts_updated": facts_updated,
            "fields_checked": ['version', 'ha_state', 'sync_status', 'dns_servers', 'serial_number']
        }
        
    except Exception as e:
        return {
            "status": "partial",
            "error": str(e),
            "facts_updated": facts_updated
        }


def fetch_and_store_device_facts(device_id: int) -> dict:
    """Connects to BIG-IP and stores lightweight facts into `devices` row.

    Fields updated: version, ha_state, sync_status, last_sync_color,
    dns_servers, serial_number, last_facts_refresh.
    """
    s = SessionLocal()
    try:
        dev = s.get(Device, device_id)
        if not dev:
            return {"status": "error", "message": f"Device {device_id} not found"}
        if not dev.encrypted_password:
            return {"status": "error", "message": "Credentials missing"}

        pwd = decrypt_data(dev.encrypted_password)
        # Use token auth to avoid repeated logins
        mgmt = ManagementRoot(dev.ip_address, dev.username, pwd, token=True)

        version = _get_version(mgmt, dev.version)
        ha_state = _get_ha_state(mgmt)
        sync_status, color = _get_sync_status(mgmt)
        dns_servers = _get_dns_servers(mgmt)
        serial = _get_serial(mgmt)

        dev.version = version or dev.version
        if ha_state is not None:
            dev.ha_state = ha_state
        if sync_status is not None:
            dev.sync_status = sync_status
        if color is not None:
            dev.last_sync_color = color
        if dns_servers is not None:
            dev.dns_servers = dns_servers
        if serial is not None:
            dev.serial_number = serial
        dev.last_facts_refresh = datetime.utcnow()

        s.commit()
        return {"status": "success", "message": f"Facts updated for {dev.hostname}", "device_id": device_id}
    except Exception as e:
        s.rollback()
        return {"status": "error", "message": str(e), "device_id": device_id}
    finally:
        s.close()