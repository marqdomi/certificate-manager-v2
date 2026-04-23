"""digicert_renewal_tables

Crea tablas para el módulo paralelo de renovación automatizada vía DigiCert:
- digicert_renewal_orders: órdenes de renovación (estado, CSR, cert emitido, etc.)
- digicert_renewal_audit_log: trazabilidad interna CMT de eventos por orden.
- digicert_inventory: cache local para matching F5 ↔ DigiCert (Fase 4).

Revision ID: a1b2c3d4e5f6
Revises: aeb9aa088f87
Create Date: 2026-04-17 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "aeb9aa088f87"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- digicert_renewal_orders ---
    op.create_table(
        "digicert_renewal_orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("certificate_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="PENDING_SUBMIT"),
        sa.Column("digicert_order_id", sa.String(), nullable=True),
        sa.Column("digicert_certificate_id", sa.String(), nullable=True),
        sa.Column("csr_pem", sa.Text(), nullable=True),
        sa.Column("encrypted_private_key", sa.Text(), nullable=True),
        sa.Column("private_key_purged_at", sa.DateTime(), nullable=True),
        sa.Column("key_size", sa.Integer(), nullable=False, server_default="2048"),
        sa.Column("common_name", sa.String(), nullable=False),
        sa.Column("san_list", sa.Text(), nullable=True),
        sa.Column("validity_years", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("product", sa.String(), nullable=True),
        sa.Column("container_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=True),
        sa.Column("signed_cert_pem", sa.Text(), nullable=True),
        sa.Column("chain_pem", sa.Text(), nullable=True),
        sa.Column("serial_number", sa.String(), nullable=True),
        sa.Column("thumbprint", sa.String(), nullable=True),
        sa.Column("valid_from", sa.DateTime(), nullable=True),
        sa.Column("valid_till", sa.DateTime(), nullable=True),
        sa.Column("approval_required", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("approval_detected_at", sa.DateTime(), nullable=True),
        sa.Column("last_approval_reminder_at", sa.DateTime(), nullable=True),
        sa.Column("dcv_method", sa.String(), nullable=True),
        sa.Column("dcv_tokens", sa.Text(), nullable=True),
        sa.Column("dcv_completed_at", sa.DateTime(), nullable=True),
        sa.Column("deploy_results", sa.Text(), nullable=True),
        sa.Column("deployed_at", sa.DateTime(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("idempotency_key", sa.String(), nullable=True),
        sa.Column("submit_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["certificate_id"], ["certificates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("certificate_id", "idempotency_key", name="uq_digicert_cert_idempotency"),
    )
    op.create_index("ix_digicert_renewal_orders_id", "digicert_renewal_orders", ["id"])
    op.create_index("ix_digicert_renewal_orders_certificate_id", "digicert_renewal_orders", ["certificate_id"])
    op.create_index("ix_digicert_renewal_orders_status", "digicert_renewal_orders", ["status"])
    op.create_index("ix_digicert_renewal_orders_digicert_order_id", "digicert_renewal_orders", ["digicert_order_id"])
    op.create_index("ix_digicert_renewal_orders_digicert_certificate_id", "digicert_renewal_orders", ["digicert_certificate_id"])
    op.create_index("ix_digicert_renewal_orders_common_name", "digicert_renewal_orders", ["common_name"])
    op.create_index("ix_digicert_renewal_orders_serial_number", "digicert_renewal_orders", ["serial_number"])
    op.create_index("ix_digicert_renewal_orders_thumbprint", "digicert_renewal_orders", ["thumbprint"])
    op.create_index("ix_digicert_renewal_orders_idempotency_key", "digicert_renewal_orders", ["idempotency_key"])
    op.create_index("ix_digicert_renewal_orders_created_at", "digicert_renewal_orders", ["created_at"])

    # Partial unique index: solo UNA orden activa por certificate_id (PostgreSQL).
    # Previene doble orden si el usuario da doble click o hay retry de red.
    op.execute(
        """
        CREATE UNIQUE INDEX ix_digicert_one_active_per_cert
        ON digicert_renewal_orders (certificate_id)
        WHERE status IN (
            'PENDING_SUBMIT','SUBMITTED','NEEDS_APPROVAL','PENDING_DCV',
            'PENDING_VALIDATION','ISSUED','DOWNLOADED','DEPLOYING','PARTIAL_DEPLOY'
        )
        """
    )

    # --- digicert_renewal_audit_log ---
    op.create_table(
        "digicert_renewal_audit_log",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("username", sa.String(), nullable=True),
        sa.Column("event_metadata", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["digicert_renewal_orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_digicert_audit_id", "digicert_renewal_audit_log", ["id"])
    op.create_index("ix_digicert_audit_order_id", "digicert_renewal_audit_log", ["order_id"])
    op.create_index("ix_digicert_audit_event_type", "digicert_renewal_audit_log", ["event_type"])
    op.create_index("ix_digicert_audit_created_at", "digicert_renewal_audit_log", ["created_at"])

    # --- digicert_inventory ---
    op.create_table(
        "digicert_inventory",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("digicert_order_id", sa.String(), nullable=False),
        sa.Column("digicert_certificate_id", sa.String(), nullable=True),
        sa.Column("common_name", sa.String(), nullable=True),
        sa.Column("sans", sa.Text(), nullable=True),
        sa.Column("serial_number", sa.String(), nullable=True),
        sa.Column("thumbprint", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("product", sa.String(), nullable=True),
        sa.Column("container_id", sa.String(), nullable=True),
        sa.Column("organization", sa.String(), nullable=True),
        sa.Column("valid_from", sa.DateTime(), nullable=True),
        sa.Column("valid_till", sa.DateTime(), nullable=True),
        sa.Column("issued_date", sa.DateTime(), nullable=True),
        sa.Column("local_certificate_id", sa.Integer(), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["local_certificate_id"], ["certificates.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("digicert_order_id", name="uq_digicert_inventory_order_id"),
    )
    op.create_index("ix_digicert_inventory_id", "digicert_inventory", ["id"])
    op.create_index("ix_digicert_inventory_digicert_order_id", "digicert_inventory", ["digicert_order_id"])
    op.create_index("ix_digicert_inventory_digicert_certificate_id", "digicert_inventory", ["digicert_certificate_id"])
    op.create_index("ix_digicert_inventory_common_name", "digicert_inventory", ["common_name"])
    op.create_index("ix_digicert_inventory_serial_number", "digicert_inventory", ["serial_number"])
    op.create_index("ix_digicert_inventory_thumbprint", "digicert_inventory", ["thumbprint"])
    op.create_index("ix_digicert_inventory_status", "digicert_inventory", ["status"])
    op.create_index("ix_digicert_inventory_container_id", "digicert_inventory", ["container_id"])
    op.create_index("ix_digicert_inventory_valid_till", "digicert_inventory", ["valid_till"])
    op.create_index("ix_digicert_inventory_local_certificate_id", "digicert_inventory", ["local_certificate_id"])


def downgrade() -> None:
    op.drop_table("digicert_inventory")
    op.drop_table("digicert_renewal_audit_log")
    op.execute("DROP INDEX IF EXISTS ix_digicert_one_active_per_cert")
    op.drop_table("digicert_renewal_orders")
