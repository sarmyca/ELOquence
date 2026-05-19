"""Add notification_preferences table for per-trigger push opt-ins.

Revision ID: 015
Revises: 014
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notification_preferences",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("challenge_results", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("achievement_unlock", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("daily_reminder", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("streak_warning", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("notification_preferences")
