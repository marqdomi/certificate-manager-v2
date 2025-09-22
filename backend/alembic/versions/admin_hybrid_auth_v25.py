"""Add admin panel and hybrid auth models

Revision ID: admin_hybrid_auth_v25
Revises: ddea831f15f5
Create Date: 2025-09-22 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'admin_hybrid_auth_v25'
down_revision = 'ddea831f15f5'
branch_labels = None
depends_on = None

def upgrade():
    # Create enum types
    authtype_enum = sa.Enum('LOCAL', 'LDAP', 'AZURE_AD', 'SAML', name='authtype')
    authtype_enum.create(op.get_bind())
    
    # Update UserRole enum
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'SUPER_ADMIN'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'CERTIFICATE_MANAGER'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'F5_OPERATOR'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'AUDITOR'")
    
    # Add new columns to users table
    op.add_column('users', sa.Column('auth_type', authtype_enum, nullable=False, server_default='LOCAL'))
    op.add_column('users', sa.Column('email', sa.String(), nullable=True))
    op.add_column('users', sa.Column('full_name', sa.String(), nullable=True))
    op.add_column('users', sa.Column('department', sa.String(), nullable=True))
    op.add_column('users', sa.Column('phone', sa.String(), nullable=True))
    op.add_column('users', sa.Column('permissions', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('domain', sa.String(), nullable=True))
    op.add_column('users', sa.Column('distinguished_name', sa.String(), nullable=True))
    op.add_column('users', sa.Column('ad_groups', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('object_guid', sa.String(), nullable=True))
    op.add_column('users', sa.Column('last_login', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('last_login_ip', sa.String(), nullable=True))
    op.add_column('users', sa.Column('login_count', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('users', sa.Column('failed_login_attempts', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('users', sa.Column('last_failed_login', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('is_locked', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('password_expires_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('must_change_password', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')))
    op.add_column('users', sa.Column('created_by', sa.String(), nullable=True))
    op.add_column('users', sa.Column('last_modified_by', sa.String(), nullable=True))
    op.add_column('users', sa.Column('last_ad_sync', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('ad_sync_status', sa.String(), nullable=True))
    
    # Make hashed_password nullable for AD users
    op.alter_column('users', 'hashed_password', nullable=True)
    
    # Create indexes on new columns
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    
    # Create user_sessions table
    op.create_table('user_sessions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_token', sa.String(), nullable=False, unique=True, index=True),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('last_activity', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true')
    )
    
    # Create user_activities table
    op.create_table('user_activities',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('username', sa.String(), nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('resource_type', sa.String(), nullable=True),
        sa.Column('resource_id', sa.String(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('result', sa.String(), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()'))
    )
    
    # Create system_config table
    op.create_table('system_config',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('category', sa.String(), nullable=False, index=True),
        sa.Column('key', sa.String(), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('encrypted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('updated_by', sa.String(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()'))
    )
    
    # Add unique constraint for system_config
    op.create_unique_constraint('uq_config_category_key', 'system_config', ['category', 'key'])
    
    # Create indexes for performance
    op.create_index('ix_user_activities_username', 'user_activities', ['username'])
    op.create_index('ix_user_activities_action', 'user_activities', ['action'])
    op.create_index('ix_user_activities_created_at', 'user_activities', ['created_at'])
    op.create_index('ix_system_config_category', 'system_config', ['category'])


def downgrade():
    # Drop indexes
    op.drop_index('ix_system_config_category', 'system_config')
    op.drop_index('ix_user_activities_created_at', 'user_activities')
    op.drop_index('ix_user_activities_action', 'user_activities')
    op.drop_index('ix_user_activities_username', 'user_activities')
    
    # Drop tables
    op.drop_table('system_config')
    op.drop_table('user_activities')
    op.drop_table('user_sessions')
    
    # Drop index from users
    op.drop_index('ix_users_email', 'users')
    
    # Remove columns from users table
    op.drop_column('users', 'ad_sync_status')
    op.drop_column('users', 'last_ad_sync')
    op.drop_column('users', 'last_modified_by')
    op.drop_column('users', 'created_by')
    op.drop_column('users', 'updated_at')
    op.drop_column('users', 'must_change_password')
    op.drop_column('users', 'password_expires_at')
    op.drop_column('users', 'is_locked')
    op.drop_column('users', 'last_failed_login')
    op.drop_column('users', 'failed_login_attempts')
    op.drop_column('users', 'login_count')
    op.drop_column('users', 'last_login_ip')
    op.drop_column('users', 'last_login')
    op.drop_column('users', 'object_guid')
    op.drop_column('users', 'ad_groups')
    op.drop_column('users', 'distinguished_name')
    op.drop_column('users', 'domain')
    op.drop_column('users', 'permissions')
    op.drop_column('users', 'phone')
    op.drop_column('users', 'department')
    op.drop_column('users', 'full_name')
    op.drop_column('users', 'email')
    op.drop_column('users', 'auth_type')
    
    # Make hashed_password non-nullable again
    op.alter_column('users', 'hashed_password', nullable=False)
    
    # Drop enum type
    authtype_enum = sa.Enum(name='authtype')
    authtype_enum.drop(op.get_bind())