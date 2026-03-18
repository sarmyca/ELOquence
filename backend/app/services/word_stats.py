"""Word stats service — update and retrieve community statistics per word."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.word_stats import WordStats


async def update_word_stats(
    db: AsyncSession,
    target_word: str,
    num_guesses: int,
    won: bool,
    accuracy_score: float | None,
) -> None:
    """Update community stats for a word after a game completes.

    Uses an incremental (Welford-style) running mean so no historical data
    needs to be re-read.  Safe to call concurrently — the caller is
    responsible for wrapping in try/except so this never blocks game
    completion.

    Args:
        db: Active async session (already inside the game transaction).
        target_word: The answer word for the finished game.
        num_guesses: Total guesses used by the player.
        won: Whether the player solved the word.
        accuracy_score: Optional information-theory accuracy (0–100).
    """
    word_lower = target_word.lower()
    result = await db.execute(select(WordStats).where(WordStats.word == word_lower))
    stats = result.scalar_one_or_none()

    if not stats:
        stats = WordStats(
            id=uuid.uuid4(),
            word=word_lower,
            times_played=0,
            times_solved=0,
        )
        db.add(stats)

    stats.times_played += 1
    if won:
        stats.times_solved += 1

    # Rolling average for guesses (wins only)
    if won and stats.avg_guesses is not None:
        # Incremental mean: new_avg = old_avg + (x - old_avg) / n
        n = stats.times_solved
        stats.avg_guesses = stats.avg_guesses + (num_guesses - stats.avg_guesses) / n
    elif won:
        stats.avg_guesses = float(num_guesses)

    # Rolling average for accuracy (all games)
    if accuracy_score is not None:
        if stats.avg_accuracy is not None:
            n = stats.times_played
            stats.avg_accuracy = stats.avg_accuracy + (accuracy_score - stats.avg_accuracy) / n
        else:
            stats.avg_accuracy = accuracy_score

    stats.last_updated = datetime.now(timezone.utc)
    await db.flush()


async def get_word_stats(db: AsyncSession, word: str) -> dict | None:
    """Get community statistics for a word.

    Args:
        db: Active async session.
        word: The target word (case-insensitive).

    Returns:
        Dict with community stats, or ``None`` if no record exists yet.
    """
    result = await db.execute(select(WordStats).where(WordStats.word == word.lower()))
    stats = result.scalar_one_or_none()
    if not stats:
        return None

    solve_rate = (stats.times_solved / stats.times_played * 100) if stats.times_played > 0 else 0
    return {
        "word": stats.word,
        "times_played": stats.times_played,
        "times_solved": stats.times_solved,
        "solve_rate": round(solve_rate, 1),
        "avg_guesses": round(stats.avg_guesses, 2) if stats.avg_guesses is not None else None,
        "avg_accuracy": round(stats.avg_accuracy, 1) if stats.avg_accuracy is not None else None,
        "difficulty": stats.calibrated_difficulty or stats.tree_difficulty,
    }
