"""Challenges router — create and play shareable word challenges."""
from __future__ import annotations

import random
import secrets
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.challenge import Challenge
from app.models.game import Game
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter(prefix="/challenges", tags=["challenges"])


@router.get("/mine")
async def my_challenges(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    """Return challenges the authenticated user has participated in.

    Includes challenges the user created plus any whose target_word matches
    one of the user's challenge-mode games. Useful for re-finding a result
    page after exiting.
    """
    # Challenges the user created
    created = await db.execute(
        select(Challenge).where(Challenge.creator_id == current_user.id)
    )
    by_code: dict[str, Challenge] = {c.code: c for c in created.scalars().all()}

    # Challenges the user has played as a non-creator: match their challenge
    # games' target_words to Challenge.target_word.
    played_games = await db.execute(
        select(Game.target_word).where(
            Game.user_id == current_user.id,
            Game.mode == "challenge",
        )
    )
    target_words = {tw for (tw,) in played_games.all() if tw}
    if target_words:
        others = await db.execute(
            select(Challenge).where(Challenge.target_word.in_(target_words))
        )
        for c in others.scalars().all():
            by_code.setdefault(c.code, c)

    out = sorted(by_code.values(), key=lambda c: c.created_at, reverse=True)
    return [
        {
            "code": c.code,
            "target_word": c.target_word,
            "word_difficulty": c.word_difficulty,
            "is_creator": c.creator_id == current_user.id,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in out
    ]


@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_challenge(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Create a challenge with a randomly selected word.

    Returns a short URL-safe shareable code that other players can use to
    play the same word.  The word is NOT returned here — only the code and
    the internal challenge UUID.
    """
    from app.analysis.engine import ANSWERS
    from app.services.word_difficulty import word_to_elo

    if not ANSWERS:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Word lists not loaded.",
        )

    word = random.choice(ANSWERS).upper()
    # 11-character URL-safe code (~66 bits of entropy — token_urlsafe(8)
    # already returns 11 chars; truncating to 8 dropped 19 bits for no gain).
    code = secrets.token_urlsafe(8)
    difficulty = word_to_elo(word)

    challenge = Challenge(
        id=uuid.uuid4(),
        creator_id=current_user.id,
        target_word=word,
        word_difficulty=difficulty,
        code=code,
    )
    db.add(challenge)
    await db.flush()

    return {"code": code, "challenge_id": str(challenge.id)}


@router.get("/{code}")
async def get_challenge(
    code: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get challenge metadata by shareable code.

    The target word is never returned here (only after completion).
    The response includes whether the requesting user has already played
    this challenge, and their game_id if so.
    """
    result = await db.execute(select(Challenge).where(Challenge.code == code))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found.")

    existing = await db.execute(
        select(Game).where(
            Game.user_id == current_user.id,
            Game.target_word == c.target_word,
            Game.mode == "challenge",
        )
    )
    already_played = existing.scalar_one_or_none()

    return {
        "code": c.code,
        "creator_id": str(c.creator_id),
        "word_difficulty": c.word_difficulty,
        "already_played": already_played is not None,
        "game_id": str(already_played.id) if already_played else None,
    }


@router.post("/{code}/play", status_code=status.HTTP_201_CREATED)
async def play_challenge(
    code: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Start a new game for a challenge.

    Creates a Game record with ``mode="challenge"`` and ``rated=False`` so
    the player's ELO is not affected.  Returns the initial game state
    (target_word is hidden while in progress).

    Raises:
        404: Challenge code not found.
        409: The authenticated user has already played this challenge.
    """
    from app.routers.games import _build_game_response

    from app.services.game import abandon_game

    result = await db.execute(select(Challenge).where(Challenge.code == code))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found.")

    # Clean up any orphaned in-progress challenge games (different word) so
    # a stale challenge — caused by a tab close before the pagehide beacon
    # could land — doesn't sit pending forever. Same-word in-progress games
    # are caught by the constraint check below and reported as 409.
    stale = await db.execute(
        select(Game).where(
            Game.user_id == current_user.id,
            Game.mode == "challenge",
            Game.status == "in_progress",
            Game.target_word != c.target_word,
        )
    )
    for stale_game in stale.scalars().all():
        await abandon_game(db, stale_game.id, current_user)

    existing = await db.execute(
        select(Game).where(
            Game.user_id == current_user.id,
            Game.target_word == c.target_word,
            Game.mode == "challenge",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already played this challenge.",
        )

    game = Game(
        id=uuid.uuid4(),
        user_id=current_user.id,
        mode="challenge",
        target_word=c.target_word,
        word_difficulty=c.word_difficulty,
        status="in_progress",
        num_guesses=0,
        rated=False,
        is_placement=False,
        constraint_violations=0,
        traps_encountered=0,
    )
    db.add(game)
    await db.flush()
    # Eagerly load the (empty) moves relationship so the Pydantic response
    # builder can read it without triggering a lazy DB hit inside a sync
    # context (which causes a MissingGreenlet error).
    await db.refresh(game, ["moves"])

    return _build_game_response(game).model_dump()


@router.get("/{code}/results")
async def challenge_results(
    code: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get all results for a challenge, ranked.

    Ranking (best -> worst):
      1. Wins beat losses.
      2. Among wins: fewest guesses wins.
      3. Tiebreaker on guess count: higher accuracy wins.
      4. Final tiebreaker: faster time wins (nulls last).
      5. Losses are sorted by accuracy desc, time asc.

    Rank is computed server-side and returned on each entry so the client
    doesn't have to re-derive it. In-progress games are excluded from the
    ranked list — they don't have a final result to compare yet.

    The target word is only revealed in the response when every player
    that has a game record has already completed it (no in-progress games
    remain). This prevents spoilers for ongoing participants.
    """
    result = await db.execute(select(Challenge).where(Challenge.code == code))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found.")

    games_result = await db.execute(
        select(Game, User.username)
        .join(User, Game.user_id == User.id)
        .where(Game.target_word == c.target_word, Game.mode == "challenge")
    )
    rows = list(games_result.all())

    any_in_progress = any(g.status == "in_progress" for g, _ in rows)

    def sort_key(item):
        game, _username = item
        won = game.status == "won"
        # Tuple ordering ASC by default — invert metrics we want DESC
        # by negation. None tiebreakers go last via float('inf').
        return (
            0 if won else 1,                                # wins first
            game.num_guesses if won else 6,                 # fewer guesses better (only meaningful on wins)
            -(game.accuracy_score or 0.0),                  # higher accuracy better
            game.time_seconds if game.time_seconds is not None else float("inf"),
            game.completed_at or datetime.max,              # earlier finisher breaks final tie
        )

    ranked_rows = [(g, u) for g, u in rows if g.status != "in_progress"]
    ranked_rows.sort(key=sort_key)
    in_progress_rows = [(g, u) for g, u in rows if g.status == "in_progress"]

    entries = []
    for rank, (game, username) in enumerate(ranked_rows, start=1):
        entries.append(
            {
                "rank": rank,
                "username": username,
                "status": game.status,
                "num_guesses": game.num_guesses,
                "accuracy_score": game.accuracy_score,
                "time_seconds": game.time_seconds,
                "is_creator": game.user_id == c.creator_id,
                "completed_at": game.completed_at.isoformat() if game.completed_at else None,
            }
        )
    for game, username in in_progress_rows:
        entries.append(
            {
                "rank": None,
                "username": username,
                "status": game.status,
                "num_guesses": game.num_guesses,
                "accuracy_score": None,
                "time_seconds": None,
                "is_creator": game.user_id == c.creator_id,
                "completed_at": None,
            }
        )

    return {
        "code": c.code,
        "word": c.target_word if not any_in_progress else None,
        "results": entries,
    }
