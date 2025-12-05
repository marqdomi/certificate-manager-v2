# backend/services/network_discovery.py
"""
Network Discovery Service for F5 Devices

This module provides functionality to discover F5 devices on the network
by scanning IP ranges and validating F5 REST API endpoints.

Features:
- Subnet/CIDR scanning with concurrent probing
- F5 device validation via REST API
- Device information extraction (hostname, version, HA state, etc.)
- Pre-configured subnet presets for known environments
- Integration with credential resolver for authentication
"""

import asyncio
import ipaddress
import socket
import ssl
import json
import re
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
import urllib.request
import urllib.error

from core.logger import get_f5_logger
from services.credential_resolver import (
    _get_fallback_credentials,
    is_fallback_enabled,
    ResolvedCredentials
)

logger = get_f5_logger()

# ═══════════════════════════════════════════════════════════════════════════════
# PRESET CONFIGURATIONS
# ═══════════════════════════════════════════════════════════════════════════════

# Pre-configured subnet presets based on known F5 environments
DISCOVERY_PRESETS: Dict[str, Dict[str, Any]] = {
    # Quick test preset with just a few known IPs
    "test_small": {
        "name": "🧪 Test (3 IPs)",
        "subnets": ["10.119.0.75-10.119.0.77"],
        "description": "Small test with 3 known F5 devices"
    },
    "usdc01": {
        "name": "US DC01 (16 devices)",
        "subnets": ["10.119.0.75-10.119.0.91"],
        "description": "US Datacenter 01 - Dallas"
    },
    "usdc02": {
        "name": "US DC02 (12 devices)",
        "subnets": ["10.119.8.0/24"],
        "description": "US Datacenter 02"
    },
    "eudc01": {
        "name": "EU DC01 (14 devices)",
        "subnets": ["10.119.16.75-10.119.16.91"],
        "description": "European Datacenter 01 - Amsterdam"
    },
    "eudc02": {
        "name": "EU DC02 (14 devices)",
        "subnets": ["10.119.24.0/24"],
        "description": "European Datacenter 02 - Frankfurt"
    },
    "audc10": {
        "name": "AU DC10 (2 devices)",
        "subnets": ["10.119.35.0/24"],
        "description": "Australia Datacenter - Sydney"
    },
    "bedc01": {
        "name": "BE DC01 (2 devices)",
        "subnets": ["10.119.34.0/24"],
        "description": "Belgium Datacenter - Brussels"
    },
    "sgdc10": {
        "name": "SG DC10 (2 devices)",
        "subnets": ["10.119.37.0/24"],
        "description": "Singapore Datacenter"
    },
    "rudc10": {
        "name": "RU DC10 (4 devices)",
        "subnets": ["10.119.36.0/24", "172.20.188.0/24"],
        "description": "Russia Datacenter - Moscow"
    },
    "omnitracs": {
        "name": "Omnitracs (27 devices)",
        "subnets": ["192.168.13.0/24", "192.168.52.0/24"],
        "description": "Omnitracs datacenters (separate credentials)"
    },
    "all_inventory": {
        "name": "All Inventory Subnets",
        "subnets": [
            "10.119.0.75-10.119.0.91",
            "10.119.8.0/24", 
            "10.119.16.75-10.119.16.91", 
            "10.119.24.0/24", 
            "10.119.34.0/24", 
            "10.119.35.0/24",
            "10.119.36.0/24", 
            "10.119.37.0/24",
            "172.20.188.0/24",
            "192.168.13.0/24",
            "192.168.52.0/24"
        ],
        "description": "All subnets from current inventory"
    }
}

# Site derivation from IP ranges
SITE_IP_MAPPING = {
    "10.119.0.": "us,dc01",
    "10.119.8.": "us,dc02",
    "10.119.16.": "eu,dc01",
    "10.119.24.": "eu,dc02",
    "10.119.34.": "be,dc01",
    "10.119.35.": "au,dc10",
    "10.119.36.": "ru,dc10",
    "10.119.37.": "sg,dc10",
    "172.20.188.": "ru,dc10",
    "192.168.13.": "ot,dc01",
    "192.168.52.": "ot,dc02",
    "10.25.4.": "ot,dc02",
}


