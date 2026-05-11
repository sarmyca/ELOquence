"""Daily word router."""
import uuid
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
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

    # Check whether the user already has a non-abandoned daily game today
    played_result = await db.execute(
        select(Game).where(
            Game.user_id == current_user.id,
            Game.mode == "daily",
            func.date(Game.created_at) == today,
            Game.status != "abandoned",
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


@router.get("/archive")
async def get_archive_month(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: Annotated[int, Query(ge=2021, le=9999)],
    month: Annotated[int, Query(ge=1, le=12)],
) -> list[dict]:
    """Return archive data for a calendar month.

    Each entry: {date, puzzle_number, played, status, guesses}.
    Future dates are omitted. puzzle_number is the row id of DailyWord.
    """
    import calendar

    today = date.today()
    _, days_in_month = calendar.monthrange(year, month)

    month_start = date(year, month, 1)
    month_end = date(year, month, days_in_month)
    # Clamp to today so we never return future dates
    effective_end = min(month_end, today)

    if month_start > today:
        return []

    # Fetch all DailyWord rows for the month
    dw_result = await db.execute(
        select(DailyWord).where(
            DailyWord.date >= month_start,
            DailyWord.date <= effective_end,
        )
    )
    daily_words = {dw.date: dw for dw in dw_result.scalars().all()}

    # Fetch all non-abandoned daily games for this user in this month
    games_result = await db.execute(
        select(Game).where(
            Game.user_id == current_user.id,
            Game.mode == "daily",
            Game.status != "abandoned",
            func.date(Game.created_at) >= month_start,
            func.date(Game.created_at) <= effective_end,
        )
    )
    # Key by the calendar date of creation
    games_by_date: dict[date, Game] = {}
    for g in games_result.scalars().all():
        gdate = g.created_at.date() if g.created_at else None
        if gdate:
            games_by_date[gdate] = g

    entries: list[dict] = []
    current = month_start
    while current <= effective_end:
        dw = daily_words.get(current)
        game = games_by_date.get(current)
        entries.append(
            {
                "date": str(current),
                "puzzle_number": dw.id if dw else None,
                "played": game is not None,
                "status": game.status if game else None,
                "guesses": game.num_guesses if game else None,
            }
        )
        current += timedelta(days=1)

    return entries


class ReplayRequest(BaseModel):
    date: str  # 'YYYY-MM-DD'


@router.post("/replay", response_model=GameResponse, status_code=status.HTTP_200_OK)
async def replay_daily(
    payload: ReplayRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GameResponse:
    """Start or return an existing daily game for a historical date.

    Rejects future dates with 400.  If the user already has a non-abandoned
    game for that date, it is returned unchanged.
    """
    from app.routers.games import _build_game_response
    from app.services.word_difficulty import word_to_elo

    try:
        target_date = date.fromisoformat(payload.date)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format. Use YYYY-MM-DD.")

    today = date.today()
    if target_date > today:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot replay a future date.")

    # Check for existing non-abandoned game on that date
    existing_result = await db.execute(
        select(Game)
        .options(selectinload(Game.moves))
        .where(
            Game.user_id == current_user.id,
            Game.mode == "daily",
            func.date(Game.created_at) == target_date,
            Game.status != "abandoned",
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        return _build_game_response(existing)

    # Look up the DailyWord for that date
    dw_result = await db.execute(select(DailyWord).where(DailyWord.date == target_date))
    dw = dw_result.scalar_one_or_none()
    if dw is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No daily puzzle available for that date.")

    target_word = dw.word.upper()
    difficulty = dw.difficulty if dw.difficulty is not None else word_to_elo(target_word)

    game = Game(
        id=uuid.uuid4(),
        user_id=current_user.id,
        mode="daily",
        target_word=target_word,
        word_difficulty=difficulty,
        status="in_progress",
        num_guesses=0,
        rated=False,
        is_placement=current_user.is_placement,
        constraint_violations=0,
        traps_encountered=0,
    )
    db.add(game)
    await db.flush()
    await db.refresh(game, ["moves"])
    return _build_game_response(game)


@router.post("/play", response_model=GameResponse, status_code=status.HTTP_201_CREATED)
async def start_daily_game(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    rated: Annotated[bool, Query()] = False,
) -> GameResponse:
    """Create (or return an existing) daily game for the authenticated user."""
    from app.routers.games import _build_game_response
    from sqlalchemy.orm import selectinload

    today = date.today()

    # Return existing non-abandoned game if user already started today's daily
    played_result = await db.execute(
        select(Game)
        .options(selectinload(Game.moves))
        .where(
            Game.user_id == current_user.id,
            Game.mode == "daily",
            func.date(Game.created_at) == today,
            Game.status != "abandoned",
        )
    )
    existing = played_result.scalar_one_or_none()
    if existing:
        return _build_game_response(existing)

    # Only allow rated daily after placement is complete
    daily_rated = rated and not current_user.is_placement
    game = await create_game(db, current_user, mode="daily", daily_rated=daily_rated)
    return _build_game_response(game)
