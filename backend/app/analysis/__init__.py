"""Analysis package — exports the top-level ``analyze_game`` function."""
from __future__ import annotations

import numpy as np


KNOWN_OPENERS: frozenset[str] = frozenset(
    {
        "SALET", "CRANE", "SLATE", "TRACE", "CRATE", "RAISE", "ARISE",
        "STARE", "SOARE", "ADIEU", "AUDIO", "ROATE", "IRATE", "ORATE",
        "ARIEL", "AROSE", "TALES", "RATES", "TARES", "SNARE",
    }
)


def analyze_game(game_moves: list[dict], target_word: str, *, competitive: bool = False) -> dict:
    """Run full information-theory analysis on a completed game.

    Args:
        game_moves: List of dicts with keys ``guess_word``, ``pattern``,
                    and ``move_number``.
        target_word: The correct answer (used for context only; not needed
                     for the entropy calculations).
        competitive: If True, analyse against the expanded competitive
                     answer pool (~5,009 words) instead of the standard
                     2,309 answers.

    Returns:
        Dict containing ``accuracy_score``, ``luck_factor``, ``moves``
        (list of per-move analysis dicts), ``constraint_violations``,
        ``traps_encountered``, and ``phase_accuracies``.
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
    from app.analysis.game_phase import detect_game_phase
    from app.analysis.traps import detect_trap

    if PATTERN_MATRIX is None:
        raise RuntimeError("Pattern matrix not loaded. Call precompute_pattern_matrix() first.")

    # Select the answer pool for this analysis
    answer_pool = COMPETITIVE_ANSWERS if competitive else ANSWERS
    possible = np.arange(len(answer_pool), dtype=np.int32)
    constraint_state = ConstraintState()
    results: list[dict] = []

    total_efficiency = 0.0
    scored_moves = 0
    phase_scores: dict[str, list[float]] = {"opening": [], "midgame": [], "endgame": []}
    total_luck = 0.0
    constraint_violation_count = 0
    trap_count = 0

    for move in sorted(game_moves, key=lambda m: m["move_number"]):
        guess = move["guess_word"].upper()
        pattern = int(move["pattern"])
        move_num = int(move["move_number"])
        n_remaining = len(possible)

        # Shannon entropy of the current state before this guess
        entropy_before = float(np.log2(n_remaining)) if n_remaining > 1 else 0.0

        # Constraint check
        violation_info = constraint_state.check_violation(guess)
        violation_type = violation_info["type"]
        violation_reason = violation_info["reason"]
        if violation_type != "none":
            constraint_violation_count += 1

        # Game phase
        phase = detect_game_phase(n_remaining, move_num)

        # Optimal guess at this position
        top_picks = find_optimal_guess(possible, n_remaining, top_n=15)
        optimal = top_picks[0] if top_picks else None
        optimal_info = optimal["entropy"] if optimal else 0.0
        optimal_word = optimal["word"] if optimal else ""
        optimal_exp_remaining = optimal["expected_remaining"] if optimal else 0.0

        # Player's guess metrics
        guess_idx: int | None = None
        try:
            guess_idx = get_word_index(guess)
            player_entropy = compute_entropy(guess_idx, possible)
            player_exp_remaining = compute_expected_remaining(guess_idx, possible)
        except ValueError:
            # Word not in list — treat as zero information
            player_entropy = 0.0
            player_exp_remaining = float(n_remaining)

        # Efficiency
        efficiency = player_entropy / optimal_info if optimal_info > 1e-9 else 1.0
        bits_lost = max(0.0, optimal_info - player_entropy)

        # Apply pattern to narrow the answer set
        try:
            new_possible = get_remaining_answers(possible, guess, pattern)
        except ValueError:
            new_possible = possible  # fallback

        entropy_after = float(np.log2(len(new_possible))) if len(new_possible) > 1 else 0.0
        info_gained = entropy_before - entropy_after

        # Luck = actual info - expected info
        luck = info_gained - player_entropy
        total_luck += luck

        # Is this guess among the remaining answer candidates?
        try:
            g_idx = get_word_index(guess)
            is_candidate = (g_idx < len(answer_pool)) and (g_idx in set(possible.tolist()))
        except ValueError:
            is_candidate = False

        # Build remaining word list (used for trap detection + letter frequencies)
        remaining_word_list = [answer_pool[i] for i in possible]

        # Trap detection — only meaningful in small pools (endgame-like)
        trap = None
        if n_remaining <= 20:
            trap = detect_trap(remaining_word_list)
            if trap:
                trap_count += 1

        # ------------------------------------------------------------------
        # Pattern distribution — ALL buckets for the player's guess
        # ------------------------------------------------------------------
        total_possible = len(possible)
        if guess_idx is not None and total_possible > 0:
            player_patterns = PATTERN_MATRIX[guess_idx, possible]
            unique_patterns, pattern_counts = np.unique(player_patterns, return_counts=True)

            # Build per-bucket word lists
            pattern_to_words: dict[int, list[str]] = {}
            for idx_pos, pat_val in zip(possible, player_patterns):
                pv = int(pat_val)
                if pv not in pattern_to_words:
                    pattern_to_words[pv] = []
                pattern_to_words[pv].append(answer_pool[idx_pos])

            pattern_dist: list[dict] = sorted(
                [
                    {
                        "pattern": int(p),
                        "count": int(c),
                        "probability": round(int(c) / total_possible, 4),
                        "is_actual": int(p) == pattern,
                        "words": sorted(pattern_to_words.get(int(p), [])),
                    }
                    for p, c in zip(unique_patterns, pattern_counts)
                ],
                key=lambda x: -x["count"],
            )
        else:
            pattern_dist = []

        # ------------------------------------------------------------------
        # Letter frequency matrix — 5 positions × 26 letters (% of remaining)
        # ------------------------------------------------------------------
        letter_freq: dict[str, dict[str, float]] = {}
        if total_possible > 0:
            for pos in range(5):
                freq: dict[str, int] = {}
                for word in remaining_word_list:
                    letter = word[pos]
                    freq[letter] = freq.get(letter, 0) + 1
                letter_freq[str(pos)] = {
                    letter: round(count / total_possible * 100, 1)
                    for letter, count in sorted(freq.items())
                }

        # Book move (move 1 only)
        is_book = move_num == 1 and guess in KNOWN_OPENERS

        # Classify
        classification = classify_move(
            efficiency_ratio=efficiency,
            bits_lost=bits_lost,
            remaining_words=n_remaining,
            is_answer_candidate=is_candidate,
            constraint_violation=violation_type if violation_type != "none" else None,
            remaining_count_before=n_remaining,
        )

        # Track accuracy for non-forced moves
        # Constraint violations get a penalty even if entropy-efficiency is high
        scored_efficiency = efficiency
        if violation_type != "none" and classification != "forced":
            scored_efficiency = min(efficiency, 0.3)

        if classification != "forced":
            total_efficiency += scored_efficiency
            scored_moves += 1
            phase_scores[phase].append(scored_efficiency)

        # Decode pattern for constraint update
        pattern_tiles: list[int] = []
        p = pattern
        for _ in range(5):
            pattern_tiles.append(p % 3)
            p //= 3
        constraint_state.update(guess, pattern_tiles)

        results.append(
            {
                "move_number": move_num,
                "guess_word": guess,
                "pattern": pattern,
                "remaining_words": n_remaining,
                "remaining_after": len(new_possible),
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
                "game_phase": phase,
                "constraint_violation": violation_type,
                "constraint_violation_reason": violation_reason,
                "trap_detected": trap is not None,
                "trap_info": trap,
                "is_book_move": is_book,
                "luck": round(luck, 3),
                "remaining_words_list": [answer_pool[i] for i in new_possible],
                "top_picks": [
                    {
                        "word": tp["word"],
                        "entropy": round(tp["entropy"], 3),
                        "expected_remaining": round(tp["expected_remaining"], 2),
                    }
                    for tp in top_picks
                ],
                "pattern_distribution": pattern_dist,
                "optimal_pattern_distribution": [],
                "letter_frequencies": letter_freq,
            }
        )

        possible = new_possible

    # Aggregate accuracy
    accuracy = (total_efficiency / scored_moves * 100.0) if scored_moves > 0 else 100.0

    phase_accuracies = {
        phase_name: (sum(scores) / len(scores) * 100.0) if scores else 0.0
        for phase_name, scores in phase_scores.items()
    }

    avg_luck = total_luck / len(game_moves) if game_moves else 0.0

    return {
        "accuracy_score": round(accuracy, 1),
        "luck_factor": round(avg_luck, 3),
        "moves": results,
        "constraint_violations": constraint_violation_count,
        "traps_encountered": trap_count,
        "phase_accuracies": phase_accuracies,
    }


__all__ = ["analyze_game"]
