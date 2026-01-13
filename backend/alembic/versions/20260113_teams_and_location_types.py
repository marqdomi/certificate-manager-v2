"""Add dynamic teams and location types for Certificate Master

Revision ID: 20260113_teams
Revises: 20260112_cert_master
Create Date: 2026-01-13

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260113_teams'
down_revision = '20260112_cert_master'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create teams table
    op.create_table(
        'teams',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('display_name', sa.String(200), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('color', sa.String(20), nullable=True),  # For UI badges
        sa.Column('contact_email', sa.String(200), nullable=True),
        sa.Column('slack_channel', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_teams_name', 'teams', ['name'], unique=True)
    op.create_index('ix_teams_is_active', 'teams', ['is_active'])
    
    # Create location_types table (dynamic, replaces enum)
    op.create_table(
        'location_types',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),  # e.g., 'f5', 'azure_app_gw'
        sa.Column('name', sa.String(100), nullable=False),  # e.g., 'F5 Load Balancer'
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(50), nullable=True),  # Material icon name
        sa.Column('category', sa.String(50), nullable=True),  # 'network', 'cloud', 'server'
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_location_types_code', 'location_types', ['code'], unique=True)
    op.create_index('ix_location_types_is_active', 'location_types', ['is_active'])
    
    # Create junction table for certificate_master <-> teams (many-to-many)
    op.create_table(
        'certificate_master_teams',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('master_id', sa.Integer(), nullable=False),
        sa.Column('team_id', sa.Integer(), nullable=False),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='false'),  # Primary owner team
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['master_id'], ['certificate_masters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('master_id', 'team_id', name='uq_master_team')
    )
    op.create_index('ix_certificate_master_teams_master_id', 'certificate_master_teams', ['master_id'])
    op.create_index('ix_certificate_master_teams_team_id', 'certificate_master_teams', ['team_id'])
    
    # Add location_type_id to certificate_installations (FK to location_types)
    op.add_column('certificate_installations', 
        sa.Column('location_type_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_installations_location_type',
        'certificate_installations', 'location_types',
        ['location_type_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Add responsible_team_id to certificate_installations (FK to teams)
    op.add_column('certificate_installations',
        sa.Column('responsible_team_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_installations_responsible_team',
        'certificate_installations', 'teams',
        ['responsible_team_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Insert default teams (based on current data)
    op.execute("""
        INSERT INTO teams (name, display_name, description, color, is_active) VALUES
        ('Network', 'Network Team', 'F5 and network infrastructure team', '#1976d2', true),
        ('Cloud', 'Cloud Team', 'Azure, AWS, GCP cloud infrastructure', '#9c27b0', true),
        ('Security', 'Security Team', 'Security and compliance team', '#d32f2f', true),
        ('DevOps', 'DevOps Team', 'DevOps and platform team', '#2e7d32', true),
        ('Application', 'Application Team', 'Application development team', '#ed6c02', true)
    """)
    
    # Insert default location types (migrate from enum)
    op.execute("""
        INSERT INTO location_types (code, name, description, icon, category, is_active) VALUES
        ('f5', 'F5 Load Balancer', 'F5 BIG-IP load balancer', 'DnsIcon', 'network', true),
        ('local_vm', 'Local VM', 'On-premise virtual machine', 'StorageIcon', 'server', true),
        ('physical_server', 'Physical Server', 'Physical server or appliance', 'StorageIcon', 'server', true),
        ('azure_app_gw', 'Azure App Gateway', 'Azure Application Gateway', 'CloudIcon', 'cloud', true),
        ('azure_front_door', 'Azure Front Door', 'Azure Front Door CDN', 'CloudIcon', 'cloud', true),
        ('aws_alb', 'AWS ALB', 'AWS Application Load Balancer', 'CloudIcon', 'cloud', true),
        ('aws_cloudfront', 'AWS CloudFront', 'AWS CloudFront CDN', 'CloudIcon', 'cloud', true),
        ('gcp_lb', 'GCP Load Balancer', 'Google Cloud Load Balancer', 'CloudIcon', 'cloud', true),
        ('kubernetes', 'Kubernetes', 'Kubernetes Ingress/Service', 'CloudIcon', 'cloud', true),
        ('cdn', 'CDN', 'Content Delivery Network', 'CloudIcon', 'cloud', true),
        ('other', 'Other', 'Other location type', 'StorageIcon', 'other', true)
    """)
    
    # Migrate existing owner_team values to teams relationship
    # First, create teams for any unique owner_team values not in defaults
    op.execute("""
        INSERT INTO teams (name, display_name, is_active)
        SELECT DISTINCT owner_team, owner_team, true
        FROM certificate_masters 
        WHERE owner_team IS NOT NULL 
          AND owner_team != ''
          AND owner_team NOT IN (SELECT name FROM teams)
    """)
    
    # Create certificate_master_teams entries from existing owner_team
    op.execute("""
        INSERT INTO certificate_master_teams (master_id, team_id, is_primary)
        SELECT cm.id, t.id, true
        FROM certificate_masters cm
        JOIN teams t ON t.name = cm.owner_team
        WHERE cm.owner_team IS NOT NULL AND cm.owner_team != ''
    """)
    
    # Migrate responsible_team in installations to team_id
    op.execute("""
        INSERT INTO teams (name, display_name, is_active)
        SELECT DISTINCT responsible_team, responsible_team, true
        FROM certificate_installations 
        WHERE responsible_team IS NOT NULL 
          AND responsible_team != ''
          AND responsible_team NOT IN (SELECT name FROM teams)
    """)
    
    op.execute("""
        UPDATE certificate_installations ci
        SET responsible_team_id = t.id
        FROM teams t
        WHERE ci.responsible_team = t.name
    """)
    
    # Update location_type_id from existing location_type enum
    op.execute("""
        UPDATE certificate_installations ci
        SET location_type_id = lt.id
        FROM location_types lt
        WHERE ci.location_type::text = lt.code
    """)


def downgrade() -> None:
    # Remove foreign key columns
    op.drop_constraint('fk_installations_responsible_team', 'certificate_installations', type_='foreignkey')
    op.drop_column('certificate_installations', 'responsible_team_id')
    
    op.drop_constraint('fk_installations_location_type', 'certificate_installations', type_='foreignkey')
    op.drop_column('certificate_installations', 'location_type_id')
    
    # Drop junction table
    op.drop_index('ix_certificate_master_teams_team_id', 'certificate_master_teams')
    op.drop_index('ix_certificate_master_teams_master_id', 'certificate_master_teams')
    op.drop_table('certificate_master_teams')
    
    # Drop location_types table
    op.drop_index('ix_location_types_is_active', 'location_types')
    op.drop_index('ix_location_types_code', 'location_types')
    op.drop_table('location_types')
    
    # Drop teams table
    op.drop_index('ix_teams_is_active', 'teams')
    op.drop_index('ix_teams_name', 'teams')
    op.drop_table('teams')
