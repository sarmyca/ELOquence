"""Word difficulty calculation utilities.

Difficulty combines:
1. Letter frequency — rare letters score higher.
2. Letter position frequency — unusual letter-at-position raises difficulty.
3. Duplicate letters — harder to narrow down.
4. Word-list membership — words from the curated NYT answer pool are
   "common English" by construction; words that only appear in the
   competitive_extra (scrabble-valid additions) are penalised so archaic
   strings like POYSE / TURME don't sneak into the easy ELO bucket even
   when their letter profile looks common.

The raw score is then mapped to the 600-1800 ELO scale via percentile
rank across the competitive pool, so the output distribution actually
spans that range uniformly.
"""
from __future__ import annotations

import bisect
import threading

# Approximate English single-letter frequency.
_LETTER_FREQ: dict[str, float] = {
    "e": 0.127, "t": 0.091, "a": 0.082, "o": 0.075, "i": 0.070,
    "n": 0.067, "s": 0.063, "h": 0.061, "r": 0.060, "d": 0.043,
    "l": 0.040, "c": 0.028, "u": 0.028, "m": 0.024, "w": 0.024,
    "f": 0.022, "g": 0.020, "y": 0.020, "p": 0.019, "b": 0.015,
    "v": 0.010, "k": 0.008, "j": 0.002, "x": 0.002, "q": 0.001,
    "z": 0.001,
}

# Common Wordle-position letters: lower difficulty (a bonus deducted from raw).
_POSITION_BONUS: dict[tuple[int, str], float] = {
    (0, "s"): 0.10, (0, "c"): 0.08, (0, "b"): 0.07, (0, "t"): 0.07, (0, "p"): 0.06,
    (4, "s"): 0.15, (4, "e"): 0.12, (4, "y"): 0.10, (4, "d"): 0.08, (4, "t"): 0.07,
    (2, "a"): 0.08, (2, "i"): 0.07, (1, "a"): 0.08, (1, "o"): 0.07, (1, "i"): 0.06,
}

# Penalty added to raw difficulty for words that aren't in the standard
# NYT-curated answer pool. Calibrated so a "common-letter" archaic word
# still ranks somewhere in the upper-middle of the distribution rather
# than the easy bucket.
_EXTRA_PENALTY = 0.12

ELO_MIN = 600.0
ELO_MAX = 1800.0

# Set of standard-answer words (lowercase). Populated when the engine
# loads its word lists. While empty, _extra_penalty contributes 0.
_STANDARD_ANSWERS: set[str] = set()


def _raw_difficulty(word: str) -> float:
    """Compute a raw difficulty score for a 5-letter word.

    Output is *not* clamped — the percentile mapping in ``word_to_elo``
    handles spread. Higher = harder.
    """
    word_lower = word.lower()
    score = 0.0

    rarity_sum = sum(1.0 - _LETTER_FREQ.get(ch, 0.0) for ch in word_lower)
    score += rarity_sum / 5.0 * 0.50

    pos_bonus = sum(_POSITION_BONUS.get((i, ch), 0.0) for i, ch in enumerate(word_lower))
    score -= pos_bonus * 0.20

    unique_ratio = len(set(word_lower)) / 5.0
    score += (1.0 - unique_ratio) * 0.30

    # Word-commonness penalty: words outside the curated answer pool are
    # statistically rarer in everyday English (even if their letters are
    # individually common), so they shouldn't sit in the easy bucket.
    if _STANDARD_ANSWERS and word_lower not in _STANDARD_ANSWERS:
        score += _EXTRA_PENALTY

    return score


# Sorted raw-difficulty scores for the competitive pool; populated lazily
# on first call to word_to_elo. We use bisect to find percentile rank.
_sorted_raws: list[float] | None = None
_pool_size: int = 0
_lock = threading.Lock()


def _ensure_distribution() -> None:
    """Build the sorted-difficulty index used for percentile mapping."""
    global _sorted_raws, _pool_size, _STANDARD_ANSWERS
    if _sorted_raws is not None:
        return
    with _lock:
        if _sorted_raws is not None:
            return
        from app.analysis.engine import ANSWERS, COMPETITIVE_ANSWERS
        if not COMPETITIVE_ANSWERS:
            # Word lists not loaded yet — bail. Next call after
            # load_word_lists() will populate the cache.
            return
        _STANDARD_ANSWERS = {w.lower() for w in ANSWERS}
        raws = sorted(_raw_difficulty(w) for w in COMPETITIVE_ANSWERS)
        _sorted_raws = raws
        _pool_size = len(raws)


def reset_distribution_cache() -> None:
    """Drop the cached percentile index. Used by tests."""
    global _sorted_raws, _pool_size, _STANDARD_ANSWERS
    _sorted_raws = None
    _pool_size = 0
    _STANDARD_ANSWERS = set()


def word_to_elo(word: str) -> float:
    """Map a word's heuristic difficulty to an ELO value in [600, 1800].

    Uses percentile rank against the competitive answer pool, so the
    output is uniformly distributed across the ELO range:
    bottom-percentile (easiest) words sit near 600, top-percentile sit
    near 1800, median ≈ 1200. Words outside the NYT-curated answer pool
    get a fixed penalty applied to their raw score so archaic strings
    don't slip into the easy bucket.

    Falls back to direct linear mapping if the distribution cache hasn't
    been populated yet (e.g. before word lists are loaded).
    """
    _ensure_distribution()
    raw = _raw_difficulty(word)

    if _sorted_raws and _pool_size:
        rank = bisect.bisect_right(_sorted_raws, raw)
        percentile = rank / _pool_size
        return round(ELO_MIN + percentile * (ELO_MAX - ELO_MIN), 1)

    # Fallback (pre-load): clamp raw to [0,1] and linear-map.
    clamped = max(0.0, min(1.0, raw))
    return round(ELO_MIN + clamped * (ELO_MAX - ELO_MIN), 1)
