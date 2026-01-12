"""Add certificate master tables

Revision ID: 20260112_cert_master
Revises: g6h7i8j9k0l1
Create Date: 2026-01-12

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '20260112_cert_master'
down_revision = 'g6h7i8j9k0l1'
branch_labels = None
depends_on = None


# Define enums at module level
installation_location_type = postgresql.ENUM(
    'f5', 'local_vm', 'physical_server', 'azure_app_gw', 'azure_front_door',
    'aws_alb', 'aws_cloudfront', 'gcp_lb', 'kubernetes', 'cdn', 'other',
    name='installationlocationtype',
    create_type=False
)

installation_status = postgresql.ENUM(
    'pending', 'installed', 'verified', 'failed', 'not_applicable',
    name='installationstatus',
    create_type=False
)


def upgrade():
    # Create enums first with checkfirst
    conn = op.get_bind()
    
    # Check if enum exists before creating
    result = conn.execute(sa.text("SELECT 1 FROM pg_type WHERE typname = 'installationlocationtype'"))
    if not result.fetchone():
        conn.execute(sa.text(
            "CREATE TYPE installationlocationtype AS ENUM "
            "('f5', 'local_vm', 'physical_server', 'azure_app_gw', 'azure_front_door', "
            "'aws_alb', 'aws_cloudfront', 'gcp_lb', 'kubernetes', 'cdn', 'other')"
        ))
    
    result = conn.execute(sa.text("SELECT 1 FROM pg_type WHERE typname = 'installationstatus'"))
    if not result.fetchone():
        conn.execute(sa.text(
            "CREATE TYPE installationstatus AS ENUM "
            "('pending', 'installed', 'verified', 'failed', 'not_applicable')"
        ))

    # Create certificate_masters table
    op.create_table(
        'certificate_masters',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('common_name', sa.String(500), nullable=False),
        sa.Column('friendly_name', sa.String(200), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('current_expiration', sa.DateTime(), nullable=True),
        sa.Column('current_issuer', sa.String(500), nullable=True),
        sa.Column('current_serial', sa.String(100), nullable=True),
        sa.Column('owner_team', sa.String(100), nullable=True),
        sa.Column('primary_contact', sa.String(200), nullable=True),
        sa.Column('secondary_contact', sa.String(200), nullable=True),
        sa.Column('notification_emails', sa.Text(), nullable=True),
        sa.Column('slack_channel', sa.String(100), nullable=True),
        sa.Column('renewal_lead_days', sa.Integer(), nullable=True, default=30),
        sa.Column('auto_sync_f5', sa.Boolean(), nullable=True, default=True),
        sa.Column('last_renewal_date', sa.DateTime(), nullable=True),
        sa.Column('renewal_notes', sa.Text(), nullable=True),
        sa.Column('environment', sa.String(50), nullable=True),
        sa.Column('application', sa.String(200), nullable=True),
        sa.Column('criticality', sa.String(20), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('documentation_url', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_certificate_masters_id', 'certificate_masters', ['id'])
    op.create_index('ix_certificate_masters_common_name', 'certificate_masters', ['common_name'], unique=True)
    op.create_index('ix_certificate_masters_current_expiration', 'certificate_masters', ['current_expiration'])
    op.create_index('ix_certificate_masters_owner_team', 'certificate_masters', ['owner_team'])
    op.create_index('ix_certificate_masters_environment', 'certificate_masters', ['environment'])
    op.create_index('ix_certificate_masters_application', 'certificate_masters', ['application'])
    op.create_index('ix_certificate_masters_criticality', 'certificate_masters', ['criticality'])
    op.create_index('ix_certificate_masters_is_active', 'certificate_masters', ['is_active'])

    # Create certificate_installations table
    op.create_table(
        'certificate_installations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('master_id', sa.Integer(), nullable=False),
        sa.Column('location_type', installation_location_type, nullable=False),
        sa.Column('location_name', sa.String(200), nullable=False),
        sa.Column('location_identifier', sa.String(500), nullable=True),
        sa.Column('location_details', sa.Text(), nullable=True),
        sa.Column('device_id', sa.Integer(), nullable=True),
        sa.Column('status', installation_status, nullable=False, server_default='pending'),
        sa.Column('installed_expiration', sa.DateTime(), nullable=True),
        sa.Column('installed_serial', sa.String(100), nullable=True),
        sa.Column('installed_at', sa.DateTime(), nullable=True),
        sa.Column('is_current', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('responsible_team', sa.String(100), nullable=False),
        sa.Column('responsible_contact', sa.String(200), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('verified_by', sa.String(100), nullable=True),
        sa.Column('verified_at', sa.DateTime(), nullable=True),
        sa.Column('verification_notes', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('installation_instructions', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['master_id'], ['certificate_masters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('master_id', 'location_type', 'location_name', name='uq_installation_location')
    )
    op.create_index('ix_certificate_installations_id', 'certificate_installations', ['id'])
    op.create_index('ix_certificate_installations_master_id', 'certificate_installations', ['master_id'])
    op.create_index('ix_certificate_installations_location_type', 'certificate_installations', ['location_type'])
    op.create_index('ix_certificate_installations_device_id', 'certificate_installations', ['device_id'])
    op.create_index('ix_certificate_installations_status', 'certificate_installations', ['status'])
    op.create_index('ix_certificate_installations_is_current', 'certificate_installations', ['is_current'])
    op.create_index('ix_certificate_installations_responsible_team', 'certificate_installations', ['responsible_team'])


def downgrade():
    op.drop_table('certificate_installations')
    op.drop_table('certificate_masters')
    
    # Drop enums - be careful, they might be used elsewhere
    conn = op.get_bind()
    conn.execute(sa.text("DROP TYPE IF EXISTS installationlocationtype"))
    conn.execute(sa.text("DROP TYPE IF EXISTS installationstatus"))
