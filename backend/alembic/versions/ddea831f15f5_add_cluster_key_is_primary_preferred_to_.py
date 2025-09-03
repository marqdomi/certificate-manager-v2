"""add cluster_key & is_primary_preferred to devices

Revision ID: ddea831f15f5
Revises: 1d61a0f40011
Create Date: 2025-08-29 15:59:22.389564

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ddea831f15f5'
down_revision: Union[str, Sequence[str], None] = '1d61a0f40011'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # 1) Nuevas columnas en devices
    op.add_column('devices', sa.Column('cluster_key', sa.String(), nullable=True))
    op.add_column(
        'devices',
        sa.Column('is_primary_preferred', sa.Boolean(), nullable=False, server_default=sa.text('false'))
    )

    # 2) Índice para cluster_key (útil para agrupar por cluster y filtrar)
    op.create_index('ix_devices_cluster_key', 'devices', ['cluster_key'])

    # 3) (Opcional) Pequeño backfill:
    #    - deja is_primary_preferred en false por defecto
    #    - si quieres marcar como preferidos los que hoy están ACTIVE e In Sync:
    op.execute("""
        UPDATE devices
        SET is_primary_preferred = TRUE
        WHERE COALESCE(ha_state,'') ILIKE 'ACTIVE'
          AND COALESCE(sync_status,'') ILIKE 'In Sync%';
    """)

    # 4) Quitar el server_default para no “forzar” futuros INSERTs
    op.alter_column('devices', 'is_primary_preferred', server_default=None)


def downgrade():
    op.drop_index('ix_devices_cluster_key', table_name='devices')
    op.drop_column('devices', 'is_primary_preferred')
    op.drop_column('devices', 'cluster_key')
"""add cluster_key & is_primary_preferred to devices

Revision ID: ddea831f15f5
Revises: 1d61a0f40011
Create Date: 2025-08-29 15:59:22.389564

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'ddea831f15f5'
down_revision: Union[str, Sequence[str], None] = '1d61a0f40011'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return column in {c['name'] for c in insp.get_columns(table)}


def _has_index(table: str, index: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return index in {ix['name'] for ix in insp.get_indexes(table)}


def upgrade():
    # 1) Nuevas columnas en devices (idempotente)
    if not _has_column('devices', 'cluster_key'):
        op.add_column('devices', sa.Column('cluster_key', sa.String(), nullable=True))

    if not _has_column('devices', 'is_primary_preferred'):
        op.add_column(
            'devices',
            sa.Column('is_primary_preferred', sa.Boolean(), nullable=False, server_default=sa.text('false'))
        )

    # 2) Índice para cluster_key (útil para agrupar por cluster y filtrar)
    if _has_column('devices', 'cluster_key') and not _has_index('devices', 'ix_devices_cluster_key'):
        op.create_index('ix_devices_cluster_key', 'devices', ['cluster_key'])

    # 3) Backfill opcional: marcar como preferidos los ACTIVE/In Sync
    #    Solo si la columna existe (por si ya estaba antes del upgrade).
    if _has_column('devices', 'is_primary_preferred'):
        op.execute(
            """
            UPDATE devices
            SET is_primary_preferred = TRUE
            WHERE COALESCE(ha_state,'') ILIKE 'ACTIVE'
              AND COALESCE(sync_status,'') ILIKE 'In Sync%';
            """
        )
        # 4) Quitar el server_default para no “forzar” futuros INSERTs
        op.alter_column('devices', 'is_primary_preferred', server_default=None)


def downgrade():
    # Borrados idempotentes
    if _has_index('devices', 'ix_devices_cluster_key'):
        op.drop_index('ix_devices_cluster_key', table_name='devices')

    if _has_column('devices', 'is_primary_preferred'):
        op.drop_column('devices', 'is_primary_preferred')

    if _has_column('devices', 'cluster_key'):
        op.drop_column('devices', 'cluster_key')