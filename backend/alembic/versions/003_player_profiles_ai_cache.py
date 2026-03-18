"""Add player_profiles and ai_cache tables.

Revision ID: 003
Revises: 001
Create Date: 2026-03-18
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # player_profiles
    # ------------------------------------------------------------------
    op.create_table(
        "player_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("total_games", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_wins", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("avg_accuracy", sa.Float(), nullable=True),
        sa.Column("avg_accuracy_opening", sa.Float(), nullable=True),
        sa.Column("avg_accuracy_midgame", sa.Float(), nullable=True),
        sa.Column("avg_accuracy_endgame", sa.Float(), nullable=True),
        sa.Column("favorite_openers", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("constraint_violation_rate", sa.Float(), nullable=True),
        sa.Column("trap_detection_rate", sa.Float(), nullable=True),
        sa.Column("accuracy_trend_30d", sa.Float(), nullable=True),
        sa.Column("elo_trend_30d", sa.Float(), nullable=True),
        sa.Column(
            "last_updated",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_player_profiles_user_id", "player_profiles", ["user_id"])

    # ------------------------------------------------------------------
    # ai_cache
    # ------------------------------------------------------------------
    op.create_table(
        "ai_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cache_key", sa.String(255), nullable=False),
        sa.Column("tier", sa.Integer(), nullable=False),
        sa.Column("response_text", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cache_key"),
    )
    op.create_index("ix_ai_cache_cache_key", "ai_cache", ["cache_key"])


def downgrade() -> None:
    op.drop_index("ix_ai_cache_cache_key", table_name="ai_cache")
    op.drop_table("ai_cache")
    op.drop_index("ix_player_profiles_user_id", table_name="player_profiles")
    op.drop_table("player_profiles")
