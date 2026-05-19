"""Per-move (incremental) analysis.

The full ``analyze_game`` function runs in O(moves) on game completion and
re-derives state from scratch each call. For the live game flow we want
to **amortize** that cost across guesses: each move is analysed at the
moment it's submitted, results are persisted on the ``Move`` row, and on
completion the game-level aggregates are computed from the stored per-move
data — no fresh analysis pass needed.

What this module does NOT compute (vs. ``analyze_game``):
  - pattern distribution / optimal pattern distribution buckets
  - per-position letter frequencies
  - bot pick / bot solve path
  - WordleBot-spec skill_score / luck_score
  - top_picks / candidates lists / tip cases
  - uniqueness percentile

Those are review-page concerns — the review endpoint (``/analysis/games/{id}/analyze``)
still calls the full ``analyze_game`` on demand and returns them. They are
not persisted on the Move row, so computing them at submit time was wasted
work that lived inside the original ``analyze_game`` call.

This module only computes the fields that are actually stored on ``Move``
and then read back by ``aggregate_completion_metrics`` to set game-level
fields. Net result: per-guess analysis is much faster than a full
``analyze_game`` pass per move would be.
"""
from __future__ import annotations

from typing import Iterable, TypedDict

import numpy as np

from app.analysis import KNOWN_OPENERS


class MoveAnalysisFields(TypedDict, total=False):
    """Subset of ``analyze_game`` per-move output that lives on the Move row."""
    remaining_words: int
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
    trap_detected: bool
    is_book_move: bool


def analyze_single_move(
    prior_moves: list[dict],
    guess: str,
    pattern: int,
    move_number: int,
    target_word: str,
    *,
    competitive: bool = False,
) -> MoveAnalysisFields:
    """Analyse one newly-submitted move given the prior-move state.

    Replays the constraint state and ``possible`` answer pool by iterating
    over ``prior_moves`` (no ``find_optimal_guess`` on those — cheap), then
    runs the per-move analysis only for ``(guess, pattern)``.

    Args:
        prior_moves: List of ``{guess_word, pattern, move_number}`` dicts
            for moves played before this one.
        guess: The new move's 5-letter guess (will be uppercased).
        pattern: Ternary-encoded result for the new guess.
        move_number: 1-based move index of the new move.
        target_word: Game's target word — accepted for parity with
            ``analyze_game``; not actually used by the per-move math.
        competitive: True for competitive games (larger answer pool).

    Returns:
        Dict matching the columns persisted on the Move ORM model.
    """
    from app.analysis.classifier import classify_move
    from app.analysis.constraints import ConstraintState
    from app.analysis.engine import (
        ANSWERS,
        COMPETITIVE_ANSWERS,
        PATTERN_MATRIX,
        compute_entropy,
        compute_expected_remaining,
        find_optimal_guess,
        get_remaining_answers,
        get_word_index,
    )
    from app.analysis.traps import detect_trap

    if PATTERN_MATRIX is None:
        raise RuntimeError("Pattern matrix not loaded.")

    # Pool selection mirrors analyze_game so per-move stored data matches
    # what analyze_game would have written for the same (guess, pattern).
    answer_pool = COMPETITIVE_ANSWERS if competitive else ANSWERS
    possible = np.arange(len(answer_pool), dtype=np.int32)
    constraint_state = ConstraintState()

    # ── Replay prior-move state (state-only, no analysis) ──────────────
    for prior in sorted(prior_moves, key=lambda m: m["move_number"]):
        p_guess = prior["guess_word"].upper()
        p_pattern = int(prior["pattern"])
        try:
            possible = get_remaining_answers(possible, p_guess, p_pattern)
        except ValueError:
            # Unknown word — preserve the wider possible set rather than crashing.
            pass
        p_tiles: list[int] = []
        pp = p_pattern
        for _ in range(5):
            p_tiles.append(pp % 3)
            pp //= 3
        constraint_state.update(p_guess, p_tiles)

    # ── Analyse the new move ───────────────────────────────────────────
    guess_upper = guess.upper()
    n_remaining = int(len(possible))

    entropy_before = float(np.log2(n_remaining)) if n_remaining > 1 else 0.0

    # Constraint check uses pre-move state — same as analyze_game's loop.
    violation_info = constraint_state.check_violation(guess_upper)
    violation_type = violation_info["type"]

    # Optimal pick at this position (the dominant cost — bigger pool = slower).
    top_picks = find_optimal_guess(possible, n_remaining, top_n=15)
    optimal = top_picks[0] if top_picks else None
    optimal_info = float(optimal["entropy"]) if optimal else 0.0
    optimal_word = str(optimal["word"]) if optimal else ""
    optimal_exp_remaining = float(optimal["expected_remaining"]) if optimal else 0.0

    # Player metrics
    guess_idx: int | None = None
    try:
        guess_idx = get_word_index(guess_upper)
        player_entropy = compute_entropy(guess_idx, possible)
        player_exp_remaining = compute_expected_remaining(guess_idx, possible)
    except ValueError:
        # Should not happen in practice (we validate before persisting) but
        # if it does we degrade to zero-information bookkeeping.
        player_entropy = 0.0
        player_exp_remaining = float(n_remaining)

    efficiency = player_entropy / optimal_info if optimal_info > 1e-9 else 1.0
    bits_lost = max(0.0, optimal_info - player_entropy)

    # Apply pattern → entropy_after / info_gained
    try:
        new_possible = get_remaining_answers(possible, guess_upper, pattern)
    except ValueError:
        new_possible = possible
    entropy_after = float(np.log2(len(new_possible))) if len(new_possible) > 1 else 0.0
    info_gained = entropy_before - entropy_after

    # Is this guess one of the remaining answer candidates?
    is_candidate = False
    if guess_idx is not None:
        is_candidate = guess_idx < len(answer_pool) and guess_idx in set(possible.tolist())

    # Trap detection — only meaningful for small pools (endgame-like).
    trap_detected = False
    if n_remaining <= 20:
        remaining_word_list = [answer_pool[i] for i in possible]
        trap = detect_trap(remaining_word_list)
        trap_detected = trap is not None

    is_book = move_number == 1 and guess_upper in KNOWN_OPENERS

    classification = classify_move(
        efficiency_ratio=efficiency,
        bits_lost=bits_lost,
        remaining_words=n_remaining,
        is_answer_candidate=is_candidate,
        constraint_violation=violation_type if violation_type != "none" else None,
        remaining_count_before=n_remaining,
    )

    return {
        "remaining_words": n_remaining,
        "entropy_before": round(entropy_before, 3),
        "entropy_after": round(entropy_after, 3),
        "info_gained": round(info_gained, 3),
        "optimal_info": round(optimal_info, 3),
        "optimal_word": optimal_word,
        "expected_remaining": round(player_exp_remaining, 2),
        "optimal_expected_remaining": round(optimal_exp_remaining, 2),
        "efficiency_ratio": round(efficiency, 3),
        "bits_lost": round(bits_lost, 3),
        "classification": classification,
        "constraint_violation": violation_type,
        "trap_detected": trap_detected,
        "is_book_move": is_book,
    }


