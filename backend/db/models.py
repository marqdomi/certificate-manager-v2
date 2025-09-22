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

    __table_args__ = (UniqueConstraint('device_id', 'name', name='uq_cert_device_name'),)

    # --- RELACIÓN (2/2) ---
    # Esta es la contraparte que faltaba.
    # Un certificado pertenece a un solo dispositivo.
    device = relationship("Device", back_populates="certificates")

    def __repr__(self):
        return f"<Certificate(id={self.id}, name='{self.name}')>"

# -------------------------------------------------------------------
# MODELO RenewalRequest (Casi sin cambios)
# -------------------------------------------------------------------
class RenewalStatus(enum.Enum):
    CSR_GENERATED = "CSR_GENERATED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class RenewalRequest(Base):
    __tablename__ = "renewal_requests"

    id = Column(Integer, primary_key=True, index=True)
    original_certificate_id = Column(Integer, ForeignKey("certificates.id"), nullable=False, index=True)
    status = Column(Enum(RenewalStatus), nullable=False, default=RenewalStatus.CSR_GENERATED)
    csr_content = Column(Text, nullable=False)
    encrypted_private_key = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # La relación con Certificate está bien, no necesita cambios.
    original_certificate = relationship("Certificate")

    def __repr__(self):
        return f"<RenewalRequest(id={self.id}, status='{self.status.name}')>"
    
class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"          # Full system access
    ADMIN = "admin"                      # User & system management
    CERTIFICATE_MANAGER = "cert_manager" # Full certificate operations
    F5_OPERATOR = "f5_operator"         # F5 device operations
    AUDITOR = "auditor"                 # Read-only + audit access
    OPERATOR = "operator"               # Limited operations
    VIEWER = "viewer"                   # Read-only access

class AuthType(str, enum.Enum):
    LOCAL = "local"                     # Local database authentication
    LDAP = "ldap"                      # LDAP/Active Directory
    AZURE_AD = "azure_ad"              # Azure AD OAuth2/OpenID Connect
    SAML = "saml"                      # SAML SSO (future)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    
    # Authentication fields
    hashed_password = Column(String, nullable=True)  # Nullable for AD users
    auth_type = Column(String, nullable=False, default="local")
    
    # User profile information
    email = Column(String, unique=True, index=True, nullable=True)
    full_name = Column(String, nullable=True)
    department = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    
    # Authorization and permissions
    role = Column(String, nullable=False, default="VIEWER")
    permissions = Column(Text, nullable=True)  # JSON string for granular permissions
    
    # AD/LDAP specific fields
    domain = Column(String, nullable=True)  # AD domain (e.g., 'contoso.com')
    distinguished_name = Column(String, nullable=True)  # LDAP DN
    ad_groups = Column(Text, nullable=True)  # JSON array of AD group memberships
    object_guid = Column(String, nullable=True)  # AD ObjectGUID for sync
    
    # Session and activity tracking
    last_login = Column(DateTime, nullable=True)
    last_login_ip = Column(String, nullable=True)
    login_count = Column(Integer, default=0)
    failed_login_attempts = Column(Integer, default=0)
    last_failed_login = Column(DateTime, nullable=True)
    
    # Account management
    is_active = Column(Boolean, default=True)
    is_locked = Column(Boolean, default=False)
    password_expires_at = Column(DateTime, nullable=True)
    must_change_password = Column(Boolean, default=False)
    
    # Audit trail
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(String, nullable=True)  # Username who created this user
    last_modified_by = Column(String, nullable=True)
    
    # Sync information (for AD users)
    last_ad_sync = Column(DateTime, nullable=True)
    ad_sync_status = Column(String, nullable=True)  # 'synced', 'error', 'pending'
    
    def __repr__(self):
        return f"<User(username='{self.username}', role='{self.role.value}', auth_type='{self.auth_type.value}')>"
    
    @property
    def is_ad_user(self):
        """Check if user authenticates via AD/LDAP"""
        return self.auth_type in [AuthType.LDAP, AuthType.AZURE_AD]
    
    @property
    def display_name(self):
        """Get display name (full_name or username)"""
        return self.full_name or self.username
    
    @property
    def is_emergency_admin(self):
        """Check if this is an emergency admin account"""
        return (self.auth_type == AuthType.LOCAL and 
                self.role == UserRole.SUPER_ADMIN and 
                self.username.startswith('admin'))

# User session tracking table
class UserSession(Base):
    __tablename__ = "user_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_token = Column(String, unique=True, index=True, nullable=False)
    ip_address = Column(String, nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_activity = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)
    
    # Relationship
    user = relationship("User", backref="sessions")

# User activity audit log
class UserActivity(Base):
    __tablename__ = "user_activities"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    username = Column(String, nullable=False)  # Store username even if user is deleted
    action = Column(String, nullable=False)  # 'login', 'logout', 'create_cert', 'deploy', etc.
    resource_type = Column(String, nullable=True)  # 'certificate', 'device', 'user', etc.
    resource_id = Column(String, nullable=True)  # ID of the affected resource
    description = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(Text, nullable=True)
    result = Column(String, nullable=False)  # 'success', 'failure', 'error'
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationship
    user = relationship("User", backref="activities")

# System configuration table
class SystemConfig(Base):
    __tablename__ = "system_config"
    
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, nullable=False, index=True)  # 'ldap', 'azure_ad', 'email', etc.
    key = Column(String, nullable=False)
    value = Column(Text, nullable=True)
    encrypted = Column(Boolean, default=False)  # Whether value is encrypted
    description = Column(Text, nullable=True)
    updated_by = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint("category", "key", name="uq_config_category_key"),
    )
    
# --- NUEVAS TABLAS DE CACHÉ (añadir al final de models.py) ---
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