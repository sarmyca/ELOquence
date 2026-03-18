"""Users router — per-user ELO history and detailed stats."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.elo_history import EloHistory
from app.models.game import Game
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/elo-history")
async def elo_history(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(default=30, ge=1, le=365),
) -> list[dict]:
    """Return the authenticated user's ELO history for the past N days.

    Args:
        current_user: The currently authenticated user.
        db: Async database session.
        days: Number of past days to include (1–365, default 30).

    Returns:
        List of ELO change events ordered by recorded_at ascending.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(EloHistory)
        .where(
            EloHistory.user_id == current_user.id,
            EloHistory.recorded_at >= cutoff,
        )
        .order_by(EloHistory.recorded_at.asc())
    )
    entries = result.scalars().all()
    return [
        {
            "elo_before": e.elo_before,
            "elo_after": e.elo_after,
            "delta": e.delta,
            "accuracy_score": e.accuracy_score,
            "recorded_at": e.recorded_at.isoformat(),
        }
        for e in entries
    ]


@router.get("/me/stats")
async def user_stats(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Return detailed player stats including guess distribution and mode breakdown.

    Args:
        current_user: The currently authenticated user.
        db: Async database session.

    Returns:
        Dict with guess_distribution, losses, avg_accuracy, mode_stats,
        best_accuracy, total_games, current_streak, and longest_streak.
    """
    # Guess distribution (wins by number of guesses 1–6)
    guess_dist: dict[str, int] = {}
    for i in range(1, 7):
        count_result = await db.execute(
            select(func.count()).select_from(Game).where(
                Game.user_id == current_user.id,
                Game.status == "won",
                Game.num_guesses == i,
            )
        )
        guess_dist[str(i)] = count_result.scalar_one()

    # Loss count
    loss_result = await db.execute(
        select(func.count()).select_from(Game).where(
            Game.user_id == current_user.id,
            Game.status == "lost",
        )
    )
    losses: int = loss_result.scalar_one()

    # Average accuracy across all completed games that have an accuracy score
    avg_acc_result = await db.execute(
        select(func.avg(Game.accuracy_score)).where(
            Game.user_id == current_user.id,
            Game.accuracy_score.isnot(None),
        )
    )
    avg_accuracy: float = avg_acc_result.scalar_one() or 0.0

    # Win rate broken down by game mode
    mode_stats: dict[str, dict] = {}
    for mode in ("daily", "competitive", "practice"):
        total_result = await db.execute(
            select(func.count()).select_from(Game).where(
                Game.user_id == current_user.id,
                Game.mode == mode,
                Game.status.in_(["won", "lost"]),
            )
        )
        total: int = total_result.scalar_one()

        won_result = await db.execute(
            select(func.count()).select_from(Game).where(
                Game.user_id == current_user.id,
                Game.mode == mode,
                Game.status == "won",
            )
        )
        won: int = won_result.scalar_one()

        mode_stats[mode] = {
            "total": total,
            "won": won,
            "win_rate": round(won / total * 100, 1) if total > 0 else 0.0,
        }

    # Best single-game accuracy
    best_result = await db.execute(
        select(Game.accuracy_score, Game.target_word)
        .where(
            Game.user_id == current_user.id,
            Game.accuracy_score.isnot(None),
        )
        .order_by(Game.accuracy_score.desc())
        .limit(1)
    )
    best = best_result.first()

    return {
        "guess_distribution": guess_dist,
        "losses": losses,
        "avg_accuracy": round(avg_accuracy, 1),
        "mode_stats": mode_stats,
        "best_accuracy": {"score": best[0], "word": best[1]} if best else None,
        "total_games": current_user.games_played,
        "current_streak": current_user.current_streak,
        "longest_streak": current_user.longest_streak,
    }