def aggregate_completion_metrics(moves: Iterable) -> dict:
    """Derive game-level fields from already-persisted per-move analysis.

    Mirrors the game-level aggregates that ``analyze_game`` used to write
    directly: ``accuracy_score``, ``luck_factor``, ``constraint_violations``,
    ``traps_encountered``.

    Args:
        moves: Iterable of Move ORM rows with ``efficiency_ratio``,
            ``classification``, ``constraint_violation``, ``info_gained``,
            ``optimal_info``, ``trap_detected`` already populated by
            ``analyze_single_move``.

    Returns:
        Dict of game-level metrics, ready to assign onto a Game row.
    """
    moves_list = list(moves)
    if not moves_list:
        return {
            "accuracy_score": 100.0,
            "luck_factor": 0.0,
            "constraint_violations": 0,
            "traps_encountered": 0,
        }

    total_eff = 0.0
    scored_count = 0
    total_luck = 0.0
    violations = 0
    traps = 0

    for m in moves_list:
        eff = m.efficiency_ratio if m.efficiency_ratio is not None else 0.0
        violation = m.constraint_violation or "none"
        cls = m.classification

        # Accuracy: skip forced moves (no choice = no skill measurement).
        # Constraint violations get a -0.3 cap, same penalty as analyze_game.
        if cls != "forced":
            scored_eff = eff
            if violation != "none":
                scored_eff = min(scored_eff, 0.3)
            total_eff += scored_eff
            scored_count += 1

        # Luck = actual info gained − expected info under the player's pick.
        # Per-move player_entropy isn't stored directly, but it equals
        # optimal_info × efficiency_ratio (since efficiency = player/optimal),
        # so we can reconstruct it.
        if (
            m.info_gained is not None
            and m.optimal_info is not None
            and m.efficiency_ratio is not None
        ):
            player_entropy = m.optimal_info * m.efficiency_ratio
            total_luck += m.info_gained - player_entropy

        if violation != "none":
            violations += 1
        if m.trap_detected:
            traps += 1

    accuracy = (total_eff / scored_count * 100.0) if scored_count > 0 else 100.0
    avg_luck = total_luck / len(moves_list)

    return {
        "accuracy_score": round(accuracy, 1),
        "luck_factor": round(avg_luck, 3),
        "constraint_violations": violations,
        "traps_encountered": traps,
    }


__all__ = ["analyze_single_move", "aggregate_completion_metrics", "MoveAnalysisFields"]
