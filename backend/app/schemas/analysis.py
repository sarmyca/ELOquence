"""Analysis-related Pydantic schemas."""
from pydantic import BaseModel


class TopPick(BaseModel):
    """One of the top-ranked guesses at a given position."""

    word: str
    entropy: float
    expected_remaining: float
    probability: float = 0.0


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
    optimal_num_groups: int | None = None
    optimal_largest_group: int | None = None
    optimal_actual_solutions_after: int | None = None
    optimal_expected_steps_until_solution: float | None = None
    letter_frequencies: dict[str, dict[str, float]] = {}

    # --- WordleBot-spec per-turn fields ---
    skill_score: int = 0
    luck_score: int = 50
    remaining_before: int = 0
    expected_solutions_after: float = 0.0
    actual_solutions_after: int = 0
    expected_steps_until_solution: float = 1.0
    bot_pick: str = ""
    bot_pick_rationale: str = ""
    scenario_count: int = 0
    candidates_top_n: list[TopPick] = []
    tip_case: str = ""


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


class DictionaryInfo(BaseModel):
    """WordleBot-spec dictionary size information."""

    guesses: int = 15000
    suggestions: int = 4500
    solutions: int = 3200
    legacy: int = 2309


class AnalysisResponse(BaseModel):
    """Full analysis result for a completed game."""

    game_id: str
    accuracy_score: float
    luck_factor: float
    constraint_violations: int
    traps_encountered: int
    moves: list[MoveAnalysis]
    patterns: list[StrategicPattern] = []

    # --- WordleBot-spec aggregate fields ---
    skill_avg: float = 0.0
    skill_avg_excluding_opener: float = 0.0  # alias for older clients
    luck_avg: float = 0.0
    uniqueness_percentile: int = 1  # legacy: grid fingerprint match count
    opener_word: str = ""
    opener_rarity_pct: int = 0  # % of players who opened differently
    opener_same_count: int = 0  # players who opened with the same word (incl. self)
    opener_total_games: int = 0  # total completed games considered
    bot_solve_path: list[str] = []
    failure_score: float | None = None
    standard_mode_starter: str = "SLATE"
    hard_mode_starter: str = "CLASP"
    dictionary_sizes: DictionaryInfo = DictionaryInfo()
