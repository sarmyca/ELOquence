"""Leaderboard router — global rankings and neighbourhood view."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("/")
async def global_leaderboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
) -> dict:
    """Return paginated global rankings ordered by ELO descending."""
    offset = (page - 1) * per_page

    result = await db.execute(
        select(User)
        .where(User.games_played > 0)
        .order_by(User.elo_rating.desc())
        .offset(offset)
        .limit(per_page)
    )
    users = list(result.scalars().all())

    count_result = await db.execute(
        select(func.count()).select_from(User).where(User.games_played > 0)
    )
    total = count_result.scalar_one()

    rankings = [
        {
            "rank": offset + idx + 1,
            "user": UserResponse.model_validate(u),
        }
        for idx, u in enumerate(users)
    ]

    return {"rankings": rankings, "total": total, "page": page, "per_page": per_page}


@router.get("/near-me")
async def near_me(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Return 5 players above and 5 below the current user's ELO."""
    # Users ranked above
    above_result = await db.execute(
        select(User)
        .where(User.games_played > 0, User.elo_rating > current_user.elo_rating)
        .order_by(User.elo_rating.asc())
        .limit(5)
    )
    above = list(above_result.scalars().all())

    # Users ranked below
    below_result = await db.execute(
        select(User)
        .where(User.games_played > 0, User.elo_rating < current_user.elo_rating)
        .order_by(User.elo_rating.desc())
        .limit(5)
    )
    below = list(below_result.scalars().all())

    # Compute the current user's global rank
    rank_result = await db.execute(
        select(func.count())
        .select_from(User)
        .where(User.games_played > 0, User.elo_rating > current_user.elo_rating)
    )
    rank = (rank_result.scalar_one() or 0) + 1

    return {
        "above": [UserResponse.model_validate(u) for u in reversed(above)],
        "current_user": UserResponse.model_validate(current_user),
        "current_rank": rank,
        "below": [UserResponse.model_validate(u) for u in below],
    }
