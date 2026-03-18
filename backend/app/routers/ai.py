"""AI coach router — move explanations, game summaries, and chat.

All endpoints require a valid Bearer token.

Rate limiting for coach chat is enforced with an in-memory dict keyed by
``(user_id, game_id)``.  The dict is module-level and resets on process
restart, which is intentional — per-session limits only.
"""
from __future__ import annotations

import asyncio
import uuid
from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.game import Game
from app.models.move import Move
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter(prefix="/ai", tags=["ai"])

# ---------------------------------------------------------------------------
# In-memory rate-limit store
# (user_id_str, game_id_str) -> {"per_game": int, "daily": int, "date": str}
# ---------------------------------------------------------------------------
_chat_usage: dict[tuple[str, str], dict] = defaultdict(
    lambda: {"per_game": 0, "daily": 0, "date": ""}
)

_CHAT_LIMIT_PER_GAME = 10
_CHAT_LIMIT_DAILY = 30


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class MoveExplainRequest(BaseModel):
    """Payload for the explain-move endpoint.

    Attributes:
        game_id: UUID string of the game.
        move_number: 1-based move index to explain.
    """

    game_id: str
    move_number: int


class CoachChatRequest(BaseModel):
    """Payload for the coach-chat endpoint.

    Attributes:
        message: The player's latest message.
        history: Prior turns as ``[{"role": "user"|"assistant", "content": "..."}]``.
    """

    message: str
    history: list[dict] = []


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _require_ai() -> None:
    """Raise 503 if AI features are unavailable."""
    from app.services.ai import _ai_available  # noqa: PLC0415

    if not _ai_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI features unavailable — no API key configured.",
        )


def _build_game_context(game: Game, analysis: dict) -> str:
    """Serialise game + analysis data into a compact context string for the coach."""
    lines = [
        f"Target word: {game.target_word}",
        f"Result: {game.status} in {game.num_guesses} guesses",
        f"Accuracy: {analysis.get('accuracy_score', 0):.1f}%",
        f"Luck factor: {analysis.get('luck_factor', 0):.3f}",
        "",
        "Moves:",
    ]
    for m in analysis.get("moves", []):
        lines.append(
            f"  Move {m['move_number']}: {m['guess_word']} ({m['classification']},"
            f" eff {m.get('efficiency_ratio', 0) * 100:.0f}%,"
            f" {m.get('remaining_words', '?')}->{m.get('remaining_after', '?')} words)"
        )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/explain-move")
async def explain_move_endpoint(
    payload: MoveExplainRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get an AI explanation for a specific move in a completed game.

    The response is cached — identical positions across games return instantly.

    Returns:
        ``{"explanation": "..."}``
    """
    _require_ai()
    from app.analysis import analyze_game
    from app.services.ai import explain_move

    game_uuid = uuid.UUID(payload.game_id)
    result = await db.execute(
        select(Game)
        .options(selectinload(Game.moves))
        .where(Game.id == game_uuid, Game.user_id == current_user.id)
    )
    game = result.scalar_one_or_none()
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")
    if game.status == "in_progress":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot explain a move in an in-progress game.",
        )

    moves_data = [
        {"guess_word": m.guess_word, "pattern": m.pattern, "move_number": m.move_number}
        for m in sorted(game.moves, key=lambda m: m.move_number)
    ]
    analysis = analyze_game(moves_data, game.target_word)

    move_result = next(
        (m for m in analysis["moves"] if m["move_number"] == payload.move_number), None
    )
    if move_result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Move {payload.move_number} not found in this game.",
        )

    explanation = await explain_move(db, move_result, current_user.elo_rating)
    return {"explanation": explanation}


@router.post("/game-summary/{game_id}")
async def game_summary_endpoint(
    game_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get an AI post-game summary with detected strategic patterns.

    Returns:
        ``{"summary": "...", "patterns": [...]}``
    """
    _require_ai()
    from app.analysis import analyze_game
    from app.analysis.patterns import detect_strategic_patterns
    from app.services.ai import generate_game_summary

    result = await db.execute(
        select(Game)
        .options(selectinload(Game.moves))
        .where(Game.id == game_id, Game.user_id == current_user.id)
    )
    game = result.scalar_one_or_none()
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")
    if game.status == "in_progress":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot summarize an in-progress game.",
        )

    moves_data = [
        {"guess_word": m.guess_word, "pattern": m.pattern, "move_number": m.move_number}
        for m in sorted(game.moves, key=lambda m: m.move_number)
    ]
    analysis = analyze_game(moves_data, game.target_word)

    game_data = {
        "target_word": game.target_word,
        "status": game.status,
        "num_guesses": game.num_guesses,
    }

    summary = await generate_game_summary(db, analysis, game_data, current_user.elo_rating)
    patterns = detect_strategic_patterns(analysis["moves"], current_user.elo_rating)

    return {"summary": summary, "patterns": patterns}


@router.post("/coach-chat/{game_id}")
async def coach_chat_endpoint(
    game_id: uuid.UUID,
    payload: CoachChatRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Send a message to the AI coach for a specific game.

    Rate limited to 10 messages per game session and 30 per day (in-memory,
    resets on server restart).

    Returns:
        ``{"response": "..."}``
    """
    _require_ai()
    from app.analysis import analyze_game
    from app.services.ai import coach_chat_message

    # ------------------------------------------------------------------
    # Rate limiting
    # ------------------------------------------------------------------
    from datetime import date

    today = date.today().isoformat()
    usage_key = (str(current_user.id), str(game_id))
    usage = _chat_usage[usage_key]

    # Reset daily counter if it is a new day
    if usage["date"] != today:
        usage["daily"] = 0
        usage["date"] = today

    if usage["per_game"] >= _CHAT_LIMIT_PER_GAME:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Coach chat limit reached for this game ({_CHAT_LIMIT_PER_GAME} messages).",
        )
    if usage["daily"] >= _CHAT_LIMIT_DAILY:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily coach chat limit reached ({_CHAT_LIMIT_DAILY} messages per day).",
        )

    # ------------------------------------------------------------------
    # Load game + build context
    # ------------------------------------------------------------------
    result = await db.execute(
        select(Game)
        .options(selectinload(Game.moves))
        .where(Game.id == game_id, Game.user_id == current_user.id)
    )
    game = result.scalar_one_or_none()
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    moves_data = [
        {"guess_word": m.guess_word, "pattern": m.pattern, "move_number": m.move_number}
        for m in sorted(game.moves, key=lambda m: m.move_number)
    ]

    if moves_data:
        analysis = analyze_game(moves_data, game.target_word)
        game_context = _build_game_context(game, analysis)
    else:
        game_context = f"Target word: {game.target_word}\nNo moves played yet."

    # ------------------------------------------------------------------
    # Call LLM in thread pool (blocking SDK)
    # ------------------------------------------------------------------
    response_text = await asyncio.to_thread(
        coach_chat_message,
        game_context,
        payload.history,
        payload.message,
        current_user.elo_rating,
    )

    # Increment usage counters only after a successful call
    usage["per_game"] += 1
    usage["daily"] += 1

    return {"response": response_text}
