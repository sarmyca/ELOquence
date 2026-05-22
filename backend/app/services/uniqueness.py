"""Community uniqueness — "1 in N" comparison of a finished game.

Each completed game stores a stable fingerprint of its (target_word,
ordered guess list) on the Game row (`move_fingerprint`). The uniqueness
analytic counts how many other completed rows share the same fingerprint
and reports `1 in N`.

The fingerprint format MUST match the one used in the Alembic backfill
migration (017_game_move_fingerprint.py) — both hash:

    SHA256( UPPER(target) || "|" || ",".join(UPPER(guess) for guess in guesses) )
"""
from __future__ import annotations

import hashlib

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.game import Game


def compute_move_fingerprint(target_word: str, guesses: list[str]) -> str:
    """Return a 64-char hex SHA-256 of the (target, guess-sequence) grid."""
    payload = (
        target_word.strip().upper()
        + "|"
        + ",".join(g.strip().upper() for g in guesses)
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


async def count_grid_occurrences(db: AsyncSession, fingerprint: str) -> int:
    """Count completed games sharing this fingerprint (includes self).

    Returns at least 1 — the row we're asking about should always exist.
    Pre-migration rows without a fingerprint are excluded since their
    backfill happens once, atomically, in 017_game_move_fingerprint.
    """
    if not fingerprint:
        return 1
    result = await db.execute(
        select(func.count())
        .select_from(Game)
        .where(
            Game.move_fingerprint == fingerprint,
            Game.status.in_(("won", "lost")),
        )
    )
    return max(1, result.scalar_one() or 1)
