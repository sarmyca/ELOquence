"""Word difficulty calculation utilities.

Difficulty is estimated using a combination of:
1. Letter frequency — words composed of rare letters score higher.
2. Letter position frequency — how unusual each letter is at its position.
3. Duplicate letters — harder to guess.

The raw score is mapped to the 600–1800 ELO scale.
"""
from __future__ import annotations

# Approximate English letter frequency (descending order of frequency)
_LETTER_FREQ: dict[str, float] = {
    "e": 0.127, "t": 0.091, "a": 0.082, "o": 0.075, "i": 0.070,
    "n": 0.067, "s": 0.063, "h": 0.061, "r": 0.060, "d": 0.043,
    "l": 0.040, "c": 0.028, "u": 0.028, "m": 0.024, "w": 0.024,
    "f": 0.022, "g": 0.020, "y": 0.020, "p": 0.019, "b": 0.015,
    "v": 0.010, "k": 0.008, "j": 0.002, "x": 0.002, "q": 0.001,
    "z": 0.001,
}

# Common Wordle-position bigrams: (position, letter) → bonus (lower is easier)
_POSITION_BONUS: dict[tuple[int, str], float] = {
    (0, "s"): 0.10, (0, "c"): 0.08, (0, "b"): 0.07, (0, "t"): 0.07, (0, "p"): 0.06,
    (4, "s"): 0.15, (4, "e"): 0.12, (4, "y"): 0.10, (4, "d"): 0.08, (4, "t"): 0.07,
    (2, "a"): 0.08, (2, "i"): 0.07, (1, "a"): 0.08, (1, "o"): 0.07, (1, "i"): 0.06,
}

ELO_MIN = 600.0
ELO_MAX = 1800.0


def _raw_difficulty(word: str) -> float:
    """Compute a raw difficulty score in [0, 1] for a 5-letter word.

    Higher values indicate harder words.
    """
    word_lower = word.lower()
    score = 0.0

    # Component 1: rare letters
    rarity_sum = sum(1.0 - _LETTER_FREQ.get(ch, 0.0) for ch in word_lower)
    score += rarity_sum / 5.0 * 0.50  # weight 50 %

    # Component 2: positional unusualness
    pos_bonus = sum(_POSITION_BONUS.get((i, ch), 0.0) for i, ch in enumerate(word_lower))
    score -= pos_bonus * 0.20  # reward common positions (lower difficulty)

    # Component 3: duplicate letters make the word harder to narrow down
    unique_ratio = len(set(word_lower)) / 5.0
    score += (1.0 - unique_ratio) * 0.30  # weight 30 %

    return max(0.0, min(1.0, score))


def word_to_elo(word: str) -> float:
    """Map a word's heuristic difficulty to an ELO value in [600, 1800].

    Args:
        word: 5-letter word (case-insensitive).

    Returns:
        Estimated ELO difficulty rating.
    """
    raw = _raw_difficulty(word)
    return round(ELO_MIN + raw * (ELO_MAX - ELO_MIN), 1)