# ═══════════════════════════════════════════════════════════════════════════════
# DATA CLASSES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class ProbeResult:
    """Result of probing a single IP for F5 device."""
    ip_address: str
    is_f5: bool
    port_open: bool
    hostname: Optional[str] = None
    version: Optional[str] = None
    platform: Optional[str] = None
    serial_number: Optional[str] = None
    ha_state: Optional[str] = None
    sync_status: Optional[str] = None
    error_message: Optional[str] = None
    credential_source: Optional[str] = None
    suggested_site: Optional[str] = None
    suggested_cluster_key: Optional[str] = None
    probe_time_ms: int = 0


@dataclass
class DiscoveryProgress:
    """Progress update for discovery job."""
    job_id: int
    total_ips: int
    scanned_ips: int
    found_devices: int
    current_ip: Optional[str] = None
    status: str = "running"


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def expand_subnets(subnets: List[str]) -> List[str]:
    """
    Expand a list of subnets/CIDRs into individual IP addresses.
    
    Args:
        subnets: List of subnet strings. Supports:
            - CIDR notation: "10.119.0.0/24"
            - Full IP range: "10.119.0.75-10.119.0.77"
            - Short range: "10.119.0.80-90"
            - Single IP: "10.119.0.75"
        
    Returns:
        List of individual IP addresses
    """
    ips = []
    for subnet in subnets:
        subnet = subnet.strip()
        if not subnet:
            continue
            
        try:
            # Handle CIDR notation
            if "/" in subnet:
                network = ipaddress.ip_network(subnet, strict=False)
                # Skip network and broadcast addresses for /24 and larger
                if network.prefixlen <= 24:
                    ips.extend([str(ip) for ip in network.hosts()])
                else:
                    ips.extend([str(ip) for ip in network])
            # Handle range notation
            elif "-" in subnet:
                # Check if it's a full IP range (10.119.0.75-10.119.0.77)
                if subnet.count(".") >= 4:
                    # Full IP range format
                    start_ip, end_ip = subnet.split("-")
                    start = ipaddress.ip_address(start_ip.strip())
                    end = ipaddress.ip_address(end_ip.strip())
                    
                    current = start
                    while current <= end:
                        ips.append(str(current))
                        current = ipaddress.ip_address(int(current) + 1)
                else:
                    # Short range format (10.119.0.80-90)
                    parts = subnet.rsplit(".", 1)
                    if len(parts) == 2 and "-" in parts[1]:
                        base = parts[0]
                        range_part = parts[1]
                        start, end = range_part.split("-")
                        for i in range(int(start), int(end) + 1):
                            ips.append(f"{base}.{i}")
            # Single IP
            else:
                ipaddress.ip_address(subnet)  # Validate
                ips.append(subnet)
        except ValueError as e:
            logger.warning(f"Invalid subnet/IP format '{subnet}': {e}")
            continue
    
    return list(set(ips))  # Remove duplicates


def derive_site_from_ip(ip: str) -> Optional[str]:
    """Derive site name from IP address based on known patterns."""
    for prefix, site in SITE_IP_MAPPING.items():
        if ip.startswith(prefix):
            return site
    return None


def derive_cluster_key(hostname: str) -> Optional[str]:
    """
    Derive cluster key from hostname using naming patterns.
    
    Removes suffixes like -LB01-PRI, -LB02-SEC, etc.
    """
    if not hostname:
        return None
    
    # Pattern to match F5 naming conventions
    patterns = [
        r"(-LB0?\d+-(PRI|SEC|PRIMARY|SECONDARY))$",  # -LB01-PRI, -LB1-SEC
        r"(-0?\d+-(PRI|SEC))$",  # -01-PRI, -1-SEC
        r"(-lb-0?\d+)$",  # -lb-001, -lb-002
        r"(-0?\d+)\..*$",  # -001.domain, -002.domain
    ]
    
    result = hostname
    for pattern in patterns:
        result = re.sub(pattern, "", result, flags=re.IGNORECASE)
    
    return result if result != hostname else hostname.rsplit(".", 1)[0]


# ═══════════════════════════════════════════════════════════════════════════════
# NETWORK PROBING
# ═══════════════════════════════════════════════════════════════════════════════

