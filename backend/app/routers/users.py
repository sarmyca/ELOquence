"""Users router — per-user ELO history and detailed stats."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.achievement import Achievement
from app.models.elo_history import EloHistory
from app.models.game import Game
from app.models.move import Move
from app.models.user import User
from app.services.auth import get_current_user, verify_password


class _PasswordConfirm(BaseModel):
    """Body schema for step-up auth on destructive endpoints.

    Local-password users must re-supply their password. Google-only users
    (no `password_hash`) confirm by sending a token field equal to their
    username — the rationale being that they've already proven Google
    ownership at login and we just want a deliberate, copy-paste-resistant
    confirmation step.
    """

    password: str | None = Field(default=None, min_length=1, max_length=200)
    confirm_username: str | None = Field(default=None, max_length=80)


async def _require_step_up(user: User, body: _PasswordConfirm) -> None:
    """Block destructive actions unless the caller proves fresh possession.

    Raises 401 on missing/wrong credentials so a stolen Bearer alone is
    never enough to wipe an account or its history.
    """
    if user.password_hash:
        if not body.password or not await verify_password(body.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Password confirmation required.",
            )
    else:
        # Google-only account: ask for username re-entry as a deliberate confirm step.
        if not body.confirm_username or body.confirm_username.strip().lower() != (user.username or "").lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username confirmation required.",
            )

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
    # A "win" = gained ELO (positive elo_delta), not just status == "won"
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
                Game.rated == True,  # noqa: E712
                Game.elo_delta.isnot(None),
                Game.elo_delta > 0,
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
        "longest_streak": current_user.max_streak,
    }


@router.delete("/me/games")
async def delete_all_games(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    body: Annotated[_PasswordConfirm, Body()] = _PasswordConfirm(),
) -> dict:
    """Delete all past games for the current user.

    Requires step-up auth (password re-entry or username confirmation) so a
    stolen Bearer alone cannot wipe history.

    ELO rating and ELO history are preserved — players cannot manipulate
    their rating by deleting games.

    Deletion order respects FK constraints:
    1. Moves (FK → games)
    2. Games

    After deletion the streak counters and games_played are reset.

    Args:
        current_user: The currently authenticated user.
        db: Async database session.

    Returns:
        Dict with a confirmation message and the number of games deleted.
    """
    await _require_step_up(current_user, body)

    game_ids_result = await db.execute(
        select(Game.id).where(Game.user_id == current_user.id)
    )
    game_ids = game_ids_result.scalars().all()
    games_deleted = len(game_ids)

    if game_ids:
        # 1. Delete moves that belong to the user's games.
        await db.execute(
            delete(Move).where(Move.game_id.in_(game_ids))
        )

        # 2. Null out game_id references in ELO history (keep the history).
        await db.execute(
            EloHistory.__table__.update()
            .where(EloHistory.user_id == current_user.id)
            .values(game_id=None)
        )

        # 3. Delete the games themselves.
        await db.execute(
            delete(Game).where(Game.user_id == current_user.id)
        )

    # Reset game-related counters but preserve ELO.
    current_user.games_played = 0
    current_user.current_streak = 0
    current_user.max_streak = 0
    current_user.last_played_date = None

    await db.commit()

    return {"message": "All game data deleted", "games_deleted": games_deleted}


@router.delete("/me")
async def delete_account(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    body: Annotated[_PasswordConfirm, Body()] = _PasswordConfirm(),
) -> dict:
    """Permanently delete the authenticated user's account and all associated data.

    Requires step-up auth (password re-entry, or username confirmation for
    Google-only accounts). A stolen Bearer cannot delete an account on its
    own.

    Deletion order respects FK constraints:
    1. Moves (via game_id subquery)
    2. EloHistory (by user_id, before games are dropped)
    3. Games (by user_id)
    4. User record

    Args:
        current_user: The currently authenticated user.
        db: Async database session.
        body: Step-up confirmation (password or username).

    Returns:
        Dict with a confirmation message.
    """
    await _require_step_up(current_user, body)

    # Resolve the user's game IDs once so we can bulk-delete moves.
    game_ids_result = await db.execute(
        select(Game.id).where(Game.user_id == current_user.id)
    )
    game_ids = game_ids_result.scalars().all()

    if game_ids:
        # 1. Delete moves belonging to the user's games.
        await db.execute(
            delete(Move).where(Move.game_id.in_(game_ids))
        )

    # 2. Delete all ELO history rows for this user (must precede game deletion
    #    because elo_history.game_id uses ondelete=SET NULL, not CASCADE).
    await db.execute(
        delete(EloHistory).where(EloHistory.user_id == current_user.id)
    )

    if game_ids:
        # 3. Delete the games.
        await db.execute(
            delete(Game).where(Game.user_id == current_user.id)
        )

    # 4. Delete achievements.
    await db.execute(
        delete(Achievement).where(Achievement.user_id == current_user.id)
    )

    # 5. Delete the user record itself.
    await db.delete(current_user)

    await db.commit()

    return {"message": "Account deleted"}
