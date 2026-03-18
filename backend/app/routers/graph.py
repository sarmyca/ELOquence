"""Graph router — build and explore game state graphs for DFA visualisation."""
from __future__ import annotations

import asyncio
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.game import Game
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter(prefix="/graph", tags=["graph"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class ExploreRequest(BaseModel):
    """Payload for the /explore endpoint."""

    state_hash: str = Field(
        ...,
        description="12-character hex hash of the source state (returned by /build).",
    )
    guess: str = Field(
        ...,
        min_length=5,
        max_length=5,
        description="5-letter guess word to explore from the given state.",
    )

    @field_validator("guess")
    @classmethod
    def upper(cls, v: str) -> str:
        """Normalise guess to uppercase before validation."""
        return v.upper()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/games/{game_id}/build")
async def build_game_graph(
    game_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Build the full game state graph for a completed game.

    Constructs a directed acyclic graph where each node represents an
    information state (the set of words still consistent with the clues seen
    so far) and each edge represents a guess.  The response includes:

    - The player's actual path through the state space.
    - The engine's optimal path for comparison.
    - The top-5 alternative guesses branching from every node on the
      player's path (expanded one level deep).

    The resulting states are cached in-process so that subsequent calls to
    ``POST /api/graph/explore`` can branch further without rebuilding.

    Args:
        game_id: UUID of the game to analyse.
        current_user: Authenticated user (injected by FastAPI).
        db: Async database session (injected by FastAPI).

    Returns:
        Dict with ``nodes``, ``edges``, ``player_path_node_ids``, and
        ``optimal_path_node_ids``.

    Raises:
        404: If the game does not exist or belongs to another user.
        409: If the game is still in progress.
    """
    from app.analysis.graph import build_graph

    result = await db.execute(
        select(Game)
        .options(selectinload(Game.moves))
        .where(Game.id == game_id, Game.user_id == current_user.id)
    )
    game = result.scalar_one_or_none()

    if game is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found.",
        )

    if game.status == "in_progress":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot build a graph for an in-progress game.",
        )

    moves_data = [
        {
            "guess_word": m.guess_word,
            "pattern": m.pattern,
            "move_number": m.move_number,
        }
        for m in sorted(game.moves, key=lambda m: m.move_number)
    ]

    graph = await asyncio.to_thread(build_graph, moves_data, game.target_word)
    return graph


@router.post("/explore")
async def explore_state(
    payload: ExploreRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Explore an alternative branch from a previously cached game state.

    Allows the frontend to let users interactively try alternative guesses
    after viewing the initial graph.  The source state must have been
    created by a prior call to ``POST /api/graph/games/{game_id}/build`` (or
    a previous call to this endpoint).

    Args:
        payload: ``state_hash`` of the source node and the ``guess`` to try.
        current_user: Authenticated user (injected by FastAPI).

    Returns:
        Dict with:
        - ``new_node``: The resulting game state node.
        - ``edge``: The edge representing the guess.
        - ``merged_with``: Hash of an existing node if the resulting state
          already exists in the cache (DAG merge), otherwise ``null``.
        - ``top_picks``: Top-5 engine recommendations at the new state.

    Raises:
        404: If the source state hash is not found in the cache.
        422: If the guess is not a valid Wordle word.
    """
    from app.analysis.graph import explore_from_state

    try:
        result = await asyncio.to_thread(explore_from_state, payload.state_hash, payload.guess)
    except ValueError as exc:
        message = str(exc)
        if "not found in cache" in message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=message,
            ) from exc
        # Invalid word or other validation error
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=message,
        ) from exc

    return result