async def check_port_open(ip: str, port: int = 443, timeout: float = 2.0) -> bool:
    """
    Check if a TCP port is open on the given IP.
    
    Args:
        ip: IP address to check
        port: TCP port number (default 443)
        timeout: Connection timeout in seconds
        
    Returns:
        True if port is open, False otherwise
    """
    loop = asyncio.get_event_loop()
    try:
        # Use run_in_executor for blocking socket operations
        def _check():
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            try:
                result = sock.connect_ex((ip, port))
                return result == 0
            finally:
                sock.close()
        
        return await loop.run_in_executor(None, _check)
    except Exception:
        return False


def _make_f5_request(ip: str, path: str, username: str, password: str, timeout: float = 5.0) -> Optional[Dict]:
    """
    Make an authenticated request to F5 REST API.
    
    Args:
        ip: F5 IP address
        path: API path (e.g., "/mgmt/tm/sys/version")
        username: F5 username
        password: F5 password
        timeout: Request timeout
        
    Returns:
        JSON response dict or None on failure
    """
    url = f"https://{ip}{path}"
    
    # Create SSL context that doesn't verify certificates (F5 self-signed)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    # Create request with basic auth
    request = urllib.request.Request(url)
    import base64
    credentials = base64.b64encode(f"{username}:{password}".encode()).decode()
    request.add_header("Authorization", f"Basic {credentials}")
    request.add_header("Content-Type", "application/json")
    
    try:
        with urllib.request.urlopen(request, timeout=timeout, context=ctx) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 401:
            raise ValueError("Authentication failed")
        raise
    except Exception:
        raise


async def probe_f5_device(
    ip: str, 
    credentials: List[Tuple[str, str, str]],  # [(username, password, source_name), ...]
    timeout: float = 5.0
) -> ProbeResult:
    """
    Probe an IP to check if it's an F5 device and extract info.
    
    Args:
        ip: IP address to probe
        credentials: List of credential tuples to try
        timeout: Request timeout
        
    Returns:
        ProbeResult with device information
    """
    start_time = datetime.now()
    result = ProbeResult(
        ip_address=ip,
        is_f5=False,
        port_open=False,
        suggested_site=derive_site_from_ip(ip)
    )
    
    # First check if port 443 is open
    if not await check_port_open(ip, 443, timeout=2.0):
        result.error_message = "Port 443 not open"
        result.probe_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        return result
    
    result.port_open = True
    
    # Try each credential set
    loop = asyncio.get_event_loop()
    
    for username, password, source in credentials:
        try:
            # Check version endpoint (confirms it's F5)
            version_data = await loop.run_in_executor(
                None, 
                lambda: _make_f5_request(ip, "/mgmt/tm/sys/version", username, password, timeout)
            )
            
            if version_data:
                result.is_f5 = True
                result.credential_source = source
                
                # Extract version info
                entries = version_data.get("entries", {})
                for key, val in entries.items():
                    nested = val.get("nestedStats", {}).get("entries", {})
                    if "Version" in nested:
                        result.version = nested["Version"].get("description")
                    if "Build" in nested:
                        build = nested["Build"].get("description", "")
                        if result.version and build:
                            result.version = f"{result.version}"
                    break
                
                # Get hostname from global-settings
                try:
                    settings_data = await loop.run_in_executor(
                        None,
                        lambda: _make_f5_request(ip, "/mgmt/tm/sys/global-settings", username, password, timeout)
                    )
                    if settings_data:
                        result.hostname = settings_data.get("hostname")
                        if result.hostname:
                            result.suggested_cluster_key = derive_cluster_key(result.hostname)
                except Exception:
                    pass
                
                # Get HA state from failover
                try:
                    failover_data = await loop.run_in_executor(
                        None,
                        lambda: _make_f5_request(ip, "/mgmt/tm/cm/failover-status", username, password, timeout)
                    )
                    if failover_data:
                        entries = failover_data.get("entries", {})
                        for val in entries.values():
                            nested = val.get("nestedStats", {}).get("entries", {})
                            if "status" in nested:
                                status = nested["status"].get("description", "")
                                result.ha_state = status.upper() if status else None
                            break
                except Exception:
                    pass
                
                # Get sync status
                try:
                    sync_data = await loop.run_in_executor(
                        None,
                        lambda: _make_f5_request(ip, "/mgmt/tm/cm/sync-status", username, password, timeout)
                    )
                    if sync_data:
                        entries = sync_data.get("entries", {})
                        for val in entries.values():
                            nested = val.get("nestedStats", {}).get("entries", {})
                            if "status" in nested:
                                status_entries = nested["status"].get("nestedStats", {}).get("entries", {})
                                for sv in status_entries.values():
                                    desc = sv.get("description", "")
                                    if desc:
                                        result.sync_status = desc
                                    break
                            break
                except Exception:
                    pass
                
                break  # Successfully probed, stop trying credentials
                
        except ValueError as e:
            # Auth failed, try next credential
            continue
        except Exception as e:
            result.error_message = str(e)
            continue
    
    if result.port_open and not result.is_f5:
        result.error_message = "Port 443 open but not F5 or auth failed"
    
    result.probe_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# DISCOVERY ORCHESTRATION
