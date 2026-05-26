"""Add learn_progress table for cross-device Learn (trainer) progress sync.

Revision ID: 018_learn_progress
Revises: 017_game_move_fingerprint
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "018_learn_progress"
down_revision = "017_game_move_fingerprint"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "learn_progress",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("lesson_id", sa.String(length=64), primary_key=True),
        sa.Column("completed", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("learn_progress")
