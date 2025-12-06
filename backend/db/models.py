# backend/db/models.py

import enum
from datetime import datetime
from sqlalchemy import (
    Column, 
    Integer, 
    String, 
    DateTime, 
    Text, 
    Enum, 
    ForeignKey,
    Boolean,
    UniqueConstraint
)
from sqlalchemy.orm import relationship
from .base import Base 


# -------------------------------------------------------------------
# ENUMS
# -------------------------------------------------------------------
class CertificateRenewalStatus(str, enum.Enum):
    """Status of a certificate in the renewal lifecycle."""
    NONE = "none"                   # No renewal in progress
    EXPIRING = "expiring"           # Detected as expiring soon
    CSR_CREATED = "csr_created"     # CSR has been generated
    PENDING_CA = "pending_ca"       # Submitted to CA, awaiting signature
    CERT_READY = "cert_ready"       # Certificate received from CA
    DEPLOYED = "deployed"           # Deployed to F5
    VERIFIED = "verified"           # Verified working in production
    FAILED = "failed"               # Renewal failed at some stage


# -------------------------------------------------------------------
# MODELO Device (Ahora es el "padre")
# -------------------------------------------------------------------
class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    hostname = Column(String, unique=True, index=True, nullable=False)
    ip_address = Column(String, unique=True, nullable=False)
    site = Column(String, nullable=True)
    version = Column(String, nullable=True)
    platform = Column(String, nullable=True)                  # e.g. BIG-IP, TMOS
    serial_number = Column(String, nullable=True)             # device serial
    ha_state = Column(String, nullable=True)                  # active | standby | offline | unknown
    cluster_key = Column(String, nullable=True, index=True)   # e.g., cluster discriminator (site+pair)
    is_primary_preferred = Column(Boolean, nullable=False, default=False)  # scan/ops target flag
    sync_status = Column(String, nullable=True)               # In Sync | Changes Pending | Unknown
    last_sync_color = Column(String, nullable=True)           # green | yellow | red | unknown (UI hint)
    dns_servers = Column(Text, nullable=True)                 # JSON string or comma-separated
    last_facts_refresh = Column(DateTime, nullable=True)      # when facts were last pulled
    active = Column(Boolean, nullable=False, default=True)    # whether to include in scheduled scans
    username = Column(String, nullable=False, default="admin")
    encrypted_password = Column(Text, nullable=True)
    last_scan_status = Column(String, default="pending")
    last_scan_message = Column(Text, nullable=True)
    last_scan_timestamp = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # --- RELACIÓN (1/2) ---
    # Un dispositivo puede tener muchos certificados.
    # 'back_populates' le dice a SQLAlchemy cómo conectar con la otra tabla.
    # 'cascade' asegura que si borras un dispositivo, todos sus certificados se borren también.
    certificates = relationship("Certificate", back_populates="device", cascade="all, delete, delete-orphan", passive_deletes=True)

    def __repr__(self):
        return f"<Device(hostname='{self.hostname}')>"

# -------------------------------------------------------------------
# MODELO Certificate (Ahora es el "hijo")
# -------------------------------------------------------------------
class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    common_name = Column(String, index=True, nullable=True)
    issuer = Column(String, nullable=True)
    expiration_date = Column(DateTime, index=True, nullable=True)
    
    # --- CAMBIO IMPORTANTE EN LA RELACIÓN ---
    # 1. Ya no usamos el hostname para la relación.
    f5_device_hostname = Column(String, index=True, nullable=False) 
    # 2. Creamos una ForeignKey numérica que apunta al ID de la tabla 'devices'.
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    
    partition = Column(String, default="Common")
    last_scanned = Column(DateTime, default=datetime.utcnow, nullable=True)
    
    # --- RENEWAL TRACKING (v2.5) ---
    renewal_status = Column(
        Enum(CertificateRenewalStatus), 
        nullable=False, 
        default=CertificateRenewalStatus.NONE,
        index=True
    )
    renewal_request_id = Column(Integer, ForeignKey("renewal_requests.id", ondelete="SET NULL"), nullable=True)
    renewal_started_at = Column(DateTime, nullable=True)
    renewal_notes = Column(Text, nullable=True)  # Free-form notes about renewal progress

    __table_args__ = (UniqueConstraint('device_id', 'name', name='uq_cert_device_name'),)

    # --- RELACIÓN (2/2) ---
    # Esta es la contraparte que faltaba.
    # Un certificado pertenece a un solo dispositivo.
    device = relationship("Device", back_populates="certificates")

    def __repr__(self):
        return f"<Certificate(id={self.id}, name='{self.name}')>"

