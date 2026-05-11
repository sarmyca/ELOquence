"""Game-related Pydantic schemas."""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class GameCreate(BaseModel):
    """Payload for starting a new game."""

    mode: Literal["daily", "competitive", "practice"]
    word_pool: Literal["standard", "competitive"] = "standard"
    hard_mode: bool = False


class GuessSubmit(BaseModel):
    """Payload for submitting a guess."""

    guess: str = Field(min_length=5, max_length=5)

    @field_validator("guess")
    @classmethod
    def guess_alpha(cls, v: str) -> str:
        if not v.isalpha():
            raise ValueError("Guess must contain only letters.")
        return v.upper()


class MoveResponse(BaseModel):
    """Public representation of a single move."""

    id: uuid.UUID
    game_id: uuid.UUID
    move_number: int
    guess_word: str
    pattern: int

    # Analysis fields — may be None until analysis is run
    remaining_words: int | None = None
    entropy_before: float | None = None
    entropy_after: float | None = None
    info_gained: float | None = None
    optimal_info: float | None = None
    optimal_word: str | None = None
    expected_remaining: float | None = None
    optimal_expected_remaining: float | None = None
    efficiency_ratio: float | None = None
    bits_lost: float | None = None
    classification: str | None = None
    game_phase: str | None = None
    constraint_violation: str | None = None
    trap_detected: bool = False
    is_book_move: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class GameResponse(BaseModel):
    """Full game representation returned by the API."""

    id: uuid.UUID
    user_id: uuid.UUID | None = None
    mode: str
    # target_word only included when game is finished
    target_word: str | None = None
    word_difficulty: float | None = None
    status: str
    num_guesses: int
    time_seconds: float | None = None
    rated: bool
    hard_mode: bool = False
    accuracy_score: float | None = None
    luck_factor: float | None = None
    elo_before: float | None = None
    elo_after: float | None = None
    elo_delta: float | None = None
    is_placement: bool
    constraint_violations: int
    traps_encountered: int
    created_at: datetime
    completed_at: datetime | None = None
    moves: list[MoveResponse] = []

    model_config = {"from_attributes": True}


class GameListResponse(BaseModel):
    """Paginated list of games."""

    games: list[GameResponse]
    total: int
    page: int
    per_page: int
