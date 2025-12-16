"""add_notifications_and_preferences_tables

Revision ID: d4e5f6g7h8i9
Revises: 78dd604e1e3d
Create Date: 2025-01-01 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6g7h8i9'
down_revision: Union[str, Sequence[str], None] = '78dd604e1e3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add notifications and user_preferences tables for CMT Enterprise features."""
    
    # Create notification_type enum
    notification_type = sa.Enum(
        'cert_expiring_soon', 'cert_expired', 'cert_renewed', 'cert_renewal_failed',
        'cert_deployed', 'cert_deploy_failed', 'batch_renewal_complete', 
        'batch_renewal_partial', 'batch_renewal_failed', 'discovery_complete',
        'discovery_failed', 'new_devices_found', 'device_unreachable', 
        'device_recovered', 'system_alert', 'system_maintenance',
        'user_created', 'password_changed', 'role_changed',
        name='notificationtype'
    )
    
    # Create notification_priority enum
    notification_priority = sa.Enum(
        'low', 'medium', 'high', 'critical',
        name='notificationpriority'
    )
    
    # Create notifications table
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('type', notification_type, nullable=False),
        sa.Column('priority', notification_priority, nullable=False, server_default='medium'),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('data', sa.Text(), nullable=True),
        sa.Column('action_url', sa.String(500), nullable=True),
        sa.Column('action_label', sa.String(100), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('read_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for notifications
    op.create_index('ix_notifications_id', 'notifications', ['id'], unique=False)
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'], unique=False)
    op.create_index('ix_notifications_type', 'notifications', ['type'], unique=False)
    op.create_index('ix_notifications_is_read', 'notifications', ['is_read'], unique=False)
    op.create_index('ix_notifications_created_at', 'notifications', ['created_at'], unique=False)
    
    # Create user_preferences table
    op.create_table(
        'user_preferences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('notification_settings', sa.Text(), nullable=True, server_default='{}'),
        sa.Column('email_notifications_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('email_digest_frequency', sa.String(20), nullable=False, server_default='daily'),
        sa.Column('theme', sa.String(20), nullable=False, server_default='light'),
        sa.Column('sidebar_collapsed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('default_page_size', sa.Integer(), nullable=False, server_default='25'),
        sa.Column('dashboard_layout', sa.Text(), nullable=True, server_default='{}'),
        sa.Column('table_preferences', sa.Text(), nullable=True, server_default='{}'),
        sa.Column('timezone', sa.String(50), nullable=False, server_default='UTC'),
        sa.Column('date_format', sa.String(20), nullable=False, server_default='YYYY-MM-DD'),
        sa.Column('time_format', sa.String(10), nullable=False, server_default='24h'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_user_preferences_user_id')
    )
    
    # Create index for user_preferences
    op.create_index('ix_user_preferences_id', 'user_preferences', ['id'], unique=False)
    op.create_index('ix_user_preferences_user_id', 'user_preferences', ['user_id'], unique=False)


def downgrade() -> None:
    """Remove notifications and user_preferences tables."""
    
    # Drop indexes
    op.drop_index('ix_user_preferences_user_id', table_name='user_preferences')
    op.drop_index('ix_user_preferences_id', table_name='user_preferences')
    
    op.drop_index('ix_notifications_created_at', table_name='notifications')
    op.drop_index('ix_notifications_is_read', table_name='notifications')
    op.drop_index('ix_notifications_type', table_name='notifications')
    op.drop_index('ix_notifications_user_id', table_name='notifications')
    op.drop_index('ix_notifications_id', table_name='notifications')
    
    # Drop tables
    op.drop_table('user_preferences')
    op.drop_table('notifications')
    
    # Drop enums
    sa.Enum(name='notificationpriority').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='notificationtype').drop(op.get_bind(), checkfirst=True)
