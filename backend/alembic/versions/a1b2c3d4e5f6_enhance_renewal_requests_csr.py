"""enhance renewal_requests for CSR generator

Revision ID: a1b2c3d4e5f6
Revises: 78dd604e1e3d
Create Date: 2025-01-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '78dd604e1e3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add new columns to renewal_requests for CSR generator feature."""
    
    # First, make original_certificate_id nullable (for new certs not linked to existing)
    op.alter_column('renewal_requests', 'original_certificate_id',
                    existing_type=sa.Integer(),
                    nullable=True)
    
    # Add new columns for CSR details
    op.add_column('renewal_requests', 
                  sa.Column('common_name', sa.String(), nullable=True))
    op.add_column('renewal_requests', 
                  sa.Column('san_names', sa.Text(), nullable=True))
    op.add_column('renewal_requests', 
                  sa.Column('key_size', sa.Integer(), default=2048, nullable=True))
    
    # Add columns for signed certificate
    op.add_column('renewal_requests', 
                  sa.Column('signed_certificate_pem', sa.Text(), nullable=True))
    op.add_column('renewal_requests', 
                  sa.Column('certificate_chain_pem', sa.Text(), nullable=True))
    
    # Add PFX file tracking
    op.add_column('renewal_requests', 
                  sa.Column('pfx_filename', sa.String(), nullable=True))
    
    # Add certificate details
    op.add_column('renewal_requests', 
                  sa.Column('cert_expiration_date', sa.DateTime(), nullable=True))
    op.add_column('renewal_requests', 
                  sa.Column('cert_issuer', sa.String(), nullable=True))
    
    # Add audit info
    op.add_column('renewal_requests', 
                  sa.Column('created_by', sa.String(), nullable=True))
    
    # Create index on common_name for faster lookups
    op.create_index(op.f('ix_renewal_requests_common_name'), 
                    'renewal_requests', ['common_name'], unique=False)
    
    # Note: We need to update the ENUM type to include new statuses
    # This requires dropping and recreating the enum in PostgreSQL
    # For SQLite, enums are stored as strings, so no action needed
    
    # For PostgreSQL, we'd need:
    # op.execute("ALTER TYPE renewalstatus ADD VALUE 'CERT_RECEIVED' AFTER 'CSR_GENERATED'")
    # op.execute("ALTER TYPE renewalstatus ADD VALUE 'PFX_READY' AFTER 'CERT_RECEIVED'")
    # op.execute("ALTER TYPE renewalstatus ADD VALUE 'DEPLOYED' AFTER 'PFX_READY'")
    # op.execute("ALTER TYPE renewalstatus ADD VALUE 'EXPIRED' AFTER 'FAILED'")
    

def downgrade() -> None:
    """Remove CSR generator columns from renewal_requests."""
    
    op.drop_index(op.f('ix_renewal_requests_common_name'), table_name='renewal_requests')
    
    op.drop_column('renewal_requests', 'created_by')
    op.drop_column('renewal_requests', 'cert_issuer')
    op.drop_column('renewal_requests', 'cert_expiration_date')
    op.drop_column('renewal_requests', 'pfx_filename')
    op.drop_column('renewal_requests', 'certificate_chain_pem')
    op.drop_column('renewal_requests', 'signed_certificate_pem')
    op.drop_column('renewal_requests', 'key_size')
    op.drop_column('renewal_requests', 'san_names')
    op.drop_column('renewal_requests', 'common_name')
    
    # Revert original_certificate_id to NOT NULL
    op.alter_column('renewal_requests', 'original_certificate_id',
                    existing_type=sa.Integer(),
                    nullable=False)
