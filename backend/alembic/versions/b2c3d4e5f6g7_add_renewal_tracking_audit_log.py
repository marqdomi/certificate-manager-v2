"""Add renewal tracking and audit log

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2025-12-05

This migration adds:
1. Certificate renewal tracking fields (renewal_status, renewal_request_id, etc.)
2. AuditLog table for compliance and traceability
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers
revision = 'b2c3d4e5f6g7'
down_revision = 'a1b2c3d4e5f6'  # After CSR generator migration
branch_labels = None
depends_on = None


# Define enum values
RENEWAL_STATUS_VALUES = ('none', 'expiring', 'csr_created', 'pending_ca', 
                          'cert_ready', 'deployed', 'verified', 'failed')

AUDIT_ACTION_VALUES = (
    'cert_deployed', 'cert_renewed', 'cert_deleted', 'cert_uploaded',
    'csr_generated', 'csr_completed', 'csr_deleted',
    'device_added', 'device_modified', 'device_deleted', 'device_scanned',
    'profile_created', 'profile_modified', 'profile_deleted',
    'user_login', 'user_logout', 'user_created', 'user_modified'
)

AUDIT_RESULT_VALUES = ('success', 'failure', 'partial')


def upgrade() -> None:
    conn = op.get_bind()
    
    # Create certificate_renewal_status enum if not exists
    res = conn.execute(sa.text("SELECT 1 FROM pg_type WHERE typname = 'certificaterenewalstatus'"))
    if not res.fetchone():
        conn.execute(sa.text(
            f"CREATE TYPE certificaterenewalstatus AS ENUM {RENEWAL_STATUS_VALUES}"
        ))
    
    # Create audit_action enum if not exists
    res = conn.execute(sa.text("SELECT 1 FROM pg_type WHERE typname = 'auditaction'"))
    if not res.fetchone():
        conn.execute(sa.text(
            f"CREATE TYPE auditaction AS ENUM {AUDIT_ACTION_VALUES}"
        ))
    
    # Create audit_result enum if not exists
    res = conn.execute(sa.text("SELECT 1 FROM pg_type WHERE typname = 'auditresult'"))
    if not res.fetchone():
        conn.execute(sa.text(
            f"CREATE TYPE auditresult AS ENUM {AUDIT_RESULT_VALUES}"
        ))
    
    # Add renewal tracking columns to certificates table
    # Check if columns exist first to make migration idempotent
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'certificates' AND column_name = 'renewal_status'
    """))
    if not result.fetchone():
        op.add_column('certificates', sa.Column(
            'renewal_status',
            postgresql.ENUM(*RENEWAL_STATUS_VALUES, name='certificaterenewalstatus', create_type=False),
            nullable=False,
            server_default='none'
        ))
    
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'certificates' AND column_name = 'renewal_request_id'
    """))
    if not result.fetchone():
        op.add_column('certificates', sa.Column(
            'renewal_request_id', 
            sa.Integer(), 
            sa.ForeignKey('renewal_requests.id', ondelete='SET NULL'),
            nullable=True
        ))
    
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'certificates' AND column_name = 'renewal_started_at'
    """))
    if not result.fetchone():
        op.add_column('certificates', sa.Column('renewal_started_at', sa.DateTime(), nullable=True))
    
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'certificates' AND column_name = 'renewal_notes'
    """))
    if not result.fetchone():
        op.add_column('certificates', sa.Column('renewal_notes', sa.Text(), nullable=True))
    
    # Add index on renewal_status for filtering
    result = conn.execute(sa.text("""
        SELECT 1 FROM pg_indexes WHERE indexname = 'ix_certificates_renewal_status'
    """))
    if not result.fetchone():
        op.create_index('ix_certificates_renewal_status', 'certificates', ['renewal_status'])
    
    # Check if audit_logs table exists
    result = conn.execute(sa.text("""
        SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs'
    """))
    if not result.fetchone():
        # Create audit_logs table using existing enum types
        op.create_table(
            'audit_logs',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('timestamp', sa.DateTime(), nullable=False),
            sa.Column('username', sa.String(), nullable=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('action', postgresql.ENUM(*AUDIT_ACTION_VALUES, name='auditaction', create_type=False), nullable=False),
            sa.Column('result', postgresql.ENUM(*AUDIT_RESULT_VALUES, name='auditresult', create_type=False), nullable=False, server_default='success'),
            sa.Column('resource_type', sa.String(), nullable=False),
            sa.Column('resource_id', sa.Integer(), nullable=True),
            sa.Column('resource_name', sa.String(), nullable=True),
            sa.Column('device_id', sa.Integer(), sa.ForeignKey('devices.id', ondelete='SET NULL'), nullable=True),
            sa.Column('device_hostname', sa.String(), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('details', sa.Text(), nullable=True),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('ip_address', sa.String(), nullable=True),
            sa.Column('user_agent', sa.String(), nullable=True),
        )
        
        # Create indexes
        op.create_index('ix_audit_logs_id', 'audit_logs', ['id'])
        op.create_index('ix_audit_logs_timestamp', 'audit_logs', ['timestamp'])
        op.create_index('ix_audit_logs_username', 'audit_logs', ['username'])
        op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])
        op.create_index('ix_audit_logs_resource', 'audit_logs', ['resource_type', 'resource_id'])
        op.create_index('ix_audit_logs_device', 'audit_logs', ['device_id'])


def downgrade() -> None:
    conn = op.get_bind()
    
    # Check if audit_logs table exists before dropping
    result = conn.execute(sa.text("""
        SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs'
    """))
    if result.fetchone():
        op.drop_index('ix_audit_logs_device', table_name='audit_logs')
        op.drop_index('ix_audit_logs_resource', table_name='audit_logs')
        op.drop_index('ix_audit_logs_action', table_name='audit_logs')
        op.drop_index('ix_audit_logs_username', table_name='audit_logs')
        op.drop_index('ix_audit_logs_timestamp', table_name='audit_logs')
        op.drop_index('ix_audit_logs_id', table_name='audit_logs')
        op.drop_table('audit_logs')
    
    # Remove renewal tracking columns from certificates
    result = conn.execute(sa.text("""
        SELECT 1 FROM pg_indexes WHERE indexname = 'ix_certificates_renewal_status'
    """))
    if result.fetchone():
        op.drop_index('ix_certificates_renewal_status', table_name='certificates')
    
    for col in ['renewal_notes', 'renewal_started_at', 'renewal_request_id', 'renewal_status']:
        result = conn.execute(sa.text(f"""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'certificates' AND column_name = '{col}'
        """))
        if result.fetchone():
            op.drop_column('certificates', col)
    
    # Drop enum types
    for enum_name in ['auditresult', 'auditaction', 'certificaterenewalstatus']:
        conn.execute(sa.text(f"DROP TYPE IF EXISTS {enum_name}"))
