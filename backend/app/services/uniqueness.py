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
from app.models.move import Move


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


async def compute_opener_rarity(
    db: AsyncSession, opener_word: str
) -> tuple[int, int, int]:
    """How rare was this opening word across all completed games.

    Whole-grid uniqueness is too granular — every distinct guess sequence
    is its own grid, so the count is almost always 1, which makes the
    panel useless. Openers, on the other hand, cluster heavily (CRANE,
    SLATE, SALET) so this metric actually shows variance.

    Returns:
        (rarity_pct, same_count, total_count)
        - rarity_pct: percent of completed games that started with a
          DIFFERENT opener (0 = everyone uses your opener, 100 = no one
          else did).
        - same_count: completed games whose first move == this opener.
        - total_count: completed games with at least one recorded move.
    """
    if not opener_word:
        return 0, 0, 0
    opener_upper = opener_word.strip().upper()

    total_result = await db.execute(
        select(func.count(func.distinct(Game.id)))
        .select_from(Game)
        .join(Move, Move.game_id == Game.id)
        .where(Game.status.in_(("won", "lost")))
    )
    total = int(total_result.scalar_one() or 0)
    if total == 0:
        return 0, 0, 0

    same_result = await db.execute(
        select(func.count(func.distinct(Game.id)))
        .select_from(Game)
        .join(Move, Move.game_id == Game.id)
        .where(
            Game.status.in_(("won", "lost")),
            Move.move_number == 1,
            func.upper(Move.guess_word) == opener_upper,
        )
    )
    same = int(same_result.scalar_one() or 0)

    rarity_pct = round((total - same) / total * 100) if total > 0 else 0
    return rarity_pct, same, total