# -------------------------------------------------------------------
# MODELO RenewalRequest - Enhanced for CSR Generator (v2.5)
# -------------------------------------------------------------------
class RenewalStatus(enum.Enum):
    CSR_GENERATED = "CSR_GENERATED"      # CSR created, awaiting CA signature
    CERT_RECEIVED = "CERT_RECEIVED"      # Certificate received from CA
    PFX_READY = "PFX_READY"              # PFX assembled, ready for deployment
    DEPLOYED = "DEPLOYED"                 # Deployed to F5
    COMPLETED = "COMPLETED"               # Cleanup done, old cert removed
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"                   # CSR expired without completion

class RenewalRequest(Base):
    __tablename__ = "renewal_requests"

    id = Column(Integer, primary_key=True, index=True)
    
    # Link to existing certificate (nullable for new certs)
    original_certificate_id = Column(Integer, ForeignKey("certificates.id"), nullable=True, index=True)
    
    # CSR details
    common_name = Column(String, nullable=False, index=True)
    san_names = Column(Text, nullable=True)  # JSON array of SAN entries
    key_size = Column(Integer, default=2048)
    
    # Status tracking
    status = Column(Enum(RenewalStatus), nullable=False, default=RenewalStatus.CSR_GENERATED)
    
    # CSR and Key storage
    csr_content = Column(Text, nullable=False)
    encrypted_private_key = Column(Text, nullable=False)
    
    # Signed certificate (when received from CA)
    signed_certificate_pem = Column(Text, nullable=True)
    certificate_chain_pem = Column(Text, nullable=True)
    
    # PFX file (when assembled)
    pfx_filename = Column(String, nullable=True)
    
    # Certificate details (extracted from signed cert)
    cert_expiration_date = Column(DateTime, nullable=True)
    cert_issuer = Column(String, nullable=True)
    
    # Audit info
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship with Certificate
    original_certificate = relationship(
        "Certificate", 
        foreign_keys=[original_certificate_id],
        backref="renewal_requests"
    )

    def __repr__(self):
        return f"<RenewalRequest(id={self.id}, cn='{self.common_name}', status='{self.status.name}')>"
    
class UserRole(str, enum.Enum):
    ADMIN = "admin"
    OPERATOR = "operator"
    VIEWER = "viewer"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)   # <-- antes tenía un typo en "index"
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.VIEWER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<User(username='{self.username}', role='{self.role.value}')>"


# -------------------------------------------------------------------
# AUDIT LOG - v2.5 (December 2025)
# -------------------------------------------------------------------
class AuditAction(str, enum.Enum):
    """Types of auditable actions."""
    # Certificate operations
    CERT_DEPLOYED = "cert_deployed"
    CERT_RENEWED = "cert_renewed"
    CERT_DELETED = "cert_deleted"
    CERT_UPLOADED = "cert_uploaded"
    
    # CSR operations
    CSR_GENERATED = "csr_generated"
    CSR_COMPLETED = "csr_completed"
    CSR_DELETED = "csr_deleted"
    
    # Device operations
    DEVICE_ADDED = "device_added"
    DEVICE_MODIFIED = "device_modified"
    DEVICE_DELETED = "device_deleted"
    DEVICE_SCANNED = "device_scanned"
    
    # SSL Profile operations
    PROFILE_CREATED = "profile_created"
    PROFILE_MODIFIED = "profile_modified"
    PROFILE_DELETED = "profile_deleted"
    
    # User operations
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    USER_CREATED = "user_created"
    USER_MODIFIED = "user_modified"


class AuditResult(str, enum.Enum):
    """Result of an audited operation."""
    SUCCESS = "success"
    FAILURE = "failure"
    PARTIAL = "partial"  # Some operations succeeded, some failed


