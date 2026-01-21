# backend/services/radius_auth.py
"""
RADIUS Authentication Service for CMT
=====================================

Authenticates users against NPS (Network Policy Server) / RADIUS servers
that are integrated with Active Directory.

Configuration via environment variables:
- RADIUS_SERVER: Primary RADIUS server (IP or hostname)
- RADIUS_SECRET: Shared secret for RADIUS authentication
- RADIUS_PORT: RADIUS port (default: 1812)
- RADIUS_TIMEOUT: Timeout in seconds (default: 5)
- RADIUS_BACKUP_SERVER: Optional backup RADIUS server
- RADIUS_BACKUP_SECRET: Secret for backup server (uses primary if not set)
"""

import os
import socket
import struct
import hashlib
import secrets
import logging
from dataclasses import dataclass
from typing import Optional, Tuple
from enum import IntEnum

from db.models import UserRole

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# RADIUS PROTOCOL CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

class RadiusCode(IntEnum):
    """RADIUS packet codes"""
    ACCESS_REQUEST = 1
    ACCESS_ACCEPT = 2
    ACCESS_REJECT = 3
    ACCESS_CHALLENGE = 11


class RadiusAttribute(IntEnum):
    """Common RADIUS attribute types"""
    USER_NAME = 1
    USER_PASSWORD = 2
    NAS_IP_ADDRESS = 4
    NAS_PORT = 5
    SERVICE_TYPE = 6
    FRAMED_PROTOCOL = 7
    FILTER_ID = 11  # Often used for group membership
    CLASS = 25  # Session info, sometimes contains group
    NAS_IDENTIFIER = 32
    ACCT_SESSION_ID = 44
    NAS_PORT_TYPE = 61
    # Microsoft Vendor-Specific Attributes
    VENDOR_SPECIFIC = 26


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class RadiusConfig:
    """RADIUS server configuration"""
    server: str
    secret: str
    port: int = 1812
    timeout: int = 5
    backup_server: Optional[str] = None
    backup_secret: Optional[str] = None
    nas_identifier: str = "CMT-Application"
    
    @classmethod
    def from_env(cls) -> Optional['RadiusConfig']:
        """Create config from environment variables"""
        server = os.getenv("RADIUS_SERVER")
        secret = os.getenv("RADIUS_SECRET")
        
        if not server or not secret:
            return None
        
        return cls(
            server=server,
            secret=secret,
            port=int(os.getenv("RADIUS_PORT", "1812")),
            timeout=int(os.getenv("RADIUS_TIMEOUT", "5")),
            backup_server=os.getenv("RADIUS_BACKUP_SERVER"),
            backup_secret=os.getenv("RADIUS_BACKUP_SECRET"),
            nas_identifier=os.getenv("RADIUS_NAS_ID", "CMT-Application"),
        )


@dataclass
class RadiusUser:
    """User info from RADIUS authentication"""
    username: str
    role: UserRole = UserRole.VIEWER
    groups: list = None
    attributes: dict = None
    
    def __post_init__(self):
        if self.groups is None:
            self.groups = []
        if self.attributes is None:
            self.attributes = {}


# ═══════════════════════════════════════════════════════════════════════════════
# ROLE MAPPING
# ═══════════════════════════════════════════════════════════════════════════════

# Map RADIUS Filter-Id or Class attribute values to CMT roles
# NPS can be configured to return these based on AD group membership
RADIUS_ROLE_MAPPING = {
    # Filter-Id values (configure in NPS Network Policy)
    "CMT-Admin": UserRole.ADMIN,
    "CMT-Admins": UserRole.ADMIN,
    "admin": UserRole.ADMIN,
    "Admin": UserRole.ADMIN,
    "CMT-Operator": UserRole.OPERATOR,
    "CMT-Operators": UserRole.OPERATOR,
    "operator": UserRole.OPERATOR,
    "Operator": UserRole.OPERATOR,
    "CMT-Viewer": UserRole.VIEWER,
    "viewer": UserRole.VIEWER,
    "Viewer": UserRole.VIEWER,
}

