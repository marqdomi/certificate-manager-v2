"""add_unified_discovery_fields

Revision ID: aeb9aa088f87
Revises: 39275eae9507
Create Date: 2025-09-23 14:27:00.198942

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aeb9aa088f87'
down_revision: Union[str, Sequence[str], None] = '39275eae9507'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add unified discovery fields to devices table."""
    # Add new fields for unified discovery monitoring
    op.add_column('devices', sa.Column('last_unified_discovery', sa.DateTime(), nullable=True))
    op.add_column('devices', sa.Column('last_health_check', sa.DateTime(), nullable=True))
    op.add_column('devices', sa.Column('last_facts_scan', sa.DateTime(), nullable=True))
    
    # Create indexes for monitoring queries
    op.create_index('idx_devices_last_unified_discovery', 'devices', ['last_unified_discovery'])
    op.create_index('idx_devices_last_health_check', 'devices', ['last_health_check'])
    op.create_index('idx_devices_last_facts_scan', 'devices', ['last_facts_scan'])


def downgrade() -> None:
    """Remove unified discovery fields from devices table."""
    # Drop indexes
    op.drop_index('idx_devices_last_facts_scan', table_name='devices')
    op.drop_index('idx_devices_last_health_check', table_name='devices')
    op.drop_index('idx_devices_last_unified_discovery', table_name='devices')
    
    # Drop columns
    op.drop_column('devices', 'last_facts_scan')
    op.drop_column('devices', 'last_health_check')
    op.drop_column('devices', 'last_unified_discovery')
