"""Add operation_snapshots table for rollback system

Revision ID: e5f6g7h8i9j0
Revises: c3d4e5f6g7h8
Create Date: 2025-12-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'e5f6g7h8i9j0'
down_revision = 'c3d4e5f6g7h8'
branch_labels = None
depends_on = None


def upgrade():
    # Create OperationType enum (if not exists)
    op.execute("DO $$ BEGIN CREATE TYPE operationtype AS ENUM ('cert_delete', 'cert_renew', 'profile_dissociate', 'bulk_delete', 'bulk_cleanup'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    
    # Create SnapshotStatus enum (if not exists)
    op.execute("DO $$ BEGIN CREATE TYPE snapshotstatus AS ENUM ('pending', 'applied', 'rolled_back', 'expired', 'failed'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    
    # Create operation_snapshots table
    op.create_table(
        'operation_snapshots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('operation_type', postgresql.ENUM('cert_delete', 'cert_renew', 'profile_dissociate', 'bulk_delete', 'bulk_cleanup', name='operationtype', create_type=False), nullable=False),
        sa.Column('operation_id', sa.String(), nullable=False),
        sa.Column('status', postgresql.ENUM('pending', 'applied', 'rolled_back', 'expired', 'failed', name='snapshotstatus', create_type=False), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('device_hostname', sa.String(), nullable=False),
        sa.Column('cert_name', sa.String(), nullable=False),
        sa.Column('partition', sa.String(), nullable=False, server_default='Common'),
        sa.Column('snapshot_data', sa.Text(), nullable=False),
        sa.Column('affected_profiles', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('executed_at', sa.DateTime(), nullable=True),
        sa.Column('rolled_back_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('rollback_result', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index('ix_operation_snapshots_id', 'operation_snapshots', ['id'])
    op.create_index('ix_operation_snapshots_operation_type', 'operation_snapshots', ['operation_type'])
    op.create_index('ix_operation_snapshots_operation_id', 'operation_snapshots', ['operation_id'], unique=True)
    op.create_index('ix_operation_snapshots_device_id', 'operation_snapshots', ['device_id'])
    op.create_index('ix_operation_snapshots_cert_name', 'operation_snapshots', ['cert_name'])
    op.create_index('ix_operation_snapshots_created_at', 'operation_snapshots', ['created_at'])
    op.create_index('ix_operation_snapshots_expires_at', 'operation_snapshots', ['expires_at'])


def downgrade():
    # Drop indexes
    op.drop_index('ix_operation_snapshots_expires_at', table_name='operation_snapshots')
    op.drop_index('ix_operation_snapshots_created_at', table_name='operation_snapshots')
    op.drop_index('ix_operation_snapshots_cert_name', table_name='operation_snapshots')
    op.drop_index('ix_operation_snapshots_device_id', table_name='operation_snapshots')
    op.drop_index('ix_operation_snapshots_operation_id', table_name='operation_snapshots')
    op.drop_index('ix_operation_snapshots_operation_type', table_name='operation_snapshots')
    op.drop_index('ix_operation_snapshots_id', table_name='operation_snapshots')
    
    # Drop table
    op.drop_table('operation_snapshots')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS snapshotstatus')
    op.execute('DROP TYPE IF EXISTS operationtype')
