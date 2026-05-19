"""Games router — CRUD and guess submission."""
import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.game import GameCreate, GameListResponse, GameResponse, GuessSubmit
from app.services.auth import get_current_user
from app.services.game import abandon_game, create_game, get_game, list_games, submit_guess

router = APIRouter(prefix="/games", tags=["games"])


def _build_game_response(game) -> GameResponse:
    """Convert a Game ORM object to its API response schema.

    The ``target_word`` field is hidden while the game is in progress.
    """
    data = GameResponse.model_validate(game)
    if game.status == "in_progress":
        data.target_word = None
    return data


@router.post("/", response_model=GameResponse, status_code=status.HTTP_201_CREATED)
async def start_game(
    payload: GameCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GameResponse:
    """Create and return a new game session."""
    game = await create_game(db, current_user, payload.mode, payload.word_pool, hard_mode=payload.hard_mode)
    return _build_game_response(game)


@router.post("/{game_id}/guess")
async def make_guess(
    game_id: uuid.UUID,
    payload: GuessSubmit,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    background_tasks: BackgroundTasks,
) -> dict:
    """Submit a guess and return the updated game state.

    The response is a GameResponse payload extended with a ``newly_unlocked``
    field — a list of achievement_type strings unlocked by this guess
    (non-empty only when the game just completed).

    If the guess completes a challenge-mode game, a background task is
    queued to push-notify the challenge creator. It runs after the
    response is sent (and after this request's DB transaction commits),
    so it observes the persisted final state.
    """
    game, _move = await submit_guess(db, game_id, payload.guess, current_user)
    response = _build_game_response(game)
    result = response.model_dump()
    result["newly_unlocked"] = getattr(game, "_newly_unlocked", [])

    if game.mode == "challenge" and game.status in ("won", "lost"):
        from app.services.push import notify_challenge_completed

        background_tasks.add_task(notify_challenge_completed, game.id)

    newly_unlocked = result.get("newly_unlocked") or []
    if newly_unlocked:
        from app.services.push import notify_achievements_unlocked

        background_tasks.add_task(
            notify_achievements_unlocked, current_user.id, list(newly_unlocked)
        )

    return result


@router.get("/{game_id}", response_model=GameResponse)
async def fetch_game(
    game_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GameResponse:
    """Return a specific game (must be owned by the authenticated user)."""
    game = await get_game(db, game_id, current_user)
    return _build_game_response(game)


@router.get("/", response_model=GameListResponse)
async def games_list(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    mode: str | None = Query(default=None),
) -> GameListResponse:
    """Return a paginated list of the current user's games."""
    games, total = await list_games(db, current_user, page=page, per_page=per_page, mode=mode)
    return GameListResponse(
        games=[_build_game_response(g) for g in games],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.delete("/{game_id}", response_model=GameResponse)
async def delete_game(
    game_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GameResponse:
    """Abandon an in-progress game without affecting ELO."""
    game = await abandon_game(db, game_id, current_user)
    return _build_game_response(game)


@router.get("/{game_id}/community-stats")
async def game_community_stats(
    game_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get community statistics for the word used in a completed game.

    Returns aggregate play data (solve rate, average guesses, average
    accuracy, difficulty) drawn from all games played against that word.
    Returns a zeroed-out record if the word has never been played before.

    Raises:
        409: If the game is still in progress (word must not be revealed).
        404: If the game does not belong to the authenticated user.
    """
    game = await get_game(db, game_id, current_user)
    if game.status == "in_progress":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Game still in progress.",
        )

    from app.services.word_stats import get_word_stats

    stats = await get_word_stats(db, game.target_word)
    return stats or {
        "word": game.target_word.lower(),
        "times_played": 0,
        "times_solved": 0,
        "solve_rate": 0,
        "avg_guesses": None,
        "avg_accuracy": None,
        "difficulty": game.word_difficulty,
    }
