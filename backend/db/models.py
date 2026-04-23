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
    # F5 Device Information
    ha_state = Column(String, nullable=True)                  # active | standby | offline | unknown
    cluster_key = Column(String, nullable=True, index=True)   # e.g., cluster discriminator (site+pair)
    is_primary_preferred = Column(Boolean, nullable=False, default=False)  # scan/ops target flag
    sync_status = Column(String, nullable=True)               # In Sync | Changes Pending | Unknown
    last_sync_color = Column(String, nullable=True)           # green | yellow | red | unknown (UI hint)
    dns_servers = Column(Text, nullable=True)                 # JSON string or comma-separated
    last_facts_refresh = Column(DateTime, nullable=True)      # when facts were last pulled
    
    # Enhanced Cluster Discovery Fields (from F5 API)
    trust_domain = Column(String, nullable=True, index=True)  # F5 trust domain
    local_device_name = Column(String, nullable=True)         # Device name as reported by F5
    peer_device_ids = Column(Text, nullable=True)             # JSON array of peer device IDs in cluster
    sync_group = Column(String, nullable=True)                # F5 sync group information  
    device_trust_state = Column(String, nullable=True)        # F5 device trust state
    last_cluster_discovery = Column(DateTime, nullable=True)   # Last time cluster info was discovered
    cluster_discovery_source = Column(String, nullable=True, index=True)  # heuristic|f5_api
    
    # Unified Discovery and Monitoring Fields  
    last_unified_discovery = Column(DateTime, nullable=True, index=True)   # Last complete discovery operation
    last_health_check = Column(DateTime, nullable=True, index=True)        # Last health monitoring check
    last_facts_scan = Column(DateTime, nullable=True, index=True)          # Last facts scanning operation
    
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
    LOCAL = "LOCAL"                     # Local database authentication
    LDAP = "LDAP"                      # LDAP/Active Directory
    AZURE_AD = "AZURE_AD"              # Azure AD OAuth2/OpenID Connect
    SAML = "SAML"                      # SAML SSO (future)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    
    # Authentication fields - Local only
    hashed_password = Column(String, nullable=False)  # Required for local users
    auth_type = Column(String, nullable=False, default="local")
    
    # User profile information
    email = Column(String, unique=True, index=True, nullable=True)
    full_name = Column(String, nullable=True)
    department = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    
    # Authorization and permissions
    role = Column(String, nullable=False, default="VIEWER")
    permissions = Column(Text, nullable=True)  # JSON string for granular permissions
    
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
    
    def __repr__(self):
        return f"<User(username='{self.username}', role='{self.role}', auth_type='{self.auth_type}')>"
    
    @property
    def is_ad_user(self):
        """Local users only - always returns False"""
        return False
    
    @property
    def display_name(self):
        """Get display name (full_name or username)"""
        return self.full_name or self.username
    
    @property
    def is_admin(self):
        """Check if this is an admin account"""
        return self.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]

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


# -------------------------------------------------------------------
# DigiCert automated renewal (paralelo al flujo manual de RenewalRequest)
# -------------------------------------------------------------------
class DigicertOrderStatus(str, enum.Enum):
    PENDING_SUBMIT = "PENDING_SUBMIT"
    SUBMITTED = "SUBMITTED"
    NEEDS_APPROVAL = "NEEDS_APPROVAL"
    APPROVAL_REJECTED = "APPROVAL_REJECTED"
    PENDING_DCV = "PENDING_DCV"
    PENDING_VALIDATION = "PENDING_VALIDATION"
    ISSUED = "ISSUED"
    DOWNLOADED = "DOWNLOADED"
    DEPLOYING = "DEPLOYING"
    PARTIAL_DEPLOY = "PARTIAL_DEPLOY"
    DEPLOYED = "DEPLOYED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    TIMEOUT_APPROVAL = "TIMEOUT_APPROVAL"


# Estados en los que una orden se considera "activa" (evita crear otra paralela para el mismo cert)
DIGICERT_ACTIVE_STATUSES = {
    DigicertOrderStatus.PENDING_SUBMIT.value,
    DigicertOrderStatus.SUBMITTED.value,
    DigicertOrderStatus.NEEDS_APPROVAL.value,
    DigicertOrderStatus.PENDING_DCV.value,
    DigicertOrderStatus.PENDING_VALIDATION.value,
    DigicertOrderStatus.ISSUED.value,
    DigicertOrderStatus.DOWNLOADED.value,
    DigicertOrderStatus.DEPLOYING.value,
    DigicertOrderStatus.PARTIAL_DEPLOY.value,
}


