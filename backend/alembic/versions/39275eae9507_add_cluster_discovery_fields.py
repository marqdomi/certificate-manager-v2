"""add_cluster_discovery_fields

Revision ID: 39275eae9507
Revises: 60980336045c
Create Date: 2025-09-23 19:52:01.200414

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '39275eae9507'
down_revision: Union[str, Sequence[str], None] = '60980336045c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add fields for real F5 cluster discovery."""
    # Agregar campos para almacenar información real de cluster discovery
    op.add_column('devices', sa.Column('trust_domain', sa.String(), nullable=True, comment='F5 trust domain'))
    op.add_column('devices', sa.Column('local_device_name', sa.String(), nullable=True, comment='Device name as reported by F5'))
    op.add_column('devices', sa.Column('peer_device_ids', sa.Text(), nullable=True, comment='JSON array of peer device IDs in cluster'))
    op.add_column('devices', sa.Column('sync_group', sa.String(), nullable=True, comment='F5 sync group information'))
    op.add_column('devices', sa.Column('device_trust_state', sa.String(), nullable=True, comment='F5 device trust state'))
    op.add_column('devices', sa.Column('last_cluster_discovery', sa.DateTime(), nullable=True, comment='Last time cluster info was discovered'))
    op.add_column('devices', sa.Column('cluster_discovery_source', sa.String(), nullable=True, comment='How cluster info was discovered: heuristic|f5_api'))
    
    # Crear índices para mejorar rendimiento de queries
    op.create_index('ix_devices_trust_domain', 'devices', ['trust_domain'])
    op.create_index('ix_devices_cluster_discovery_source', 'devices', ['cluster_discovery_source'])


def downgrade() -> None:
    """Downgrade schema - Remove cluster discovery fields."""
    # Remover índices
    op.drop_index('ix_devices_cluster_discovery_source', 'devices')
    op.drop_index('ix_devices_trust_domain', 'devices')
    
    # Remover columnas
    op.drop_column('devices', 'cluster_discovery_source')
    op.drop_column('devices', 'last_cluster_discovery')
    op.drop_column('devices', 'device_trust_state')
    op.drop_column('devices', 'sync_group')
    op.drop_column('devices', 'peer_device_ids')
    op.drop_column('devices', 'local_device_name')
    op.drop_column('devices', 'trust_domain')
