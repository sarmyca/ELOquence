"""Daily word router."""
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
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
from app.services.rate_limit import check_rate_limit


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"

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
    today_word = daily.word.upper() if daily else None

    # Check whether the user already has a non-abandoned daily game for TODAY's
    # actual puzzle word. Matching by target_word avoids confusing archive-replay
    # games (created_at=today but representing a past puzzle) with the real daily.
    # If duplicates exist, prefer the one with the most moves.
    existing_game = None
    if today_word is not None:
        played_result = await db.execute(
            select(Game).where(
                Game.user_id == current_user.id,
                Game.mode == "daily",
                Game.target_word == today_word,
                func.date(Game.created_at) == today,
                Game.status != "abandoned",
            )
        )
        played_rows = list(played_result.scalars().all())
        played_rows.sort(key=lambda g: (g.num_guesses, g.created_at), reverse=True)
        existing_game = played_rows[0] if played_rows else None

    return {
        "date": str(today),
        "word_available": daily is not None,
        "difficulty": daily.difficulty if daily else None,
        "already_played": existing_game is not None,
        "existing_game_id": str(existing_game.id) if existing_game else None,
    }


@router.post("/guest", response_model=GameResponse, status_code=status.HTTP_201_CREATED)
async def start_guest_daily_game(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GameResponse:
    """Create an untracked daily game for unauthenticated guests.

    Per-IP throttled to 5 fresh guest games per hour. Without this cap an
    anonymous client could spawn unlimited guest dailies, brute the answer
    by losing each one (the target_word is revealed on lost games), and
    then play the official daily on their authed account knowing the
    solution — a daily-leak channel that bypasses the streak system
    entirely. 5/hour leaves room for honest guest play (try a couple of
    times, learn the rules, sign up) while making mass extraction
    infeasible.
    """
    from app.routers.games import _build_game_response
    from app.services.game import _get_or_create_daily_word

    blocked_for = check_rate_limit(
        f"daily-guest:{_client_ip(request)}",
        max_attempts=5,
        window_seconds=3600.0,
    )
    if blocked_for is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many guest games. Please sign in or try again later.",
            headers={"Retry-After": str(int(blocked_for) + 1)},
        )

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

    # Row-level lock to serialize concurrent guesses (same anti-race fix as
    # the authed submit_guess path — without it, a guest can pump multiple
    # parallel guesses per slot and reverse-engineer the target word from
    # the patterns without consuming guess budget).
    result = await db.execute(
        select(Game)
        .options(selectinload(Game.moves))
        .where(Game.id == game_id, Game.user_id.is_(None))
        .with_for_update()
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

    # Match games by target_word — this keys a daily game to its original
    # puzzle date even when the user replays an old daily today (since a
    # replay creates a new game row with `created_at = NOW()`). Without this
    # match-by-word, a replayed game would otherwise appear under the
    # replay date instead of the puzzle's actual date.
    target_words = {dw.word.upper() for dw in daily_words.values()}
    games_by_target: dict[str, Game] = {}
    if target_words:
        games_result = await db.execute(
            select(Game).where(
                Game.user_id == current_user.id,
                Game.mode == "daily",
                Game.status != "abandoned",
                Game.target_word.in_(target_words),
            )
        )
        # If a user somehow has multiple games for the same word, prefer the
        # one with the most progress (most moves), then the earliest.
        for g in games_result.scalars().all():
            tw = g.target_word.upper() if g.target_word else None
            if tw is None:
                continue
            existing = games_by_target.get(tw)
            if existing is None or (
                g.num_guesses > existing.num_guesses
                or (g.num_guesses == existing.num_guesses and g.created_at < existing.created_at)
            ):
                games_by_target[tw] = g

    entries: list[dict] = []
    current = month_start
    while current <= effective_end:
        dw = daily_words.get(current)
        game = games_by_target.get(dw.word.upper()) if dw else None
        played_on_day = False
        if game and game.created_at and dw:
            played_on_day = game.created_at.date() == dw.date
        entries.append(
            {
                "date": str(current),
                "puzzle_number": dw.id if dw else None,
                "played": game is not None,
                "status": game.status if game else None,
                "guesses": game.num_guesses if game else None,
                # True only when the daily was solved on its actual date.
                # False means it was completed later via archive replay.
                "played_on_day": played_on_day,
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

    # Check for existing non-abandoned game on that date. When duplicates exist,
    # keep the one with the MOST moves (preserve progress); tie-break by latest
    # created_at. Abandon the rest to self-heal the state.
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
    existing_games = list(existing_result.scalars().all())
    if existing_games:
        existing_games.sort(key=lambda g: (g.num_guesses, g.created_at), reverse=True)
        keep = existing_games[0]
        for older in existing_games[1:]:
            older.status = "abandoned"
            older.completed_at = datetime.now(timezone.utc)
        if len(existing_games) > 1:
            await db.flush()
        return _build_game_response(keep)

    # Look up the DailyWord for that date — lazily create one for past dates so
    # the archive is fully playable even when the daily seed table is sparse.
    dw_result = await db.execute(select(DailyWord).where(DailyWord.date == target_date))
    dw = dw_result.scalar_one_or_none()
    if dw is None:
        import hashlib
        import random as _random

        from app.analysis.engine import ANSWERS
        from app.config import settings as _settings
        from sqlalchemy.exc import IntegrityError

        # Deterministic per-date pick — but seeded with a server-side secret
        # so the mapping (date → answer) is not derivable from the source.
        # Without this, anyone with the repo could pre-compute every
        # historical replay answer and inflate streaks/achievements.
        seed_material = f"{_settings.JWT_SECRET}:{target_date.toordinal()}".encode()
        seed = int.from_bytes(hashlib.sha256(seed_material).digest()[:8], "big")
        rng = _random.Random(seed)
        chosen = rng.choice(ANSWERS).upper()
        difficulty = word_to_elo(chosen)
        dw = DailyWord(word=chosen.lower(), date=target_date, difficulty=difficulty)
        db.add(dw)
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
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
) -> GameResponse:
    """Create (or return an existing) daily game for the authenticated user.

    Daily games are always unrated — only competitive games affect ELO.
    """
    from app.routers.games import _build_game_response
    from sqlalchemy.orm import selectinload

    today = date.today()

    # Resolve today's puzzle word so we can match games by it (not just by date).
    # Archive-replay games have created_at=today but a different target_word —
    # they must NOT be confused with today's real daily.
    dw_result = await db.execute(select(DailyWord).where(DailyWord.date == today))
    today_dw = dw_result.scalar_one_or_none()
    today_word = today_dw.word.upper() if today_dw else None

    if today_word is not None:
        # Return existing non-abandoned game for TODAY's word. When duplicates
        # exist (from past code paths), keep the one with the most moves so
        # player progress isn't lost; tie-break by latest created_at. Abandon
        # the rest to self-heal.
        played_result = await db.execute(
            select(Game)
            .options(selectinload(Game.moves))
            .where(
                Game.user_id == current_user.id,
                Game.mode == "daily",
                Game.target_word == today_word,
                func.date(Game.created_at) == today,
                Game.status != "abandoned",
            )
        )
        existing_games = list(played_result.scalars().all())
        if existing_games:
            existing_games.sort(key=lambda g: (g.num_guesses, g.created_at), reverse=True)
            keep = existing_games[0]
            for older in existing_games[1:]:
                older.status = "abandoned"
                older.completed_at = datetime.now(timezone.utc)
            if len(existing_games) > 1:
                await db.flush()
            return _build_game_response(keep)

    game = await create_game(db, current_user, mode="daily")
    return _build_game_response(game)
