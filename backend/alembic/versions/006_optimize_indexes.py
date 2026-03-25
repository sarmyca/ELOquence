"""Optimize database indexes for performance.

- Add composite index on games(user_id, started_at DESC) for dashboard queries
- Add index on users(elo_rating DESC) for leaderboard queries
- Drop redundant ix_users_email and ix_users_username (UNIQUE constraints already cover these)
- Drop now-redundant ix_games_user_id (replaced by composite)

Revision ID: 006
Revises: 005
Create Date: 2026-03-18
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Composite index for dashboard "recent games" query
    op.create_index(
        "ix_games_user_id_started_at",
        "games",
        ["user_id", sa.text("started_at DESC")],
    )
    # Drop old single-column index now covered by composite
    op.drop_index("ix_games_user_id", table_name="games")

    # Leaderboard index
    op.create_index(
        "ix_users_elo_rating",
        "users",
        [sa.text("elo_rating DESC")],
    )

    # Drop redundant indexes (UNIQUE constraints already provide these)
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_username", table_name="users")


def downgrade() -> None:
    # Restore redundant indexes
    op.create_index("ix_users_username", "users", ["username"])
    op.create_index("ix_users_email", "users", ["email"])

    # Drop leaderboard index
    op.drop_index("ix_users_elo_rating", table_name="users")

    # Restore old single-column index, drop composite
    op.create_index("ix_games_user_id", "games", ["user_id"])
    op.drop_index("ix_games_user_id_started_at", table_name="games")
