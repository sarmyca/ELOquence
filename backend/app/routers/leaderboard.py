"""Leaderboard router — global rankings and neighbourhood view."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.game import Game
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


def _user_with_wins_query():
    """Base query: users joined with their rated-win count."""
    wins_subq = (
        select(
            Game.user_id,
            func.count().label("wins"),
        )
        .where(Game.status == "won", Game.rated == True)  # noqa: E712
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

    # Current user's wins
    wins_result = await db.execute(
        select(func.count())
        .select_from(Game)
        .where(
            Game.user_id == current_user.id,
            Game.status == "won",
            Game.rated == True,  # noqa: E712
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
