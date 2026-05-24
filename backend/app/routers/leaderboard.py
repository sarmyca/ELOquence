"""Leaderboard router — global rankings and neighbourhood view."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.game import Game
from app.models.move import Move
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


def _user_with_wins_query():
    """Base query: users joined with their 'ELO win' count.

    A win is defined as any rated game where the player gained ELO
    (positive elo_delta), regardless of whether they actually solved
    the word.
    """
    wins_subq = (
        select(
            Game.user_id,
            func.count().label("wins"),
        )
        .where(
            Game.rated == True,  # noqa: E712
            Game.elo_delta.isnot(None),
            Game.elo_delta > 0,
        )
        .group_by(Game.user_id)
        .subquery()
    )
    return (
        select(
            User.id.label("user_id"),
            User.username,
            User.elo_rating,
            User.games_played,
            func.coalesce(wins_subq.c.wins, 0).label("wins"),
        )
        .outerjoin(wins_subq, User.id == wins_subq.c.user_id)
        .where(User.games_played > 0)
    )


def _row_to_entry(row, rank: int) -> dict:
    return {
        "rank": rank,
        "user_id": str(row.user_id),
        "username": row.username,
        "elo_rating": row.elo_rating,
        "games_played": row.games_played,
        "wins": row.wins,
    }


@router.get("/")
async def global_leaderboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
) -> list:
    """Return paginated global rankings ordered by ELO descending."""
    offset = (page - 1) * per_page

    q = (
        _user_with_wins_query()
        .order_by(User.elo_rating.desc())
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(q)
    rows = result.all()

    return [_row_to_entry(row, offset + idx + 1) for idx, row in enumerate(rows)]


@router.get("/near-me")
async def near_me(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list:
    """Return 5 players above, the current user, and 5 below."""
    # Users ranked above (higher ELO)
    above_q = (
        _user_with_wins_query()
        .where(User.elo_rating > current_user.elo_rating)
        .order_by(User.elo_rating.asc())
        .limit(5)
    )
    above_rows = list((await db.execute(above_q)).all())
    above_rows.reverse()

    # Users ranked below (lower ELO)
    below_q = (
        _user_with_wins_query()
        .where(User.elo_rating < current_user.elo_rating)
        .order_by(User.elo_rating.desc())
        .limit(5)
    )
    below_rows = list((await db.execute(below_q)).all())

    # Current user's rank
    rank_result = await db.execute(
        select(func.count())
        .select_from(User)
        .where(User.games_played > 0, User.elo_rating > current_user.elo_rating)
    )
    my_rank = (rank_result.scalar_one() or 0) + 1

    # Current user's wins (positive ELO delta = win)
    wins_result = await db.execute(
        select(func.count())
        .select_from(Game)
        .where(
            Game.user_id == current_user.id,
            Game.rated == True,  # noqa: E712
            Game.elo_delta.isnot(None),
            Game.elo_delta > 0,
        )
    )
    my_wins = wins_result.scalar_one() or 0

    entries = []
    for i, row in enumerate(above_rows):
        entries.append(_row_to_entry(row, my_rank - len(above_rows) + i))

    entries.append({
        "rank": my_rank,
        "user_id": str(current_user.id),
        "username": current_user.username,
        "elo_rating": current_user.elo_rating,
        "games_played": current_user.games_played,
        "wins": my_wins,
    })

    for i, row in enumerate(below_rows):
        entries.append(_row_to_entry(row, my_rank + i + 1))

    return entries


@router.get("/openers")
async def opener_leaderboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=20, ge=1, le=100),
) -> dict:
    """Most-played opening words across all completed games.

    Returns popularity, solve rate, and average win-length so players can
    benchmark their own opener choice against what the community uses.
    """
    total_q = await db.execute(
        select(func.count(func.distinct(Game.id)))
        .select_from(Game)
        .join(Move, Move.game_id == Game.id)
        .where(Game.status.in_(("won", "lost")))
    )
    total = int(total_q.scalar_one() or 0)
    if total == 0:
        return {"total_games": 0, "openers": []}

    rows_q = (
        select(
            func.upper(Move.guess_word).label("opener"),
            func.count(func.distinct(Game.id)).label("plays"),
            func.sum(case((Game.status == "won", 1), else_=0)).label("wins"),
            func.avg(
                case((Game.status == "won", Game.num_guesses), else_=None)
            ).label("avg_guesses_win"),
        )
        .select_from(Game)
        .join(Move, Move.game_id == Game.id)
        .where(
            Game.status.in_(("won", "lost")),
            Move.move_number == 1,
        )
        .group_by(func.upper(Move.guess_word))
        .order_by(func.count(func.distinct(Game.id)).desc())
        .limit(limit)
    )
    result = await db.execute(rows_q)

    openers = []
    for rank, row in enumerate(result.all(), 1):
        plays = int(row.plays)
        wins = int(row.wins or 0)
        avg = float(row.avg_guesses_win) if row.avg_guesses_win is not None else None
        openers.append({
            "rank": rank,
            "opener": row.opener,
            "plays": plays,
            "wins": wins,
            "solve_rate": round(wins / plays * 100, 1) if plays else 0.0,
            "avg_guesses_win": round(avg, 2) if avg is not None else None,
            "popularity_pct": round(plays / total * 100, 1),
        })
    return {"total_games": total, "openers": openers}