def get_custom_role_mapping() -> dict:
    """Get custom role mapping from environment"""
    mapping_str = os.getenv("RADIUS_ROLE_MAPPING", "")
    if not mapping_str:
        return RADIUS_ROLE_MAPPING.copy()
    
    mapping = RADIUS_ROLE_MAPPING.copy()
    for item in mapping_str.split(","):
        if ":" in item:
            filter_id, role = item.strip().split(":", 1)
            role_lower = role.strip().lower()
            if role_lower == "admin":
                mapping[filter_id.strip()] = UserRole.ADMIN
            elif role_lower == "operator":
                mapping[filter_id.strip()] = UserRole.OPERATOR
            else:
                mapping[filter_id.strip()] = UserRole.VIEWER
    
    return mapping


# ═══════════════════════════════════════════════════════════════════════════════
# RADIUS PROTOCOL IMPLEMENTATION
# ═══════════════════════════════════════════════════════════════════════════════

class RadiusPacket:
    """Simple RADIUS packet encoder/decoder"""
    
    def __init__(self, code: int, identifier: int, authenticator: bytes = None):
        self.code = code
        self.identifier = identifier
        self.authenticator = authenticator or secrets.token_bytes(16)
        self.attributes = []
    
    def add_attribute(self, attr_type: int, value: bytes):
        """Add an attribute to the packet"""
        self.attributes.append((attr_type, value))
    
    def add_string(self, attr_type: int, value: str):
        """Add a string attribute"""
        self.add_attribute(attr_type, value.encode('utf-8'))
    
    def add_integer(self, attr_type: int, value: int):
        """Add an integer attribute"""
        self.add_attribute(attr_type, struct.pack('>I', value))
    
    def add_ip(self, attr_type: int, ip: str):
        """Add an IP address attribute"""
        self.add_attribute(attr_type, socket.inet_aton(ip))
    
    def encrypt_password(self, password: str, secret: str) -> bytes:
        """
        Encrypt password using RADIUS algorithm (RFC 2865)
        """
        secret_bytes = secret.encode('utf-8')
        password_bytes = password.encode('utf-8')
        
        # Pad password to multiple of 16 bytes
        if len(password_bytes) % 16:
            password_bytes += b'\x00' * (16 - len(password_bytes) % 16)
        
        # XOR encrypt
        result = b''
        last_block = self.authenticator
        
        for i in range(0, len(password_bytes), 16):
            # MD5(Secret + last_block)
            md5_hash = hashlib.md5(secret_bytes + last_block).digest()
            
            # XOR with password block
            block = bytes(a ^ b for a, b in zip(password_bytes[i:i+16], md5_hash))
            result += block
            last_block = block
        
        return result
    
    def encode(self, secret: str = None) -> bytes:
        """Encode packet to bytes"""
        # Encode attributes
        attr_data = b''
        for attr_type, value in self.attributes:
            attr_len = len(value) + 2
            attr_data += struct.pack('BB', attr_type, attr_len) + value
        
        # Calculate length
        length = 20 + len(attr_data)
        
        # Build packet
        packet = struct.pack(
            '>BBH16s',
            self.code,
            self.identifier,
            length,
            self.authenticator
        ) + attr_data
        
        return packet
    
    @classmethod
    def decode(cls, data: bytes, secret: str) -> 'RadiusPacket':
        """Decode packet from bytes"""
        if len(data) < 20:
            raise ValueError("Packet too short")
        
        code, identifier, length = struct.unpack('>BBH', data[:4])
        authenticator = data[4:20]
        
        packet = cls(code, identifier, authenticator)
        
        # Parse attributes
        pos = 20
        while pos < len(data):
            attr_type, attr_len = struct.unpack('BB', data[pos:pos+2])
            value = data[pos+2:pos+attr_len]
            packet.attributes.append((attr_type, value))
            pos += attr_len
        
        return packet
    
    def get_attribute(self, attr_type: int) -> Optional[bytes]:
        """Get first attribute of given type"""
        for t, v in self.attributes:
            if t == attr_type:
                return v
        return None
    
    def get_all_attributes(self, attr_type: int) -> list:
        """Get all attributes of given type"""
        return [v for t, v in self.attributes if t == attr_type]


