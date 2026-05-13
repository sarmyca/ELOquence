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
        and ``traps_encountered``.
    """
    from app.analysis.classifier import classify_move
    from app.analysis.constraints import ConstraintState
    from app.analysis.engine import (
        ALL_WORDS,
        ANSWERS,
        COMPETITIVE_ANSWERS,
        DICTIONARY_SIZES,
        HARD_MODE_STARTER,
        PATTERN_MATRIX,
        STANDARD_MODE_STARTER,
        actual_solutions_after,
        bot_best_pick,
        bot_solve_path as compute_bot_solve_path,
        compute_entropy,
        compute_expected_remaining,
        compute_luck_score,
        compute_pattern,
        compute_skill_score,
        expected_solutions_after,
        expected_steps_remaining,
        find_optimal_guess,
        get_remaining_answers,
        get_word_index,
        uniqueness_percentile as compute_uniqueness_percentile,
    )
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
        # Bot's parallel metrics — same computations but for the optimal pick
        # so the review page can show a true head-to-head comparison.
        # ------------------------------------------------------------------
        optimal_pattern_dist: list[dict] = []
        optimal_actual_after: int | None = None
        optimal_exp_steps: float | None = None
        optimal_num_groups: int | None = None
        optimal_largest_group: int | None = None
        if optimal_word and total_possible > 0:
            try:
                opt_idx = get_word_index(optimal_word)
            except ValueError:
                opt_idx = None
            if opt_idx is not None:
                # Pattern the bot would actually observe against the true target
                bot_observed_pattern = compute_pattern(optimal_word, target_word.upper())

                opt_patterns = PATTERN_MATRIX[opt_idx, possible]
                opt_unique, opt_counts = np.unique(opt_patterns, return_counts=True)

                opt_pattern_to_words: dict[int, list[str]] = {}
                for idx_pos, pat_val in zip(possible, opt_patterns):
                    pv = int(pat_val)
                    if pv not in opt_pattern_to_words:
                        opt_pattern_to_words[pv] = []
                    opt_pattern_to_words[pv].append(answer_pool[idx_pos])

                optimal_pattern_dist = sorted(
                    [
                        {
                            "pattern": int(p),
                            "count": int(c),
                            "probability": round(int(c) / total_possible, 4),
                            "is_actual": int(p) == bot_observed_pattern,
                            "words": sorted(opt_pattern_to_words.get(int(p), [])),
                        }
                        for p, c in zip(opt_unique, opt_counts)
                    ],
                    key=lambda x: -x["count"],
                )

                optimal_num_groups = len(opt_unique)
                optimal_largest_group = int(opt_counts.max())
                optimal_actual_after = actual_solutions_after(
                    opt_idx, possible, bot_observed_pattern
                )

                # Expected steps after the bot's pick, assuming the same
                # target word — gives an apples-to-apples comparison with
                # the player's `expected_steps_until_solution`.
                try:
                    opt_new_possible = get_remaining_answers(
                        possible, optimal_word, bot_observed_pattern
                    )
                    optimal_exp_steps = round(
                        expected_steps_remaining(opt_new_possible), 2
                    )
                except ValueError:
                    optimal_exp_steps = None

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

        # Decode pattern for constraint update
        pattern_tiles: list[int] = []
        p = pattern
        for _ in range(5):
            pattern_tiles.append(p % 3)
            p //= 3
        constraint_state.update(guess, pattern_tiles)

        # ------------------------------------------------------------------
        # WordleBot-spec per-turn metrics
        # ------------------------------------------------------------------
        skill = compute_skill_score(player_entropy, optimal_info, n_remaining)
        luck_s = compute_luck_score(info_gained, player_entropy, n_remaining)
        exp_sol_after = round(expected_solutions_after(guess_idx, possible) if guess_idx is not None else float(n_remaining), 2)
        act_sol_after = actual_solutions_after(guess_idx, possible, pattern) if guess_idx is not None else len(new_possible)
        exp_steps = round(expected_steps_remaining(new_possible), 2)
        bot_word = bot_best_pick(possible)

        # Rationale for bot pick (short text explaining why)
        if bot_word == guess:
            bot_rationale = "You matched the bot's pick."
        elif optimal_word and optimal_word == bot_word:
            bot_rationale = f"Bot preferred {bot_word} (highest expected info gain)."
        else:
            bot_rationale = f"Bot would pick {bot_word} to maximize information."

        # Candidate top-N with probability field
        candidates = [
            {
                "word": tp["word"],
                "entropy": round(tp["entropy"], 3),
                "expected_remaining": round(tp["expected_remaining"], 2),
                "probability": round(tp["expected_remaining"] / max(1, n_remaining), 4),
            }
            for tp in top_picks[:20]
        ]

        # Contextual tip case
        tip_case = ""
        if skill < 50 and n_remaining > 5:
            # Detect common sub-patterns for educational tips
            if guess_idx is not None and len(new_possible) > len(possible) * 0.8:
                tip_case = "efficient_split"
            elif bot_word and bot_word != guess:
                # Check if bot word is an answer candidate
                try:
                    bw_idx = get_word_index(bot_word)
                    if bw_idx < len(answer_pool) and bw_idx in set(possible.tolist()):
                        tip_case = "bot_suggests_solution"
                    else:
                        tip_case = "efficient_split"
                except ValueError:
                    tip_case = "efficient_split"

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
                "game_phase": None,
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
                        "probability": 0.0,
                    }
                    for tp in top_picks
                ],
                "pattern_distribution": pattern_dist,
                "optimal_pattern_distribution": optimal_pattern_dist,
                "optimal_num_groups": optimal_num_groups,
                "optimal_largest_group": optimal_largest_group,
                "optimal_actual_solutions_after": optimal_actual_after,
                "optimal_expected_steps_until_solution": optimal_exp_steps,
                "letter_frequencies": letter_freq,
                # WordleBot-spec fields
                "skill_score": skill,
                "luck_score": luck_s,
                "remaining_before": n_remaining,
                "expected_solutions_after": exp_sol_after,
                "actual_solutions_after": act_sol_after,
                "expected_steps_until_solution": exp_steps,
                "bot_pick": bot_word,
                "bot_pick_rationale": bot_rationale,
                "scenario_count": 0,
                "candidates_top_n": candidates,
                "tip_case": tip_case,
            }
        )

        possible = new_possible

    # Aggregate accuracy
    accuracy = (total_efficiency / scored_moves * 100.0) if scored_moves > 0 else 100.0

    avg_luck = total_luck / len(game_moves) if game_moves else 0.0

    # Skill aggregate — include the opener. Openers vary in quality
    # (e.g. SALET ~6 bits vs MAMMA ~3 bits) so we no longer drop move 1.
    # Forced moves (only one word left) are still excluded because there
    # was no choice.
    skill_scores = [r["skill_score"] for r in results if r["classification"] != "forced"]
    skill_avg = round(sum(skill_scores) / len(skill_scores), 1) if skill_scores else 0.0

    all_luck_scores = [r["luck_score"] for r in results]
    luck_avg_score = round(sum(all_luck_scores) / len(all_luck_scores), 1) if all_luck_scores else 50.0

    guesses_list = [r["guess_word"] for r in results]
    patterns_list = [r["pattern"] for r in results]
    uniq = compute_uniqueness_percentile(guesses_list, patterns_list)
    bot_path = compute_bot_solve_path(guesses_list, patterns_list)

    # Failure score (only if game was not won — all 6 guesses used with no solution)
    # Approximated as 100 - accuracy when game exhausts all guesses without solution
    failure_score: float | None = None
    if len(results) == 6 and results[-1]["remaining_after"] > 0:
        failure_score = round(100.0 - accuracy, 1)

    return {
        "accuracy_score": round(accuracy, 1),
        "luck_factor": round(avg_luck, 3),
        "moves": results,
        "constraint_violations": constraint_violation_count,
        "traps_encountered": trap_count,
        # WordleBot-spec aggregates
        "skill_avg": skill_avg,
        # Back-compat alias for older clients still reading the old key
        "skill_avg_excluding_opener": skill_avg,
        "luck_avg": luck_avg_score,
        "uniqueness_percentile": uniq,
        "bot_solve_path": bot_path,
        "failure_score": failure_score,
        "standard_mode_starter": STANDARD_MODE_STARTER,
        "hard_mode_starter": HARD_MODE_STARTER,
        "dictionary_sizes": DICTIONARY_SIZES,
    }


__all__ = ["analyze_game"]
