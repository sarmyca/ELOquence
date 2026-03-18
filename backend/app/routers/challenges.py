"""Challenges router — create and play shareable word challenges."""
from __future__ import annotations

import random
import secrets
import uuid
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
    # 8-character URL-safe code (base64url alphabet, ~47 bits of entropy)
    code = secrets.token_urlsafe(8)[:8]
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

    return _build_game_response(game).model_dump()


@router.get("/{code}/results")
async def challenge_results(
    code: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get all results for a challenge.

    Lists every player who has started (or completed) this challenge,
    ordered by number of guesses ascending (fewest guesses wins).

    The target word is only revealed in the response when every player
    that has a game record has already completed it (no in-progress games
    remain).  This prevents spoilers for ongoing participants.
    """
    result = await db.execute(select(Challenge).where(Challenge.code == code))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found.")

    games_result = await db.execute(
        select(Game, User.username)
        .join(User, Game.user_id == User.id)
        .where(Game.target_word == c.target_word, Game.mode == "challenge")
        .order_by(Game.num_guesses.asc())
    )

    entries = []
    for game, username in games_result:
        entries.append(
            {
                "username": username,
                "status": game.status,
                "num_guesses": game.num_guesses,
                "accuracy_score": game.accuracy_score,
                "is_creator": game.user_id == c.creator_id,
            }
        )

    # Only reveal the word once no participant still has an active game
    any_in_progress = any(e["status"] == "in_progress" for e in entries)

    return {
        "code": c.code,
        "word": c.target_word if not any_in_progress else None,
        "results": entries,
    }
