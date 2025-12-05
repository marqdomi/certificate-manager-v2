# backend/services/credential_resolver.py
"""
Credential Resolution for F5 Devices

This module provides a fallback credential system for F5 device authentication.
When a device doesn't have individual credentials configured, the system
attempts to use fallback credentials based on the device's hostname pattern.

Credential Priority:
1. Device-specific credentials (stored encrypted in DB)
2. Fallback credentials based on hostname pattern (from environment)
3. Default fallback credentials (from environment)

Environment Variables:
- F5_FALLBACK_ENABLED: Enable/disable fallback system (default: "true")
- F5_FALLBACK_DEFAULT_USER: Default username if no pattern matches
- F5_FALLBACK_DEFAULT_PASS: Default password if no pattern matches
- F5_FALLBACK_SET_<N>_PATTERN: Regex pattern for credential set N
- F5_FALLBACK_SET_<N>_USER: Username for credential set N
- F5_FALLBACK_SET_<N>_PASS: Password for credential set N

Example .env configuration:
    F5_FALLBACK_ENABLED=true
    F5_FALLBACK_DEFAULT_USER=marco.a.dominguez
    F5_FALLBACK_DEFAULT_PASS=Mostwanted02020!!
    F5_FALLBACK_SET_1_PATTERN=.*omnitracs.*
    F5_FALLBACK_SET_1_USER=admin
    F5_FALLBACK_SET_1_PASS=wwBV7mz:9Mhj
    F5_FALLBACK_SET_2_PATTERN=.*eudc.*-test.*
    F5_FALLBACK_SET_2_USER=admin
    F5_FALLBACK_SET_2_PASS=R0undt0w3r!
"""

import os
import re
from typing import Optional, Tuple, NamedTuple
from dataclasses import dataclass

from core.logger import get_f5_logger
from services import encryption_service
from db.models import Device

logger = get_f5_logger()


@dataclass
class CredentialSet:
    """A set of credentials with optional pattern matching."""
    pattern: Optional[re.Pattern]
    username: str
    password: str
    name: str  # For logging purposes


class ResolvedCredentials(NamedTuple):
    """Result of credential resolution."""
    username: str
    password: str
    source: str  # 'device', 'fallback:<name>', or 'default'


def _load_fallback_credentials() -> list[CredentialSet]:
    """
    Load fallback credential sets from environment variables.
    
    Scans for F5_FALLBACK_SET_<N>_* variables where N is 1-99.
    """
    credential_sets = []
    
    for i in range(1, 100):
        pattern_var = f"F5_FALLBACK_SET_{i}_PATTERN"
        user_var = f"F5_FALLBACK_SET_{i}_USER"
        pass_var = f"F5_FALLBACK_SET_{i}_PASS"
        
        pattern_str = os.getenv(pattern_var)
        username = os.getenv(user_var)
        password = os.getenv(pass_var)
        
        # Stop scanning when we hit a gap
        if not pattern_str and not username and not password:
            if i > 1:  # Allow gaps at the start
                continue
            break
            
        if username and password:
            try:
                pattern = re.compile(pattern_str, re.IGNORECASE) if pattern_str else None
                credential_sets.append(CredentialSet(
                    pattern=pattern,
                    username=username,
                    password=password,
                    name=f"set_{i}"
                ))
                logger.debug(f"Loaded fallback credential set {i}: pattern={pattern_str}")
            except re.error as e:
                logger.warning(f"Invalid regex in {pattern_var}: {e}")
    
    return credential_sets


# Cache the loaded credential sets
_fallback_credentials: Optional[list[CredentialSet]] = None


def _get_fallback_credentials() -> list[CredentialSet]:
    """Get cached fallback credentials, loading them if needed."""
    global _fallback_credentials
    if _fallback_credentials is None:
        _fallback_credentials = _load_fallback_credentials()
    return _fallback_credentials


def is_fallback_enabled() -> bool:
    """Check if fallback credentials are enabled."""
    return os.getenv("F5_FALLBACK_ENABLED", "true").lower() in ("true", "1", "yes")


def resolve_credentials(device: Device) -> Optional[ResolvedCredentials]:
    """
    Resolve credentials for a device using the priority chain:
    1. Device-specific credentials
    2. Pattern-matched fallback credentials
    3. Default fallback credentials
    
    Args:
        device: The Device object to resolve credentials for
        
    Returns:
        ResolvedCredentials tuple or None if no credentials available
    """
    hostname = device.hostname or ""
    
    # Priority 1: Device-specific credentials
    if device.username and device.encrypted_password:
        try:
            password = encryption_service.decrypt_data(device.encrypted_password)
            logger.debug(f"Using device-specific credentials for {hostname}")
            return ResolvedCredentials(
                username=device.username,
                password=password,
                source="device"
            )
        except Exception as e:
            logger.warning(f"Failed to decrypt device credentials for {hostname}: {e}")
    
    # Check if fallback is enabled
    if not is_fallback_enabled():
        logger.debug(f"Fallback disabled, no credentials for {hostname}")
        return None
    
    # Priority 2: Pattern-matched fallback credentials
    fallback_sets = _get_fallback_credentials()
    for cred_set in fallback_sets:
        if cred_set.pattern and cred_set.pattern.search(hostname):
            logger.info(f"Using fallback credentials '{cred_set.name}' for {hostname} (pattern match)")
            return ResolvedCredentials(
                username=cred_set.username,
                password=cred_set.password,
                source=f"fallback:{cred_set.name}"
            )
    
    # Priority 3: Default fallback credentials
    default_user = os.getenv("F5_FALLBACK_DEFAULT_USER")
    default_pass = os.getenv("F5_FALLBACK_DEFAULT_PASS")
    
    if default_user and default_pass:
        logger.info(f"Using default fallback credentials for {hostname}")
        return ResolvedCredentials(
            username=default_user,
            password=default_pass,
            source="default"
        )
    
    logger.warning(f"No credentials available for {hostname}")
    return None


def get_credential_summary() -> dict:
    """
    Get a summary of configured credentials for diagnostics.
    
    Returns:
        dict with fallback configuration summary (no passwords)
    """
    fallback_sets = _get_fallback_credentials()
    
    return {
        "fallback_enabled": is_fallback_enabled(),
        "default_configured": bool(
            os.getenv("F5_FALLBACK_DEFAULT_USER") and 
            os.getenv("F5_FALLBACK_DEFAULT_PASS")
        ),
        "fallback_sets": [
            {
                "name": s.name,
                "pattern": s.pattern.pattern if s.pattern else None,
                "username": s.username
            }
            for s in fallback_sets
        ]
    }
