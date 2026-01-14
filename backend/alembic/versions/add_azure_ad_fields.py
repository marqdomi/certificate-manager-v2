"""Add Azure AD fields to users table

Revision ID: add_azure_ad_fields
Revises: 
Create Date: 2025-01-XX

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_azure_ad_fields'
down_revision = None  # Update this to your latest migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add Azure AD related columns to users table
    op.add_column('users', sa.Column('email', sa.String(), nullable=True))
    op.add_column('users', sa.Column('full_name', sa.String(), nullable=True))
    op.add_column('users', sa.Column('azure_oid', sa.String(), nullable=True))
    op.add_column('users', sa.Column('auth_provider', sa.String(), nullable=True, server_default='local'))
    op.add_column('users', sa.Column('last_login', sa.DateTime(), nullable=True))
    
    # Create indexes for the new columns
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=False)
    op.create_index(op.f('ix_users_azure_oid'), 'users', ['azure_oid'], unique=True)


def downgrade() -> None:
    # Drop indexes first
    op.drop_index(op.f('ix_users_azure_oid'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    
    # Drop columns
    op.drop_column('users', 'last_login')
    op.drop_column('users', 'auth_provider')
    op.drop_column('users', 'azure_oid')
    op.drop_column('users', 'full_name')
    op.drop_column('users', 'email')
