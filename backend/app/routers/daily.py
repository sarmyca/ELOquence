"""Daily word router."""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.daily_word import DailyWord
from app.models.game import Game
from app.models.user import User
from app.schemas.game import GameResponse
from app.services.auth import get_current_user
from app.services.game import create_game

router = APIRouter(prefix="/daily", tags=["daily"])


@router.get("/")
async def get_daily_info(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Return today's daily word metadata and whether the user has already played."""
    today = date.today()

    daily_result = await db.execute(select(DailyWord).where(DailyWord.date == today))
    daily = daily_result.scalar_one_or_none()

    # Check whether the user already has a daily game today
    played_result = await db.execute(
        select(Game).where(
            Game.user_id == current_user.id,
            Game.mode == "daily",
            func.date(Game.created_at) == today,
        )
    )
    existing_game = played_result.scalar_one_or_none()

    return {
        "date": str(today),
        "word_available": daily is not None,
        "difficulty": daily.difficulty if daily else None,
        "already_played": existing_game is not None,
        "existing_game_id": str(existing_game.id) if existing_game else None,
    }


@router.post("/play", response_model=GameResponse, status_code=status.HTTP_201_CREATED)
async def start_daily_game(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GameResponse:
    """Create (or return an existing) daily game for the authenticated user."""
    from app.routers.games import _build_game_response
    from sqlalchemy.orm import selectinload

    today = date.today()

    # Return existing game if user already started today's daily
    played_result = await db.execute(
        select(Game)
        .options(selectinload(Game.moves))
        .where(
            Game.user_id == current_user.id,
            Game.mode == "daily",
            func.date(Game.created_at) == today,
        )
    )
    existing = played_result.scalar_one_or_none()
    if existing:
        return _build_game_response(existing)

    game = await create_game(db, current_user, mode="daily")
    return _build_game_response(game)
