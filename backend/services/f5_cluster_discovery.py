"""
F5 Cluster Discovery Service

Este servicio obtiene información real de cluster/HA consultando directamente
las APIs de F5 para determinar peers, device-trust y configuración de cluster.
"""

import json
import logging
import re
from collections import defaultdict
from datetime import datetime
from typing import Optional, Dict, List, Any, Tuple, Set
from sqlalchemy.orm import Session
from f5.bigip import ManagementRoot
from f5.sdk_exception import F5SDKError

from db.base import SessionLocal
from db.models import Device
from services.encryption_service import decrypt_data

logger = logging.getLogger(__name__)


def _normalize_device_name(name: Optional[str]) -> str:
    """Return a lowercase canonical identifier for a BIG-IP device name."""
    if not name:
        return ""
    value = str(name).strip()
    if not value:
        return ""
    # Remove partition prefixes like /Common/ or ~Common~
    if value.startswith("/"):
        value = value.split("/")[-1]
    if value.startswith("~"):
        value = value.split("~")[-1]
    return value.lower()


def _normalize_device_group_name(name: Optional[str]) -> str:
    """Normalize a device-group name for cluster key composition."""
    if not name:
        return ""
    value = str(name).strip()
    if not value:
        return ""
    if value.startswith("/"):
        value = value.split("/")[-1]
    if value.startswith("~"):
        value = value.split("~")[-1]
    # Replace whitespace with dashes to keep key readable and filesystem friendly
    value = re.sub(r"\s+", "-", value)
    return value


def _build_cluster_key(trust_domain: Optional[str], group_name: Optional[str]) -> Optional[str]:
    """Compose the cluster key using trust-domain and normalized device-group name."""
    normalized_group = _normalize_device_group_name(group_name)
    if not normalized_group:
        return None
    domain = (trust_domain or "UNKNOWN").strip() or "UNKNOWN"
    return f"{domain}::{normalized_group}"


def _register_alias(alias_map: Dict[str, str], canonical: str, *aliases: Optional[str]) -> None:
    for alias in aliases:
        if not alias:
            continue
        alias_key = _normalize_device_name(alias)
        if alias_key and alias_key not in alias_map:
            alias_map[alias_key] = canonical


