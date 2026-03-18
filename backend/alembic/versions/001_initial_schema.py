"""Initial schema — create all ELOquence tables.

Revision ID: 001
Revises:
Create Date: 2026-03-17
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # users
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("username", sa.String(50), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("elo_rating", sa.Float(), nullable=False, server_default="1000.0"),
        sa.Column("games_played", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_placement", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("current_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("longest_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_played_date", sa.Date(), nullable=True),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("username"),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_username", "users", ["username"])

    # ------------------------------------------------------------------
    # games
    # ------------------------------------------------------------------
    op.create_table(
        "games",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("mode", sa.String(20), nullable=False),
        sa.Column("target_word", sa.String(5), nullable=False),
        sa.Column("word_difficulty", sa.Float(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="in_progress"),
        sa.Column("num_guesses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("time_seconds", sa.Float(), nullable=True),
        sa.Column("rated", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("accuracy_score", sa.Float(), nullable=True),
        sa.Column("luck_factor", sa.Float(), nullable=True),
        sa.Column("elo_before", sa.Float(), nullable=True),
        sa.Column("elo_after", sa.Float(), nullable=True),
        sa.Column("elo_delta", sa.Float(), nullable=True),
        sa.Column("is_placement", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("constraint_violations", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("traps_encountered", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_games_user_id", "games", ["user_id"])

    # ------------------------------------------------------------------
    # moves
    # ------------------------------------------------------------------
    op.create_table(
        "moves",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("game_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("move_number", sa.Integer(), nullable=False),
        sa.Column("guess_word", sa.String(5), nullable=False),
        sa.Column("pattern", sa.Integer(), nullable=False),
        sa.Column("remaining_words", sa.Integer(), nullable=True),
        sa.Column("entropy_before", sa.Float(), nullable=True),
        sa.Column("entropy_after", sa.Float(), nullable=True),
        sa.Column("info_gained", sa.Float(), nullable=True),
        sa.Column("optimal_info", sa.Float(), nullable=True),
        sa.Column("optimal_word", sa.String(5), nullable=True),
        sa.Column("expected_remaining", sa.Float(), nullable=True),
        sa.Column("optimal_expected_remaining", sa.Float(), nullable=True),
        sa.Column("efficiency_ratio", sa.Float(), nullable=True),
        sa.Column("bits_lost", sa.Float(), nullable=True),
        sa.Column("classification", sa.String(20), nullable=True),
        sa.Column("game_phase", sa.String(20), nullable=True),
        sa.Column("constraint_violation", sa.String(10), nullable=True),
        sa.Column("trap_detected", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_book_move", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_moves_game_id", "moves", ["game_id"])

    # ------------------------------------------------------------------
    # elo_history
    # ------------------------------------------------------------------
    op.create_table(
        "elo_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("game_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("elo_before", sa.Float(), nullable=False),
        sa.Column("elo_after", sa.Float(), nullable=False),
        sa.Column("delta", sa.Float(), nullable=False),
        sa.Column("accuracy_score", sa.Float(), nullable=True),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_elo_history_user_id", "elo_history", ["user_id"])
    op.create_index("ix_elo_history_game_id", "elo_history", ["game_id"])

    # ------------------------------------------------------------------
    # daily_words
    # ------------------------------------------------------------------
    op.create_table(
        "daily_words",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("word", sa.String(5), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("difficulty", sa.Float(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("date"),
    )
    op.create_index("ix_daily_words_date", "daily_words", ["date"])

    # ------------------------------------------------------------------
    # word_stats
    # ------------------------------------------------------------------
    op.create_table(
        "word_stats",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("word", sa.String(5), nullable=False),
        sa.Column("times_played", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("times_solved", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("avg_guesses", sa.Float(), nullable=True),
        sa.Column("avg_accuracy", sa.Float(), nullable=True),
        sa.Column("tree_difficulty", sa.Float(), nullable=True),
        sa.Column("calibrated_difficulty", sa.Float(), nullable=True),
        sa.Column("trap_family", sa.String(50), nullable=True),
        sa.Column(
            "last_updated",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("word"),
    )
    op.create_index("ix_word_stats_word", "word_stats", ["word"])


def downgrade() -> None:
    op.drop_table("word_stats")
    op.drop_table("daily_words")
    op.drop_table("elo_history")
    op.drop_table("moves")
    op.drop_table("games")
    op.drop_table("users")
