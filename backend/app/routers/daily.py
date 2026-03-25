"""Daily word router."""
import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.daily_word import DailyWord
from app.models.game import Game
from app.models.user import User
from app.schemas.game import GameResponse, GuessSubmit
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


@router.post("/guest", response_model=GameResponse, status_code=status.HTTP_201_CREATED)
async def start_guest_daily_game(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GameResponse:
    """Create an untracked daily game for unauthenticated guests."""
    from app.routers.games import _build_game_response
    from app.services.game import _get_or_create_daily_word

    target_word, difficulty = await _get_or_create_daily_word(db)

    game = Game(
        id=uuid.uuid4(),
        user_id=None,
        mode="daily",
        target_word=target_word,
        word_difficulty=difficulty,
        status="in_progress",
        num_guesses=0,
        rated=False,
        is_placement=False,
        constraint_violations=0,
        traps_encountered=0,
    )
    db.add(game)
    await db.flush()
    await db.refresh(game, ["moves"])
    return _build_game_response(game)


@router.get("/guest/{game_id}", response_model=GameResponse)
async def get_guest_game(
    game_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GameResponse:
    """Fetch a guest daily game by ID (no auth required)."""
    from app.routers.games import _build_game_response

    result = await db.execute(
        select(Game)
        .options(selectinload(Game.moves))
        .where(Game.id == game_id, Game.user_id.is_(None))
    )
    game = result.scalar_one_or_none()
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")
    return _build_game_response(game)


@router.post("/guest/{game_id}/guess")
async def guest_guess(
    game_id: uuid.UUID,
    payload: GuessSubmit,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Submit a guess for a guest daily game (no auth required)."""
    from app.analysis.engine import compute_pattern, is_valid_word
    from app.models.move import Move
    from app.routers.games import _build_game_response

    result = await db.execute(
        select(Game)
        .options(selectinload(Game.moves))
        .where(Game.id == game_id, Game.user_id.is_(None))
    )
    game = result.scalar_one_or_none()
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")
    if game.status != "in_progress":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game is already finished.")

    guess = payload.guess
    if not is_valid_word(guess):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Not a valid word.")

    pattern = compute_pattern(guess, game.target_word)
    move_number = len(game.moves) + 1

    move = Move(
        id=uuid.uuid4(),
        game_id=game.id,
        move_number=move_number,
        guess_word=guess,
        pattern=pattern,
    )
    db.add(move)
    game.num_guesses = move_number

    # Check win/loss
    if guess == game.target_word:
        game.status = "won"
    elif move_number >= 6:
        game.status = "lost"

    await db.flush()
    await db.refresh(game, ["moves"])

    response = _build_game_response(game)
    return response.model_dump()


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