# ═══════════════════════════════════════════════════════════════════════════════
# RADIUS AUTHENTICATION SERVICE
# ═══════════════════════════════════════════════════════════════════════════════

class RadiusAuthService:
    """RADIUS authentication service"""
    
    def __init__(self, config: RadiusConfig):
        self.config = config
        self.role_mapping = get_custom_role_mapping()
        self._identifier = 0
    
    def _next_identifier(self) -> int:
        """Get next packet identifier"""
        self._identifier = (self._identifier + 1) % 256
        return self._identifier
    
    def _get_local_ip(self) -> str:
        """Get local IP address for NAS-IP-Address"""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect((self.config.server, self.config.port))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"
    
    def _send_request(
        self, 
        server: str, 
        secret: str, 
        packet: RadiusPacket
    ) -> Optional[RadiusPacket]:
        """Send RADIUS request and receive response"""
        try:
            # Resolve hostname
            server_ip = socket.gethostbyname(server)
            
            # Create UDP socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(self.config.timeout)
            
            # Send request
            data = packet.encode(secret)
            sock.sendto(data, (server_ip, self.config.port))
            
            # Receive response
            response_data, _ = sock.recvfrom(4096)
            sock.close()
            
            # Decode response
            return RadiusPacket.decode(response_data, secret)
            
        except socket.timeout:
            logger.warning(f"RADIUS timeout connecting to {server}")
            return None
        except socket.gaierror as e:
            logger.error(f"RADIUS DNS error for {server}: {e}")
            return None
        except Exception as e:
            logger.error(f"RADIUS error: {e}")
            return None
    
    def authenticate(self, username: str, password: str) -> Optional[RadiusUser]:
        """
        Authenticate user against RADIUS server.
        
        Args:
            username: Username (sAMAccountName or UPN)
            password: User's password
            
        Returns:
            RadiusUser if authentication successful, None otherwise
        """
        # Build Access-Request packet
        packet = RadiusPacket(
            code=RadiusCode.ACCESS_REQUEST,
            identifier=self._next_identifier()
        )
        
        # Add attributes
        packet.add_string(RadiusAttribute.USER_NAME, username)
        
        # Encrypt and add password
        encrypted_password = packet.encrypt_password(password, self.config.secret)
        packet.add_attribute(RadiusAttribute.USER_PASSWORD, encrypted_password)
        
        # Add NAS info
        packet.add_ip(RadiusAttribute.NAS_IP_ADDRESS, self._get_local_ip())
        packet.add_string(RadiusAttribute.NAS_IDENTIFIER, self.config.nas_identifier)
        packet.add_integer(RadiusAttribute.NAS_PORT_TYPE, 15)  # Ethernet
        packet.add_integer(RadiusAttribute.SERVICE_TYPE, 1)   # Login
        
        # Try primary server
        response = self._send_request(
            self.config.server, 
            self.config.secret, 
            packet
        )
        
        # Try backup server if primary fails
        if response is None and self.config.backup_server:
            logger.info(f"Primary RADIUS failed, trying backup: {self.config.backup_server}")
            backup_secret = self.config.backup_secret or self.config.secret
            response = self._send_request(
                self.config.backup_server,
                backup_secret,
                packet
            )
        
        if response is None:
            logger.error("No response from RADIUS servers")
            return None
        
        # Check response code
        if response.code == RadiusCode.ACCESS_ACCEPT:
            logger.info(f"RADIUS authentication successful for: {username}")
            return self._parse_user_response(username, response)
        
        elif response.code == RadiusCode.ACCESS_REJECT:
            logger.warning(f"RADIUS authentication rejected for: {username}")
            return None
        
        elif response.code == RadiusCode.ACCESS_CHALLENGE:
            logger.warning(f"RADIUS challenge received (MFA not supported yet)")
            return None
        
        else:
            logger.error(f"Unexpected RADIUS response code: {response.code}")
            return None
    
    def _parse_user_response(
        self, 
        username: str, 
        response: RadiusPacket
    ) -> RadiusUser:
        """Parse RADIUS response to extract user info and role"""
        user = RadiusUser(username=username)
        
        # Extract Filter-Id attributes (often used for role/group info)
        filter_ids = response.get_all_attributes(RadiusAttribute.FILTER_ID)
        for filter_id in filter_ids:
            try:
                value = filter_id.decode('utf-8').strip()
                user.groups.append(value)
                user.attributes['filter_id'] = user.attributes.get('filter_id', [])
                user.attributes['filter_id'].append(value)
                
                # Check role mapping
                if value in self.role_mapping:
                    mapped_role = self.role_mapping[value]
                    # Keep highest privilege role
                    if mapped_role == UserRole.ADMIN:
                        user.role = UserRole.ADMIN
                    elif mapped_role == UserRole.OPERATOR and user.role != UserRole.ADMIN:
                        user.role = UserRole.OPERATOR
            except Exception:
                pass
        
        # Extract Class attribute
        class_attrs = response.get_all_attributes(RadiusAttribute.CLASS)
        for class_attr in class_attrs:
            try:
                value = class_attr.decode('utf-8').strip()
                user.attributes['class'] = user.attributes.get('class', [])
                user.attributes['class'].append(value)
                
                # Some NPS configs put role info in Class
                if value in self.role_mapping:
                    mapped_role = self.role_mapping[value]
                    if mapped_role == UserRole.ADMIN:
                        user.role = UserRole.ADMIN
                    elif mapped_role == UserRole.OPERATOR and user.role != UserRole.ADMIN:
                        user.role = UserRole.OPERATOR
            except Exception:
                pass
        
        logger.info(f"User {username} authenticated with role: {user.role.value}")
        return user
    
    def test_connection(self) -> Tuple[bool, str]:
        """
        Test RADIUS server connectivity.
        
        Note: This uses a dummy auth request which will be rejected,
        but confirms server is reachable and responding.
        
        Returns:
            Tuple of (success, message)
        """
        try:
            # Build a simple test packet
            packet = RadiusPacket(
                code=RadiusCode.ACCESS_REQUEST,
                identifier=self._next_identifier()
            )
            packet.add_string(RadiusAttribute.USER_NAME, "__connection_test__")
            encrypted = packet.encrypt_password("test", self.config.secret)
            packet.add_attribute(RadiusAttribute.USER_PASSWORD, encrypted)
            packet.add_ip(RadiusAttribute.NAS_IP_ADDRESS, self._get_local_ip())
            
            response = self._send_request(
                self.config.server,
                self.config.secret,
                packet
            )
            
            if response is not None:
                # Any response means server is alive
                return True, f"RADIUS server {self.config.server}:{self.config.port} is responding"
            
            # Try backup
            if self.config.backup_server:
                backup_secret = self.config.backup_secret or self.config.secret
                response = self._send_request(
                    self.config.backup_server,
                    backup_secret,
                    packet
                )
                if response is not None:
                    return True, f"Backup RADIUS server {self.config.backup_server} is responding"
            
            return False, "No response from RADIUS servers (timeout)"
            
        except Exception as e:
            return False, f"RADIUS connection test failed: {str(e)}"


# ═══════════════════════════════════════════════════════════════════════════════
# MODULE-LEVEL FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

_radius_service: Optional[RadiusAuthService] = None

def get_radius_service() -> Optional[RadiusAuthService]:
    """Get or create RADIUS service singleton"""
    global _radius_service
    
    if _radius_service is None:
        config = RadiusConfig.from_env()
        if config:
            _radius_service = RadiusAuthService(config)
            logger.info(f"RADIUS service initialized: {config.server}:{config.port}")
    
    return _radius_service


def is_radius_enabled() -> bool:
    """Check if RADIUS authentication is configured"""
    return os.getenv("RADIUS_SERVER") is not None and os.getenv("RADIUS_SECRET") is not None
