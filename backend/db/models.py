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