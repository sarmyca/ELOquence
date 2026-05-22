"""admin_audit_log table

Revision ID: 016_admin_audit_log
Revises: 015_notification_preferences
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "016_admin_audit_log"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_audit_log",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "admin_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("target_type", sa.String(32), nullable=True),
        sa.Column("target_id", sa.String(128), nullable=True),
        sa.Column("target_label", sa.String(255), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "admin_audit_log_admin_user_id_idx",
        "admin_audit_log",
        ["admin_user_id"],
    )
    op.create_index(
        "admin_audit_log_action_idx",
        "admin_audit_log",
        ["action"],
    )
    op.create_index(
        "admin_audit_log_created_at_idx",
        "admin_audit_log",
        [sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("admin_audit_log_created_at_idx", table_name="admin_audit_log")
    op.drop_index("admin_audit_log_action_idx", table_name="admin_audit_log")
    op.drop_index("admin_audit_log_admin_user_id_idx", table_name="admin_audit_log")
    op.drop_table("admin_audit_log")
