"""Analysis-related Pydantic schemas."""
from pydantic import BaseModel


class TopPick(BaseModel):
    """One of the top-ranked guesses at a given position."""

    word: str
    entropy: float
    expected_remaining: float


class PatternBucket(BaseModel):
    """A single bucket in the pattern distribution for a guess.

    Attributes:
        pattern: Ternary-encoded pattern integer (0–242).
        count: Number of remaining words that yield this pattern.
        probability: Fraction of remaining words in this bucket.
        is_actual: True when this bucket is the one that was observed.
    """

    pattern: int
    count: int
    probability: float
    is_actual: bool = False
    words: list[str] = []


class MoveAnalysis(BaseModel):
    """Detailed analysis for a single move."""

    move_number: int
    guess_word: str
    pattern: int
    remaining_words: int
    remaining_after: int
    entropy_before: float
    entropy_after: float
    info_gained: float
    optimal_info: float
    optimal_word: str
    expected_remaining: float
    optimal_expected_remaining: float
    efficiency_ratio: float
    bits_lost: float
    classification: str
    game_phase: str
    constraint_violation: str
    constraint_violation_reason: str = ""
    trap_detected: bool
    trap_info: dict | None = None
    is_book_move: bool
    luck: float
    remaining_words_list: list[str] = []
    top_picks: list[TopPick]
    pattern_distribution: list[PatternBucket] = []
    optimal_pattern_distribution: list[PatternBucket] = []
    letter_frequencies: dict[str, dict[str, float]] = {}


class PatternDistribution(BaseModel):
    """Distribution of pattern outcomes for a guess."""

    pattern: int
    count: int
    probability: float


class GamePhaseAccuracy(BaseModel):
    """Accuracy breakdown per game phase."""

    opening: float
    midgame: float
    endgame: float


class StrategicPattern(BaseModel):
    """A detected strategic pattern from a game.

    Attributes:
        pattern_type: Machine-readable identifier (e.g. ``"green_chasing"``).
        description: Human-readable explanation shown to the player.
        severity: One of ``"positive"``, ``"info"``, or ``"warning"``.
        move_number: 1-based move that triggered the pattern (optional).
        details: Extra numeric context (optional).
    """

    pattern_type: str
    description: str
    severity: str
    move_number: int | None = None
    details: dict | None = None


class AnalysisResponse(BaseModel):
    """Full analysis result for a completed game."""

    game_id: str
    accuracy_score: float
    luck_factor: float
    constraint_violations: int
    traps_encountered: int
    phase_accuracies: GamePhaseAccuracy
    moves: list[MoveAnalysis]
    patterns: list[StrategicPattern] = []