class DigicertRenewalOrder(Base):
    __tablename__ = "digicert_renewal_orders"

    id = Column(Integer, primary_key=True, index=True)
    certificate_id = Column(Integer, ForeignKey("certificates.id", ondelete="CASCADE"), nullable=False, index=True)

    status = Column(String, nullable=False, default=DigicertOrderStatus.PENDING_SUBMIT.value, index=True)

    # DigiCert references
    digicert_order_id = Column(String, nullable=True, index=True)
    digicert_certificate_id = Column(String, nullable=True, index=True)

    # Crypto / CSR
    csr_pem = Column(Text, nullable=True)
    encrypted_private_key = Column(Text, nullable=True)  # nullable tras purga (paso 30)
    private_key_purged_at = Column(DateTime, nullable=True)
    key_size = Column(Integer, nullable=False, default=2048)

    # Certificate metadata
    common_name = Column(String, nullable=False, index=True)
    san_list = Column(Text, nullable=True)  # JSON array
    validity_years = Column(Integer, nullable=False, default=1)
    product = Column(String, nullable=True)
    container_id = Column(String, nullable=True)
    organization_id = Column(String, nullable=True)

    # Delivered certificate (post-issue)
    signed_cert_pem = Column(Text, nullable=True)
    chain_pem = Column(Text, nullable=True)
    serial_number = Column(String, nullable=True, index=True)
    thumbprint = Column(String, nullable=True, index=True)
    valid_from = Column(DateTime, nullable=True)
    valid_till = Column(DateTime, nullable=True)

    # Approval tracking
    approval_required = Column(Boolean, nullable=False, default=False)
    approval_detected_at = Column(DateTime, nullable=True)
    last_approval_reminder_at = Column(DateTime, nullable=True)

    # DCV tracking
    dcv_method = Column(String, nullable=True)  # dns-cname | dns-txt | email | http | reused
    dcv_tokens = Column(Text, nullable=True)    # JSON por SAN
    dcv_completed_at = Column(DateTime, nullable=True)

    # Deployment tracking
    deploy_results = Column(Text, nullable=True)  # JSON: {"device_id": {"status": "...", "error": "..."}}
    deployed_at = Column(DateTime, nullable=True)

    # Error handling & idempotency
    error_message = Column(Text, nullable=True)
    idempotency_key = Column(String, nullable=True, index=True)
    submit_attempts = Column(Integer, nullable=False, default=0)

    # Audit
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(String, nullable=True)

    # Relationship
    certificate = relationship("Certificate", foreign_keys=[certificate_id])

    __table_args__ = (
        UniqueConstraint("certificate_id", "idempotency_key", name="uq_digicert_cert_idempotency"),
    )

    def __repr__(self):
        return f"<DigicertRenewalOrder(id={self.id}, cn='{self.common_name}', status='{self.status}')>"


class DigicertRenewalAuditLog(Base):
    __tablename__ = "digicert_renewal_audit_log"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("digicert_renewal_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String, nullable=False, index=True)
    # INITIATED | SUBMITTED | APPROVAL_REQUIRED | APPROVED | APPROVAL_REJECTED |
    # DCV_GENERATED | DCV_COMPLETED | ISSUED | DOWNLOAD_COMPLETED |
    # DEPLOY_STARTED | DEPLOY_DEVICE_SUCCESS | DEPLOY_DEVICE_FAILED | DEPLOY_COMPLETED |
    # CANCELLED | REVOKED | REISSUED | KEY_PURGED | ERROR
    username = Column(String, nullable=True)  # nullable para eventos de sistema/celery
    event_metadata = Column(Text, nullable=True)  # JSON
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    order = relationship("DigicertRenewalOrder", backref="audit_events")

    def __repr__(self):
        return f"<DigicertRenewalAuditLog(order_id={self.order_id}, event='{self.event_type}')>"


class DigicertInventoryItem(Base):
    """
    Cache local de órdenes y certificados DigiCert (para vista de inventory y matching cert F5 <-> DigiCert).
    Se refresca on-demand vía sync endpoint. Soporta órdenes creadas fuera de CMT dentro del mismo container.
    """
    __tablename__ = "digicert_inventory"

    id = Column(Integer, primary_key=True, index=True)
    digicert_order_id = Column(String, nullable=False, unique=True, index=True)
    digicert_certificate_id = Column(String, nullable=True, index=True)

    common_name = Column(String, nullable=True, index=True)
    sans = Column(Text, nullable=True)  # JSON
    serial_number = Column(String, nullable=True, index=True)
    thumbprint = Column(String, nullable=True, index=True)

    status = Column(String, nullable=True, index=True)
    product = Column(String, nullable=True)
    container_id = Column(String, nullable=True, index=True)
    organization = Column(String, nullable=True)

    valid_from = Column(DateTime, nullable=True)
    valid_till = Column(DateTime, nullable=True, index=True)
    issued_date = Column(DateTime, nullable=True)

    # Matching con cert local F5 (paso 18 del plan)
    local_certificate_id = Column(Integer, ForeignKey("certificates.id", ondelete="SET NULL"), nullable=True, index=True)

    last_synced_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    local_certificate = relationship("Certificate", foreign_keys=[local_certificate_id])

    def __repr__(self):
        return f"<DigicertInventoryItem(order_id='{self.digicert_order_id}', cn='{self.common_name}')>"