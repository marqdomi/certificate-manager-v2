"""device facts fields

Revision ID: 0813608529b5
Revises: 195f3978c352
Create Date: 2025-08-26 16:01:25.471912

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0813608529b5'
down_revision: Union[str, Sequence[str], None] = '195f3978c352'
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table('devices') as batch:
        batch.add_column(sa.Column('platform', sa.String(), nullable=True))
        batch.add_column(sa.Column('serial_number', sa.String(), nullable=True))
        batch.add_column(sa.Column('ha_state', sa.String(), nullable=True))
        batch.add_column(sa.Column('sync_status', sa.String(), nullable=True))
        batch.add_column(sa.Column('last_sync_color', sa.String(), nullable=True))
        batch.add_column(sa.Column('dns_servers', sa.Text(), nullable=True))
        batch.add_column(sa.Column('last_facts_refresh', sa.DateTime(), nullable=True))
        batch.add_column(sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    # quita el server_default para futuras inserciones
    op.alter_column('devices', 'active', server_default=None)

def downgrade():
    with op.batch_alter_table('devices') as batch:
        batch.drop_column('active')
        batch.drop_column('last_facts_refresh')
        batch.drop_column('dns_servers')
        batch.drop_column('last_sync_color')
        batch.drop_column('sync_status')
        batch.drop_column('ha_state')
        batch.drop_column('serial_number')
        batch.drop_column('platform')