"""add missing enum values for renewalstatus

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2025-12-12 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6g7h8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6g7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add missing values to renewalstatus enum in PostgreSQL."""
    
    # PostgreSQL requires special handling for adding values to existing ENUMs
    # Check if each value exists before adding (to make migration idempotent)
    
    conn = op.get_bind()
    
    # Get existing enum values
    result = conn.execute(sa.text(
        "SELECT enumlabel FROM pg_enum WHERE enumtypid = "
        "(SELECT oid FROM pg_type WHERE typname = 'renewalstatus')"
    ))
    existing_values = {row[0] for row in result}
    
    # List of values that should exist in the enum
    required_values = [
        'CSR_GENERATED',
        'CERT_RECEIVED', 
        'PFX_READY',
        'DEPLOYED',
        'COMPLETED',
        'FAILED',
        'EXPIRED'
    ]
    
    # Add any missing values
    for value in required_values:
        if value not in existing_values:
            # Using IF NOT EXISTS style check via exception handling
            try:
                op.execute(f"ALTER TYPE renewalstatus ADD VALUE IF NOT EXISTS '{value}'")
                print(f"Added enum value: {value}")
            except Exception as e:
                # Value might already exist in some PostgreSQL versions
                print(f"Could not add {value}: {e}")


def downgrade() -> None:
    """Cannot remove enum values in PostgreSQL - this is a no-op."""
    # PostgreSQL doesn't support removing values from enums
    # This downgrade is intentionally empty
    pass