class AuditLog(Base):
    """
    Audit log for tracking all significant operations in CMT.
    Provides compliance-ready traceability for certificate management.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    
    # When
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Who
    username = Column(String, nullable=True, index=True)  # Null for system operations
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # What
    action = Column(Enum(AuditAction), nullable=False, index=True)
    result = Column(Enum(AuditResult), nullable=False, default=AuditResult.SUCCESS)
    
    # On what
    resource_type = Column(String, nullable=False)  # 'certificate', 'device', 'profile', etc.
    resource_id = Column(Integer, nullable=True)     # ID of the affected resource
    resource_name = Column(String, nullable=True)    # Human-readable name
    
    # Where (for F5 operations)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    device_hostname = Column(String, nullable=True)  # Denormalized for queries
    
    # Details
    description = Column(Text, nullable=True)        # Human-readable description
    details = Column(Text, nullable=True)            # JSON with additional details
    error_message = Column(Text, nullable=True)      # Error details if failed
    
    # Request context
    ip_address = Column(String, nullable=True)       # Client IP
    user_agent = Column(String, nullable=True)       # Client user agent
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    device = relationship("Device", foreign_keys=[device_id])

    def __repr__(self):
        return f"<AuditLog(id={self.id}, action='{self.action.value}', user='{self.username}')>"
    

# ═══════════════════════════════════════════════════════════════════════════════
# ⚠️ DEPRECATED CACHE TABLES - v2.5 (December 2025)
# ═══════════════════════════════════════════════════════════════════════════════
# These tables were used for the cache-based usage detection system.
# As of v2.5, real-time F5 queries replace this system:
# - POST /certificates/batch-usage
# - services/f5_service_logic.get_batch_usage_state()
#
# Tables are kept for backwards compatibility with existing endpoints
# (e.g., /f5/cache/impact-preview). Scheduled for removal in v3.0.
# ═══════════════════════════════════════════════════════════════════════════════

class SslProfilesCache(Base):
    __tablename__ = "ssl_profiles_cache"

    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    profile_name = Column(String, nullable=False)     # solo el nombre (sin /Partition/)
    partition = Column(String, nullable=False, default="Common")
    context = Column(String, nullable=True)           # clientside/serverside/—
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("device_id", "partition", "profile_name", name="uq_profiles_device_partition_name"),
    )

# ⚠️ DEPRECATED: VIP cache not needed with direct SSL profile queries
class SslProfileVipsCache(Base):
    __tablename__ = "ssl_profile_vips_cache"

    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    profile_full_path = Column(String, nullable=False, index=True)  # ej. /Common/clientssl
    vip_name = Column(String, nullable=False)                        # vs name
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    vip_full_path = Column(Text, nullable=True)
    partition     = Column(Text, nullable=True)
    destination   = Column(Text, nullable=True)
    service_port  = Column(Integer, nullable=True)
    enabled       = Column(Boolean, nullable=True)
    status        = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("device_id", "profile_full_path", "vip_name", name="uq_profile_vip_per_device"),
    )

# ⚠️ DEPRECATED: Certificate-profile links now obtained directly from F5
class CertProfileLinksCache(Base):
    __tablename__ = "cert_profile_links_cache"

    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    cert_name = Column(String, nullable=False, index=True)
    profile_full_path = Column(String, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("device_id", "cert_name", "profile_full_path", name="uq_cert_profile_per_device"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# NETWORK DISCOVERY MODELS - v2.5 (December 2025)
# ═══════════════════════════════════════════════════════════════════════════════

class DiscoveryJobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class DiscoveryJob(Base):
    """Represents a network discovery scan job."""
    __tablename__ = "discovery_jobs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)  # Optional friendly name
    status = Column(Enum(DiscoveryJobStatus), nullable=False, default=DiscoveryJobStatus.PENDING)
    
    # Scan configuration
    subnets = Column(Text, nullable=False)  # JSON array of subnets/ranges
    credential_set = Column(String, nullable=True)  # Which credential set to use
    
    # Progress tracking
    total_ips = Column(Integer, default=0)
    scanned_ips = Column(Integer, default=0)
    found_devices = Column(Integer, default=0)
    
    # Results
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_by = Column(String, nullable=True)  # Username who started the job

    # Relationship with discovered devices
    discovered_devices = relationship(
        "DiscoveredDevice", 
        back_populates="job", 
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<DiscoveryJob(id={self.id}, status='{self.status.value}')>"


class DiscoveredDeviceStatus(str, enum.Enum):
    PENDING = "pending"       # Not yet processed
    IMPORTED = "imported"     # Added to inventory
    SKIPPED = "skipped"       # Manually skipped by user
    DUPLICATE = "duplicate"   # Already exists in inventory
    FAILED = "failed"         # Failed to validate/probe


class DiscoveredDevice(Base):
    """Represents a device found during network discovery (staging table)."""
    __tablename__ = "discovered_devices"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("discovery_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Device info discovered
    ip_address = Column(String, nullable=False)
    hostname = Column(String, nullable=True)  # May be null if probe failed
    version = Column(String, nullable=True)
    platform = Column(String, nullable=True)
    serial_number = Column(String, nullable=True)
    ha_state = Column(String, nullable=True)
    
    # Discovery metadata
    status = Column(Enum(DiscoveredDeviceStatus), nullable=False, default=DiscoveredDeviceStatus.PENDING)
    probe_success = Column(Boolean, default=False)
    probe_message = Column(Text, nullable=True)  # Error or info message
    credential_source = Column(String, nullable=True)  # Which credential worked
    
    # Derived info
    suggested_site = Column(String, nullable=True)  # Derived from IP range
    suggested_cluster_key = Column(String, nullable=True)  # Derived from hostname pattern
    
    # If imported, link to the device
    imported_device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    
    # Timestamps
    discovered_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    job = relationship("DiscoveryJob", back_populates="discovered_devices")

    def __repr__(self):
        return f"<DiscoveredDevice(ip='{self.ip_address}', hostname='{self.hostname}')>"