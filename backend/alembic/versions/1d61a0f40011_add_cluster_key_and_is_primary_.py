"""add cluster_key and is_primary_preferred to devices

Revision ID: 1d61a0f40011
Revises: 0813608529b5
Create Date: 2025-08-27 14:38:32.589866

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1d61a0f40011'
down_revision: Union[str, Sequence[str], None] = '0813608529b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade():
    op.add_column('devices', sa.Column('cluster_key', sa.String(), nullable=True))
    op.add_column('devices', sa.Column('is_primary_preferred', sa.Boolean(), nullable=False, server_default=sa.text('false')))

def downgrade():
    op.drop_column('devices', 'is_primary_preferred')
    op.drop_column('devices', 'cluster_key')
