"""merge_notifications_and_cleanup

Revision ID: b3446b11ca5f
Revises: d4e5f6g7h8i9, e5f6g7h8i9j0
Create Date: 2025-12-16 01:34:01.911533

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3446b11ca5f'
down_revision: Union[str, Sequence[str], None] = ('d4e5f6g7h8i9', 'e5f6g7h8i9j0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
