"""Align achievements.earned_at -> unlocked_at and add elo_history.accuracy_score.

Revision ID: 012
Revises: 011
"""
from alembic import op
import sqlalchemy as sa


revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # achievements: rename earned_at -> unlocked_at (if needed)
    bind = op.get_bind()
    insp = sa.inspect(bind)
    ach_cols = {c["name"] for c in insp.get_columns("achievements")}
    if "earned_at" in ach_cols and "unlocked_at" not in ach_cols:
        op.alter_column("achievements", "earned_at", new_column_name="unlocked_at")

    # elo_history: add accuracy_score nullable (if missing)
    elo_cols = {c["name"] for c in insp.get_columns("elo_history")}
    if "accuracy_score" not in elo_cols:
        op.add_column(
            "elo_history",
            sa.Column("accuracy_score", sa.Float(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    elo_cols = {c["name"] for c in insp.get_columns("elo_history")}
    if "accuracy_score" in elo_cols:
        op.drop_column("elo_history", "accuracy_score")

    ach_cols = {c["name"] for c in insp.get_columns("achievements")}
    if "unlocked_at" in ach_cols and "earned_at" not in ach_cols:
        op.alter_column("achievements", "unlocked_at", new_column_name="earned_at")
