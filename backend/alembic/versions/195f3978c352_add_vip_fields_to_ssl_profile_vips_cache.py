"""add vip fields to ssl_profile_vips_cache

Revision ID: 195f3978c352
Revises: f3d27fa723f1
Create Date: 2025-08-19 12:25:06.356929

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '195f3978c352'
down_revision = 'f3d27fa723f1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('ssl_profile_vips_cache', sa.Column('vip_full_path', sa.Text(), nullable=True))
    op.add_column('ssl_profile_vips_cache', sa.Column('partition', sa.Text(), nullable=True))
    op.add_column('ssl_profile_vips_cache', sa.Column('destination', sa.Text(), nullable=True))
    op.add_column('ssl_profile_vips_cache', sa.Column('service_port', sa.Integer(), nullable=True))
    op.add_column('ssl_profile_vips_cache', sa.Column('enabled', sa.Boolean(), nullable=True))
    op.add_column('ssl_profile_vips_cache', sa.Column('status', sa.Text(), nullable=True))

def downgrade():
    op.drop_column('ssl_profile_vips_cache', 'status')
    op.drop_column('ssl_profile_vips_cache', 'enabled')
    op.drop_column('ssl_profile_vips_cache', 'service_port')
    op.drop_column('ssl_profile_vips_cache', 'destination')
    op.drop_column('ssl_profile_vips_cache', 'partition')
    op.drop_column('ssl_profile_vips_cache', 'vip_full_path')