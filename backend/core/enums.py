# core/enums.py
"""
Enumeration types for CMT.
Replaces magic strings with type-safe enums.
"""
from enum import Enum


class DeploymentMode(str, Enum):
    """Certificate deployment mode."""
    PFX = "pfx"
    PEM = "pem"


class DeploymentStatus(str, Enum):
    """Status of a deployment operation."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class CertificateStatus(str, Enum):
    """Certificate health status."""
    VALID = "valid"
    EXPIRING_SOON = "expiring_soon"  # < 30 days
    EXPIRED = "expired"
    UNKNOWN = "unknown"


class ScanStatus(str, Enum):
    """F5 scan operation status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class CacheStatus(str, Enum):
    """Cache build status."""
    IDLE = "idle"
    BUILDING = "building"
    READY = "ready"
    ERROR = "error"


class ProfileType(str, Enum):
    """SSL profile types on F5."""
    CLIENT_SSL = "client-ssl"
    SERVER_SSL = "server-ssl"


class Partition(str, Enum):
    """Common F5 partition names."""
    COMMON = "Common"
    
    @classmethod
    def from_string(cls, value: str) -> "Partition":
        """Convert string to Partition, defaulting to Common."""
        try:
            return cls(value)
        except ValueError:
            # Return as-is for custom partitions
            return value  # type: ignore


# For backwards compatibility, expose string values
DEPLOYMENT_MODE_PFX = DeploymentMode.PFX.value
DEPLOYMENT_MODE_PEM = DeploymentMode.PEM.value
