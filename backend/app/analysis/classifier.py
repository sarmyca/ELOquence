"""9-tier move classification engine."""
from __future__ import annotations


def classify_move(
    efficiency_ratio: float,
    bits_lost: float,
    remaining_words: int,
    is_answer_candidate: bool,
    constraint_violation: str | None,
    remaining_count_before: int,
    greedy_rank: int | None = None,
    two_step_rank: int | None = None,
    two_step_advantage: float | None = None,
) -> str:
    """Classify a Wordle move into one of 9 quality tiers.

    Tiers (best → worst):
        brilliant, best, good, okay, inaccuracy, mistake, blunder, miss, forced

    Args:
        efficiency_ratio: Player's entropy / optimal entropy (0-1+).
        bits_lost: optimal_entropy - player_entropy (bits).
        remaining_words: Number of possible answers before this guess.
        is_answer_candidate: Whether the guess is itself a possible answer.
        constraint_violation: 'hard', 'soft', or None.
        remaining_count_before: Alias for remaining_words (kept for clarity).
        greedy_rank: Rank of this move by 1-step entropy (for brilliant detection).
        two_step_rank: Rank of this move by 2-step entropy.
        two_step_advantage: bits gained over the greedy move at 2 steps.

    Returns:
        Classification string.
    """
    # Hard constraint violation → automatic blunder
    if constraint_violation == "hard":
        return "blunder"

    # Only 1-2 choices left → forced (but only if the player actually
    # guessed one of the remaining candidates; otherwise it's a blunder)
    if remaining_count_before <= 2:
        if is_answer_candidate:
            return "forced"
        return "blunder"

    # In a 3-5 word endgame, playing a non-answer word is a "miss" — but ONLY
    # when it also failed to extract near-optimal information. A disambiguating
    # probe that splits the remaining set about as well as the best available
    # guess (bits_lost ~ 0) is smart play, not a miss: e.g. the multi-way
    # "_ILES" trap, where a B/M/F probe uniquely identifies the answer while
    # guessing a single candidate would not. Such a move keeps the
    # efficiency-based tier it earns below (typically "best"/"good").
    if (
        remaining_count_before <= 5
        and not is_answer_candidate
        and bits_lost >= 0.5
    ):
        return "miss"

    # Brilliant: counter-intuitive move that is better at 2 steps
    if (
        greedy_rank is not None
        and two_step_rank is not None
        and two_step_advantage is not None
        and remaining_count_before > 10
        and greedy_rank > 5
        and two_step_rank <= 3
        and two_step_advantage >= 0.3
    ):
        return "brilliant"

    small_pool = remaining_count_before <= 10

    if small_pool:
        if efficiency_ratio >= 0.90 or bits_lost < 0.15:
            return "best"
        elif efficiency_ratio >= 0.75 or bits_lost < 0.50:
            return "good"
        elif efficiency_ratio >= 0.60:
            return "okay"
        elif efficiency_ratio >= 0.40:
            return "inaccuracy"
        elif efficiency_ratio >= 0.30:
            return "mistake"
        else:
            return "blunder"
    else:
        if efficiency_ratio >= 0.97 or bits_lost < 0.15:
            return "best"
        elif efficiency_ratio >= 0.85 or bits_lost < 0.50:
            return "good"
        elif efficiency_ratio >= 0.70:
            return "okay"
        elif efficiency_ratio >= 0.50 or bits_lost < 2.0:
            return "inaccuracy"
        elif efficiency_ratio >= 0.30:
            return "mistake"
        else:
            return "blunder"