# ═══════════════════════════════════════════════════════════════════════════════

def get_credentials_for_discovery() -> List[Tuple[str, str, str]]:
    """
    Get list of credentials to try during discovery.
    
    Returns:
        List of (username, password, source_name) tuples
    """
    import os
    credentials = []
    
    # Add fallback credential sets
    if is_fallback_enabled():
        fallback_sets = _get_fallback_credentials()
        for cred_set in fallback_sets:
            credentials.append((cred_set.username, cred_set.password, f"fallback:{cred_set.name}"))
    
    # Add default credentials
    default_user = os.getenv("F5_FALLBACK_DEFAULT_USER")
    default_pass = os.getenv("F5_FALLBACK_DEFAULT_PASS")
    if default_user and default_pass:
        credentials.append((default_user, default_pass, "default"))
    
    # Add hardcoded common credentials as last resort
    if not credentials:
        credentials.append(("admin", "admin", "common"))
    
    return credentials


async def run_discovery(
    subnets: List[str],
    credentials: List[Tuple[str, str, str]] = None,
    max_concurrent: int = 100,
    progress_callback=None
) -> List[ProbeResult]:
    """
    Run network discovery on given subnets.
    
    Args:
        subnets: List of subnets/CIDRs to scan
        credentials: List of (username, password, source_name) tuples provided by user
        max_concurrent: Maximum concurrent probes (default 100)
        progress_callback: Optional async callback for progress updates
        
    Returns:
        List of ProbeResult for all F5 devices found
    """
    # Expand subnets to individual IPs
    all_ips = expand_subnets(subnets)
    total_ips = len(all_ips)
    
    logger.info(f"Starting discovery of {total_ips} IPs from subnets: {subnets}")
    
    # Use provided credentials or fall back to system credentials
    if credentials:
        creds_to_use = credentials
        logger.info(f"Using {len(creds_to_use)} user-provided credential set(s)")
    else:
        creds_to_use = get_credentials_for_discovery()
        logger.info(f"Using {len(creds_to_use)} system credential set(s)")
    
    results: List[ProbeResult] = []
    scanned = 0
    found = 0
    
    # Create semaphore for concurrency control
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def probe_with_semaphore(ip: str) -> ProbeResult:
        async with semaphore:
            return await probe_f5_device(ip, creds_to_use)
    
    # Process in batches for progress updates
    batch_size = 50
    for i in range(0, len(all_ips), batch_size):
        batch = all_ips[i:i + batch_size]
        
        # Probe batch concurrently
        batch_results = await asyncio.gather(
            *[probe_with_semaphore(ip) for ip in batch],
            return_exceptions=True
        )
        
        for result in batch_results:
            scanned += 1
            if isinstance(result, ProbeResult):
                if result.is_f5:
                    results.append(result)
                    found += 1
                    logger.info(f"Found F5: {result.ip_address} ({result.hostname})")
            else:
                logger.warning(f"Probe exception: {result}")
        
        # Progress callback
        if progress_callback:
            await progress_callback(DiscoveryProgress(
                job_id=0,  # Will be set by caller
                total_ips=total_ips,
                scanned_ips=scanned,
                found_devices=found,
                current_ip=batch[-1] if batch else None,
                status="running"
            ))
    
    logger.info(f"Discovery complete: scanned {scanned} IPs, found {found} F5 devices")
    return results


def get_discovery_presets() -> Dict[str, Dict[str, Any]]:
    """Get available discovery presets."""
    return DISCOVERY_PRESETS
