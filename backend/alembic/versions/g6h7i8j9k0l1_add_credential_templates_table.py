"""add_credential_templates_table

Revision ID: g6h7i8j9k0l1
Revises: e5f6g7h8i9j0
Create Date: 2025-12-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'g6h7i8j9k0l1'
down_revision = 'b3446b11ca5f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'credential_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('username', sa.String(100), nullable=False, server_default='admin'),
        sa.Column('encrypted_password', sa.Text(), nullable=False),
        sa.Column('environment', sa.String(50), nullable=True),
        sa.Column('site_pattern', sa.String(200), nullable=True),
        sa.Column('usage_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_credential_templates_id'), 'credential_templates', ['id'], unique=False)
    op.create_index(op.f('ix_credential_templates_name'), 'credential_templates', ['name'], unique=True)
    op.create_index(op.f('ix_credential_templates_environment'), 'credential_templates', ['environment'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_credential_templates_environment'), table_name='credential_templates')
    op.drop_index(op.f('ix_credential_templates_name'), table_name='credential_templates')
    op.drop_index(op.f('ix_credential_templates_id'), table_name='credential_templates')
    op.drop_table('credential_templates')