def _fetch_device_records(mgmt: ManagementRoot) -> tuple[Dict[str, Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    """Return device information indexed by canonical name and management IP."""
    devices_by_name: Dict[str, Dict[str, Any]] = {}
    devices_by_ip: Dict[str, Dict[str, Any]] = {}
    alias_map: Dict[str, str] = {}

    try:
        for device in mgmt.tm.cm.devices.get_collection():
            record = {
                'name': getattr(device, 'name', None),
                'hostname': getattr(device, 'hostname', None),
                'management_ip': getattr(device, 'managementIp', None) or getattr(device, 'managementAddress', None),
                'management_address': getattr(device, 'managementAddress', None),
                'self_device': getattr(device, 'selfDevice', None),
                'failover_state': getattr(device, 'failoverState', None),
                'uuid': getattr(device, 'uuid', None),
            }
            canonical = _normalize_device_name(record['name'] or record['hostname'])
            if canonical:
                devices_by_name[canonical] = record
                _register_alias(alias_map, canonical, record['name'], record['hostname'])
            if record['management_ip']:
                devices_by_ip[record['management_ip']] = record
            if record['management_address'] and record['management_address'] != record['management_ip']:
                devices_by_ip[record['management_address']] = record
    except Exception as exc:
        logger.warning("Unable to fetch cm/device collection: %s", exc)

    # Register alias_map entries into devices_by_name to allow lookups by hostname alias
    for alias_key, canonical in alias_map.items():
        if canonical in devices_by_name:
            devices_by_name[alias_key] = devices_by_name[canonical]

    return devices_by_name, devices_by_ip


def _fetch_trust_domain(mgmt: ManagementRoot) -> Optional[str]:
    try:
        for domain in mgmt.tm.cm.trust_domains.get_collection():
            name = getattr(domain, 'name', None)
            if name:
                return name
    except Exception as exc:
        logger.warning("Unable to fetch trust-domain collection: %s", exc)
    return None


def _fetch_sync_status_by_group(mgmt: ManagementRoot) -> Dict[str, Dict[str, Optional[str]]]:
    """Return mapping normalized device-group name -> sync status/color."""
    group_status: Dict[str, Dict[str, Optional[str]]] = {}
    try:
        sync_status = mgmt.tm.cm.sync_status.load()
        entries = getattr(sync_status, 'entries', {}) or {}
        for item in entries.values():
            nested = _safe_get(item, 'nestedStats', 'entries') or {}
            group_candidate = (
                _safe_get(nested, 'deviceGroup', 'description') or
                _safe_get(nested, 'groupName', 'description') or
                _safe_get(nested, 'name', 'description')
            )
            if not group_candidate:
                continue
            normalized = _normalize_device_group_name(group_candidate).lower()
            if not normalized:
                continue
            group_status[normalized] = {
                'status': (_safe_get(nested, 'status', 'description') or 'Unknown'),
                'color': _safe_get(nested, 'color', 'description'),
            }
    except Exception as exc:
        logger.warning("Unable to fetch sync-status: %s", exc)
    return group_status


def _fetch_active_traffic_groups(mgmt: ManagementRoot) -> Dict[str, List[str]]:
    """Return mapping device name -> list of traffic-groups where it is active."""
    active_groups: Dict[str, List[str]] = defaultdict(list)
    try:
        for tg in mgmt.tm.cm.traffic_groups.get_collection():
            failover_state = getattr(tg, 'failoverState', None) or getattr(tg, 'failover_state', None)
            device_name = getattr(tg, 'deviceName', None) or getattr(tg, 'device_name', None)
            if not device_name:
                device_name = getattr(tg, 'activeDevice', None) or getattr(tg, 'active_device', None)
            if not device_name:
                continue
            if failover_state and str(failover_state).lower() == 'active':
                active_groups[_normalize_device_name(device_name)].append(
                    getattr(tg, 'fullPath', None) or getattr(tg, 'name', 'traffic-group')
                )
    except Exception as exc:
        logger.debug("Unable to enumerate traffic-groups: %s", exc)
    return active_groups


def _fetch_device_group_members(group, session) -> List[Dict[str, Any]]:
    """Fetch members of a device-group via its devicesReference link."""
    members: List[Dict[str, Any]] = []
    link = None
    try:
        devices_ref = getattr(group, 'devicesReference', None)
        if isinstance(devices_ref, dict):
            link = devices_ref.get('link') or devices_ref.get('href')
    except Exception:
        link = None

    if not link or session is None:
        return members

    try:
        resp = session.get(link, timeout=15)
        if resp.status_code >= 400:
            logger.debug("device-group devicesReference returned %s for %s", resp.status_code, link)
            return members
        payload = resp.json() or {}
        for item in payload.get('items', []):
            members.append({
                'name': item.get('name') or item.get('fullPath'),
                'full_path': item.get('fullPath'),
                'hostname': item.get('hostname'),
                'management_ip': item.get('managementIp') or item.get('address'),
                'self_device': item.get('selfDevice'),
                'failover_state': item.get('failoverState'),
            })
    except Exception as exc:
        logger.debug("Unable to fetch members for device-group %s: %s", getattr(group, 'name', 'unknown'), exc)
    return members


def _derive_member_ha_state(
    normalized_name: str,
    failover_state: Optional[str],
    active_group_map: Dict[str, List[str]]
) -> str:
    """Determine HA state based on traffic-group activity and failover status."""
    active_groups = active_group_map.get(normalized_name, [])
    if active_groups:
        return 'ACTIVE'
    if failover_state:
        lowered = str(failover_state).lower()
        if lowered == 'active':
            return 'ACTIVE'
        if lowered == 'standby':
            return 'STANDBY'
        return str(failover_state).upper()
    return 'UNKNOWN'


def _build_peer_payload(
    member: Dict[str, Any],
    cluster_key: Optional[str],
    ha_state: str,
    trust_domain: Optional[str]
) -> Dict[str, Any]:
    payload = {
        'name': member.get('name'),
        'hostname': member.get('hostname'),
        'management_ip': member.get('management_ip'),
        'failover_state': (member.get('failover_state') or '').upper() or None,
        'ha_state': ha_state,
        'traffic_groups_active': member.get('traffic_groups_active', []),
        'cluster_key': cluster_key,
        'trust_domain': trust_domain,
        'sync_status': member.get('sync_status'),
        'sync_status_color': member.get('sync_status_color'),
    }
    # Preserve original type/self info if available for backward compatibility
    if 'self_device' in member:
        payload['type'] = member['self_device']
    if 'is_local' in member:
        payload['is_local'] = member['is_local']
    return payload


def _safe_get(nested: dict, *path: str) -> Optional[Any]:
    """Navegar un dict anidado usando keys en *path. Retorna None si falta algún paso."""
    cur = nested
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return None
        cur = cur[key]
    return cur


def get_device_trust_info(mgmt: ManagementRoot) -> Dict[str, Any]:
    """Gather topology data for sync-failover clusters and standalone devices."""

    trust_domain = _fetch_trust_domain(mgmt)
    devices_by_name, devices_by_ip = _fetch_device_records(mgmt)
    sync_status_by_group = _fetch_sync_status_by_group(mgmt)
    active_traffic_groups = _fetch_active_traffic_groups(mgmt)

    session = mgmt._meta_data.get('icr_session')
    clusters: List[Dict[str, Any]] = []
    cluster_membership: Dict[str, str] = {}
    local_device_record: Optional[Dict[str, Any]] = None

    try:
        device_groups = mgmt.tm.cm.device_groups.get_collection()
    except Exception as exc:
        logger.error("Unable to fetch device-group collection: %s", exc)
        device_groups = []

    for group in device_groups:
        group_type = (getattr(group, 'type', '') or '').lower()
        if group_type != 'sync-failover':
            continue

        raw_group_name = getattr(group, 'fullPath', None) or getattr(group, 'name', None)
        normalized_group = _normalize_device_group_name(raw_group_name or getattr(group, 'name', ''))
        cluster_key = _build_cluster_key(trust_domain, normalized_group)
        sync_status = sync_status_by_group.get(normalized_group.lower(), {'status': 'Unknown', 'color': None})

        members_payload = _fetch_device_group_members(group, session)
        members: List[Dict[str, Any]] = []

        for member in members_payload:
            normalized_name = _normalize_device_name(member.get('name') or member.get('hostname'))
            record = devices_by_name.get(normalized_name)
            if not record and member.get('management_ip'):
                record = devices_by_ip.get(member['management_ip'])

            failover_state = None
            if record:
                failover_state = record.get('failover_state')
            if not failover_state:
                failover_state = member.get('failover_state')

            ha_state = _derive_member_ha_state(normalized_name, failover_state, active_traffic_groups)

            member_info = {
                'name': member.get('name'),
                'hostname': member.get('hostname') or (record.get('hostname') if record else None),
                'management_ip': member.get('management_ip') or (record.get('management_ip') if record else None),
                'failover_state': failover_state,
                'traffic_groups_active': active_traffic_groups.get(normalized_name, []),
                'cluster_key': cluster_key,
                'is_local': False,
                'sync_status': sync_status.get('status'),
                'sync_status_color': sync_status.get('color'),
            }

            if record:
                self_flag = str(record.get('self_device', '')).lower()
                if self_flag in ('true', '1', 'yes'):
                    member_info['is_local'] = True
                    local_device_record = {
                        'name': record.get('name'),
                        'hostname': record.get('hostname'),
                        'management_ip': record.get('management_ip')
                    }
            else:
                self_flag = str(member.get('self_device', '')).lower()
                if self_flag in ('true', '1', 'yes'):
                    member_info['is_local'] = True
                    local_device_record = {
                        'name': member.get('name'),
                        'hostname': member.get('hostname'),
                        'management_ip': member.get('management_ip')
                    }

            member_info['ha_state'] = ha_state
            members.append(member_info)
            if normalized_name:
                cluster_membership[normalized_name] = cluster_key or ''

        clusters.append({
            'name': raw_group_name or normalized_group,
            'display_name': normalized_group,
            'cluster_key': cluster_key,
            'sync_status': sync_status,
            'type': group_type,
            'members': members,
        })

    peers: List[Dict[str, Any]] = []
    local_cluster: Optional[Dict[str, Any]] = None

    if clusters:
        for cluster in clusters:
            for member in cluster['members']:
                if member.get('is_local'):
                    local_cluster = cluster
                    break
            if local_cluster:
                break

        if local_cluster is None and local_device_record:
            local_name = _normalize_device_name(local_device_record.get('name') or local_device_record.get('hostname'))
            for cluster in clusters:
                for member in cluster['members']:
                    if _normalize_device_name(member.get('name')) == local_name:
                        member['is_local'] = True
                        local_cluster = cluster
                        break
                if local_cluster:
                    break

        if local_cluster:
            peers = [
                _build_peer_payload({**member}, local_cluster['cluster_key'], member['ha_state'], trust_domain)
                for member in local_cluster['members']
            ]

    standalone_devices: List[Dict[str, Any]] = []
    for name_key, record in devices_by_name.items():
        if cluster_membership.get(name_key):
            continue
        ha_state = _derive_member_ha_state(name_key, record.get('failover_state'), active_traffic_groups)
        standalone_devices.append({
            'name': record.get('name'),
            'hostname': record.get('hostname'),
            'management_ip': record.get('management_ip'),
            'ha_state': ha_state,
        })

    return {
        'trust_domain': trust_domain,
        'local_device': local_device_record,
        'sync_group': local_cluster['display_name'] if local_cluster else None,
        'local_cluster_key': local_cluster['cluster_key'] if local_cluster else None,
        'local_cluster_sync_status': local_cluster['sync_status'] if local_cluster else None,
        'sync_failover_clusters': clusters,
        'standalone_devices': standalone_devices,
        'peers': peers,
    }


def discover_cluster_from_f5(device_id: int) -> Dict[str, Any]:
    """
    Conecta a un F5 específico y obtiene información completa de su cluster.
    
    Args:
        device_id: ID del dispositivo en la base de datos
        
    Returns:
        Dict con información de cluster discovery:
        {
            'status': 'success'|'error',
            'message': str,
            'device_id': int,
            'cluster_info': dict  # Información del cluster obtenida
        }
    """
    db = SessionLocal()
    try:
        device = db.get(Device, device_id)
        if not device:
            return {
                'status': 'error',
                'message': f'Device {device_id} not found',
                'device_id': device_id,
                'cluster_info': {}
            }
            
        if not device.encrypted_password:
            return {
                'status': 'error', 
                'message': f'Device {device.hostname} has no credentials',
                'device_id': device_id,
                'cluster_info': {}
            }
            
        # Conectar al F5
        pwd = decrypt_data(device.encrypted_password)
        mgmt = ManagementRoot(device.ip_address, device.username, pwd, token=True)
        
        # Obtener información de cluster
        cluster_info = get_device_trust_info(mgmt)

        # Actualizar campos específicos del dispositivo en BD
        device.trust_domain = cluster_info.get('trust_domain')
        local_device_payload = cluster_info.get('local_device') or {}
        device.local_device_name = local_device_payload.get('name') or local_device_payload.get('hostname')
        device.sync_group = cluster_info.get('sync_group')
        device.last_cluster_discovery = datetime.utcnow()
        device.cluster_discovery_source = 'f5_api'

        # Actualizar ha_state, cluster_key, sync_status tomando la vista más precisa
        local_peer = None
        device_hostname_lc = (device.hostname or '').lower()
        for peer in cluster_info.get('peers', []):
            peer_ip = (peer.get('management_ip') or '').strip()
            peer_hostname = (peer.get('hostname') or '').lower() if peer.get('hostname') else ''
            peer_name = (peer.get('name') or '').lower()
            short_peer_hostname = peer_hostname.split('.')[0] if '.' in peer_hostname else peer_hostname
            short_device_hostname = device_hostname_lc.split('.')[0] if '.' in device_hostname_lc else device_hostname_lc
            if (
                peer.get('is_local')
                or (peer_ip and peer_ip == device.ip_address)
                or (peer_hostname and peer_hostname == device_hostname_lc)
                or (short_peer_hostname and short_peer_hostname == short_device_hostname)
                or (peer_name and (peer_name == device_hostname_lc or peer_name == short_device_hostname))
            ):
                local_peer = peer
                break

        local_cluster_key = cluster_info.get('local_cluster_key')
        local_cluster_status = cluster_info.get('local_cluster_sync_status') or {}

        if local_peer:
            cluster_assignment = (local_peer.get('cluster_key') or local_cluster_key or '').strip()
            device.cluster_key = cluster_assignment or None
            if local_peer.get('ha_state'):
                device.ha_state = local_peer['ha_state']
            elif local_peer.get('failover_state'):
                device.ha_state = str(local_peer['failover_state']).upper()
            sync_status_value = local_peer.get('sync_status') or local_cluster_status.get('status')
            device.sync_status = sync_status_value or device.sync_status or 'Unknown'
            device.is_primary_preferred = (device.ha_state or '').upper() == 'ACTIVE'
        else:
            # El dispositivo no pertenece a un cluster sync-failover
            device.cluster_key = None
            device.is_primary_preferred = False
            device.sync_status = 'N/A'

            # Intentar recuperar ha_state desde standalone metadata
            short_device_hostname = device_hostname_lc.split('.')[0] if device_hostname_lc else ''
            for standalone in cluster_info.get('standalone_devices', []):
                standalone_hostname = (standalone.get('hostname') or '').lower()
                if (
                    standalone.get('management_ip') == device.ip_address
                    or standalone_hostname == device_hostname_lc
                    or (short_device_hostname and standalone_hostname.split('.')[0] == short_device_hostname)
                ):
                    if standalone.get('ha_state'):
                        device.ha_state = standalone['ha_state']
                    break

        # Guardar peer device IDs como JSON
        peer_info = []
        for peer in cluster_info.get('peers', []):
            peer_ip = peer.get('management_ip', '')
            if peer_ip == device.ip_address:
                continue
            peer_info.append({
                'name': peer.get('name', ''),
                'ip': peer_ip,
                'hostname': peer.get('hostname', ''),
                'failover_state': peer.get('failover_state', ''),
                'ha_state': peer.get('ha_state'),
                'cluster_key': peer.get('cluster_key'),
                'sync_status': peer.get('sync_status'),
            })

        device.peer_device_ids = json.dumps(peer_info) if peer_info else None

        db.commit()

        logger.info(f"Successfully discovered cluster info for {device.hostname}")
        
        return {
            'status': 'success',
            'message': f'Cluster discovery completed for {device.hostname}',
            'device_id': device_id,
            'cluster_info': cluster_info
        }
        
    except F5SDKError as e:
        logger.error(f"F5 SDK error during cluster discovery for device {device_id}: {e}")
        return {
            'status': 'error',
            'message': f'F5 connection error: {str(e)}',
            'device_id': device_id,
            'cluster_info': {}
        }
        
    except Exception as e:
        logger.error(f"Error during cluster discovery for device {device_id}: {e}")
        return {
            'status': 'error',
            'message': f'Discovery error: {str(e)}',
            'device_id': device_id,
            'cluster_info': {}
        }
        
    finally:
        db.close()


def match_peers_to_devices(cluster_info: Dict[str, Any], db: Session) -> Dict[str, Any]:
    """
    Intenta hacer match de los peers encontrados con dispositivos en la base de datos.
    
    Args:
        cluster_info: Información de cluster obtenida de get_device_trust_info
        db: Sesión de base de datos
        
    Returns:
        Dict con información de matching:
        {
            'matched_peers': [
                {
                    'peer_name': str,
                    'peer_ip': str,
                    'device_id': int,      # ID en nuestra BD (si se encontró)
                    'device_hostname': str, # hostname en nuestra BD
                    'matched': bool        # True si se hizo match
                }
            ],
            'unmatched_count': int,
            'total_peers': int
        }
    """
    matched_peers = []
    unmatched_count = 0
    
    # Obtener todos los dispositivos de la BD para hacer matching
    all_devices = db.query(Device).all()
    device_by_ip = {dev.ip_address: dev for dev in all_devices}
    device_by_hostname = {dev.hostname.lower(): dev for dev in all_devices if dev.hostname}
    device_by_shortname = {
        dev.hostname.split('.')[0].lower(): dev
        for dev in all_devices
        if dev.hostname and '.' in dev.hostname
    }
    
    for peer in cluster_info.get('peers', []):
        peer_ip = peer.get('management_ip', '')
        peer_name = peer.get('name', '')
        peer_hostname = peer.get('hostname', '')

        # Intentar match por IP
        matched_device = device_by_ip.get(peer_ip)

        # Si no hay match por IP, intentar por hostname
        if not matched_device and peer_hostname:
            matched_device = device_by_hostname.get(peer_hostname.lower())
            
        # Intentar por hostname corto si aplica
        if not matched_device and peer_hostname and '.' in peer_hostname:
            matched_device = device_by_shortname.get(peer_hostname.split('.')[0].lower())

        # Si no hay match por hostname, intentar por name
        if not matched_device and peer_name:
            matched_device = device_by_hostname.get(peer_name.lower()) or device_by_shortname.get(peer_name.lower())
            
        peer_info = {
            'peer_name': peer_name,
            'peer_ip': peer_ip,
            'peer_hostname': peer_hostname,
            'failover_state': peer.get('failover_state'),
            'ha_state': peer.get('ha_state'),
            'cluster_key': peer.get('cluster_key'),
            'sync_status': peer.get('sync_status'),
            'raw_peer': peer,
            'device_id': matched_device.id if matched_device else None,
            'device_hostname': matched_device.hostname if matched_device else None,
            'matched': matched_device is not None,
            'device_obj': matched_device,
        }
        
        matched_peers.append(peer_info)
        
        if not matched_device:
            unmatched_count += 1
            
    return {
        'matched_peers': matched_peers,
        'unmatched_count': unmatched_count,
        'total_peers': len(cluster_info.get('peers', []))
    }


def discover_all_clusters() -> Dict[str, Any]:
    """
    Ejecuta cluster discovery en todos los dispositivos activos y correlaciona la información.
    
    Returns:
        Dict con resultados de discovery completo:
        {
            'status': 'success'|'partial'|'error',
            'message': str,
            'discovered_clusters': [
                {
                    'cluster_id': str,      # Identificador único del cluster
                    'devices': [            # Dispositivos que forman el cluster
                        {
                            'device_id': int,
                            'hostname': str,
                            'ip_address': str,
                            'failover_state': str,
                            'is_local': bool    # True si es el dispositivo consultado
                        }
                    ],
                    'sync_group': str,
                    'trust_domain': str
                }
            ],
            'standalone_devices': [int],    # IDs de dispositivos standalone
            'failed_devices': [int],        # IDs de dispositivos que fallaron
            'total_processed': int
        }
    """
    db = SessionLocal()
    try:
        # Obtener todos los dispositivos activos
        active_devices = db.query(Device).filter(Device.active == True).all()
        
        if not active_devices:
            return {
                'status': 'error',
                'message': 'No active devices found',
                'discovered_clusters': [],
                'standalone_devices': [],
                'failed_devices': [],
                'total_processed': 0
            }
            
        discovered_clusters: Dict[str, Dict[str, Any]] = {}
        standalone_device_ids: Set[int] = set()
        failed_devices: List[int] = []

        def _ensure_cluster_entry(cluster_key: str, trust_domain: Optional[str], cluster_payload: Dict[str, Any]) -> Dict[str, Any]:
            entry = discovered_clusters.get(cluster_key)
            if not entry:
                entry = {
                    'cluster_id': cluster_key,
                    'devices': [],
                    'sync_group': cluster_payload.get('display_name') or cluster_payload.get('name'),
                    'trust_domain': trust_domain,
                    'sync_status': (cluster_payload.get('sync_status') or {}).get('status'),
                    'sync_status_color': (cluster_payload.get('sync_status') or {}).get('color'),
                    'discovery_source': None,
                }
                discovered_clusters[cluster_key] = entry
            return entry

        for device in active_devices:
            try:
                logger.info("Discovering cluster for device %s", device.hostname)
                discovery_result = discover_cluster_from_f5(device.id)

                if discovery_result['status'] != 'success':
                    failed_devices.append(device.id)
                    continue

                cluster_info = discovery_result['cluster_info'] or {}
                trust_domain = cluster_info.get('trust_domain')

                # Procesar clusters sync-failover
                for cluster_payload in cluster_info.get('sync_failover_clusters', []):
                    members = cluster_payload.get('members', [])
                    cluster_key = cluster_payload.get('cluster_key')
                    if not cluster_key or not members:
                        continue

                    matching_result = match_peers_to_devices({'peers': members}, db)
                    cluster_entry = _ensure_cluster_entry(cluster_key, trust_domain, cluster_payload)
                    if cluster_entry['discovery_source'] is None:
                        cluster_entry['discovery_source'] = device.hostname

                    for peer_match in matching_result['matched_peers']:
                        peer = peer_match.get('raw_peer') or {}
                        matched_device = peer_match.get('device_obj')

                        device_entry = {
                            'device_id': matched_device.id if matched_device else None,
                            'hostname': matched_device.hostname if matched_device else peer.get('hostname'),
                            'ip_address': matched_device.ip_address if matched_device else peer.get('management_ip'),
                            'ha_state': peer.get('ha_state'),
                            'failover_state': peer.get('failover_state'),
                            'sync_status': peer.get('sync_status') or cluster_entry['sync_status'],
                            'is_local': bool(peer.get('is_local')),
                        }

                        existing = next((item for item in cluster_entry['devices'] if item.get('device_id') == device_entry['device_id'] and device_entry['device_id'] is not None), None)
                        if not existing and device_entry['device_id'] is None:
                            existing = next((item for item in cluster_entry['devices'] if item.get('hostname') == device_entry['hostname'] and item.get('ip_address') == device_entry['ip_address']), None)

                        if existing:
                            existing.update({k: v for k, v in device_entry.items() if v is not None})
                        else:
                            cluster_entry['devices'].append(device_entry)

                        if matched_device:
                            cluster_assignment = (peer.get('cluster_key') or cluster_key or '').strip()
                            matched_device.cluster_key = cluster_assignment or None
                            matched_device.trust_domain = trust_domain
                            matched_device.sync_status = device_entry['sync_status'] or 'Unknown'
                            if peer.get('ha_state'):
                                matched_device.ha_state = peer['ha_state']
                            elif peer.get('failover_state'):
                                matched_device.ha_state = str(peer['failover_state']).upper()
                            matched_device.is_primary_preferred = (matched_device.ha_state or '').upper() == 'ACTIVE'
                            matched_device.last_cluster_discovery = datetime.utcnow()
                            matched_device.cluster_discovery_source = 'f5_api'

                # Marcar dispositivos standalone detectados desde este escaneo
                for standalone in cluster_info.get('standalone_devices', []):
                    peer_match = match_peers_to_devices({'peers': [standalone]}, db)
                    for peer_info in peer_match['matched_peers']:
                        if peer_info['matched'] and peer_info['device_id'] not in standalone_device_ids:
                            standalone_device_ids.add(peer_info['device_id'])
                            device_obj = peer_info.get('device_obj')
                            if device_obj:
                                device_obj.cluster_key = None
                                device_obj.sync_status = 'N/A'
                                if standalone.get('ha_state'):
                                    device_obj.ha_state = standalone['ha_state']
                                device_obj.is_primary_preferred = False
                                device_obj.last_cluster_discovery = datetime.utcnow()
                                device_obj.cluster_discovery_source = 'f5_api'

            except Exception as exc:
                logger.error("Error discovering cluster for device %s: %s", device.hostname, exc)
                failed_devices.append(device.id)

        db.commit()

        total_processed = len(active_devices)
        success_count = total_processed - len(failed_devices)

        if success_count == 0:
            status = 'error'
            message = 'All device discovery attempts failed'
        elif failed_devices:
            status = 'partial'
            message = f'Discovery completed with {len(failed_devices)} failures'
        else:
            status = 'success'
            message = 'All devices discovered successfully'

        return {
            'status': status,
            'message': message,
            'discovered_clusters': list(discovered_clusters.values()),
            'standalone_devices': list(standalone_device_ids),
            'failed_devices': failed_devices,
            'total_processed': total_processed
        }
        
    except Exception as e:
        logger.error(f"Error in discover_all_clusters: {e}")
        return {
            'status': 'error',
            'message': f'Discovery failed: {str(e)}',
            'discovered_clusters': [],
            'standalone_devices': [],
            'failed_devices': [],
            'total_processed': 0
        }
        
    finally:
        db.close()
