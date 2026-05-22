"""games.move_fingerprint + backfill

Adds a SHA-256 fingerprint of (target_word, ordered guess sequence) on
each Game row. Backfills existing completed games so the uniqueness
analytic can do a real `COUNT(*) WHERE fingerprint = :fp` query instead
of returning a hash-based pseudo-random number.

Revision ID: 017_game_move_fingerprint
Revises: 016_admin_audit_log
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa


revision = "017_game_move_fingerprint"
down_revision = "016_admin_audit_log"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # pgcrypto provides DIGEST() — used below for the SQL-side SHA-256
    # backfill. The extension is safe to create unconditionally.
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.add_column(
        "games",
        sa.Column("move_fingerprint", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_games_move_fingerprint",
        "games",
        ["move_fingerprint"],
    )

    # Backfill: SHA-256 of upper(target_word) || '|' || concat of upper guesses
    # in move_number order, separated by ','. Computed in pure SQL so it
    # works even if the Python service is offline during the migration.
    op.execute(
        """
        WITH grid AS (
            SELECT
                g.id AS game_id,
                g.target_word,
                STRING_AGG(UPPER(m.guess_word), ',' ORDER BY m.move_number) AS guesses
            FROM games g
            JOIN moves m ON m.game_id = g.id
            WHERE g.status IN ('won', 'lost')
            GROUP BY g.id, g.target_word
        )
        UPDATE games
           SET move_fingerprint = ENCODE(
               DIGEST(UPPER(grid.target_word) || '|' || grid.guesses, 'sha256'),
               'hex'
           )
          FROM grid
         WHERE games.id = grid.game_id;
        """
    )


def downgrade() -> None:
    op.drop_index("ix_games_move_fingerprint", table_name="games")
    op.drop_column("games", "move_fingerprint")
