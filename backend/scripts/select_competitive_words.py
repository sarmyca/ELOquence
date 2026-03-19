"""Select additional answer-worthy words from valid_guesses for competitive mode.

Strategy: score each word by letter-frequency commonality and positional
plausibility. Words that score highly are more likely to be real, common
English words suitable as Wordle answers. We pick the top ~2,700 words
that are NOT already in the standard answers pool.

Output: data/competitive_extra.txt (one word per line, lowercase).
The full competitive answer set = answers.txt + competitive_extra.txt.
"""
from __future__ import annotations

from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"

# English single-letter frequencies (approximate)
LETTER_FREQ = {
    "a": 0.082, "b": 0.015, "c": 0.028, "d": 0.043, "e": 0.127,
    "f": 0.022, "g": 0.020, "h": 0.061, "i": 0.070, "j": 0.002,
    "k": 0.008, "l": 0.040, "m": 0.024, "n": 0.067, "o": 0.075,
    "p": 0.019, "q": 0.001, "r": 0.060, "s": 0.063, "t": 0.091,
    "u": 0.028, "v": 0.010, "w": 0.024, "x": 0.002, "y": 0.020,
    "z": 0.001,
}

# Positional letter frequencies from the standard Wordle answer set.
# These reward letters in positions where they commonly appear in real answers.
POSITION_FREQ: dict[tuple[int, str], float] = {
    # Position 0 (first letter) — most common starters
    (0, "s"): 0.10, (0, "c"): 0.08, (0, "b"): 0.07, (0, "t"): 0.07,
    (0, "p"): 0.06, (0, "a"): 0.06, (0, "f"): 0.05, (0, "g"): 0.04,
    (0, "d"): 0.04, (0, "m"): 0.04, (0, "r"): 0.04, (0, "l"): 0.03,
    (0, "w"): 0.03, (0, "h"): 0.03, (0, "n"): 0.02,
    # Position 1 — vowels dominate
    (1, "a"): 0.12, (1, "o"): 0.10, (1, "r"): 0.07, (1, "e"): 0.07,
    (1, "i"): 0.06, (1, "l"): 0.06, (1, "u"): 0.06, (1, "h"): 0.05,
    (1, "n"): 0.03,
    # Position 2 — vowels + common consonants
    (2, "a"): 0.10, (2, "i"): 0.08, (2, "o"): 0.07, (2, "r"): 0.06,
    (2, "n"): 0.06, (2, "l"): 0.05, (2, "e"): 0.05, (2, "u"): 0.04,
    (2, "t"): 0.04,
    # Position 3 — mixed
    (3, "e"): 0.10, (3, "n"): 0.06, (3, "s"): 0.05, (3, "a"): 0.05,
    (3, "l"): 0.05, (3, "i"): 0.05, (3, "c"): 0.04, (3, "r"): 0.04,
    (3, "t"): 0.04, (3, "k"): 0.03,
    # Position 4 (last letter) — common endings
    (4, "e"): 0.12, (4, "y"): 0.10, (4, "t"): 0.08, (4, "r"): 0.07,
    (4, "s"): 0.06, (4, "l"): 0.05, (4, "n"): 0.05, (4, "h"): 0.04,
    (4, "d"): 0.04, (4, "k"): 0.04,
}

# Penalise patterns that signal obscure words
RARE_BIGRAMS = {
    "zz", "qq", "xx", "jj", "vv", "ww", "kk",
    "qo", "qe", "qi", "qa", "zx", "xz", "jx", "xj",
    "bx", "xb", "fq", "qf", "vq", "qv", "wq", "qw",
}

TARGET_EXTRA = 2700  # ~5,000 total competitive answers


def score_word(word: str) -> float:
    """Score a word's suitability as a competitive answer."""
    w = word.lower()

    # 1. Average letter frequency (40%)
    avg_freq = sum(LETTER_FREQ.get(c, 0.001) for c in w) / 5.0
    freq_score = avg_freq / 0.08  # normalise so ~1.0 for common words

    # 2. Positional plausibility (30%)
    pos_score = sum(POSITION_FREQ.get((i, c), 0.005) for i, c in enumerate(w))
    pos_score = pos_score / 0.30  # normalise

    # 3. Unique letters bonus (20%) — penalise double letters slightly
    unique_ratio = len(set(w)) / 5.0
    unique_score = 0.5 + 0.5 * unique_ratio

    # 4. Rare bigram penalty (10%)
    bigram_penalty = 0.0
    for i in range(4):
        if w[i : i + 2] in RARE_BIGRAMS:
            bigram_penalty += 0.5
    bigram_score = max(0.0, 1.0 - bigram_penalty)

    return 0.40 * freq_score + 0.30 * pos_score + 0.20 * unique_score + 0.10 * bigram_score


def main() -> None:
    # Load existing answers
    answers_path = DATA_DIR / "answers.txt"
    with open(answers_path) as f:
        answers = {w.strip().lower() for w in f if w.strip()}
    print(f"Standard answers: {len(answers)}")

    # Load valid guesses
    guesses_path = DATA_DIR / "valid_guesses.txt"
    with open(guesses_path) as f:
        all_guesses = [w.strip().lower() for w in f if w.strip()]
    print(f"Valid guesses: {len(all_guesses)}")

    # Filter to words NOT in standard answers
    candidates = [w for w in all_guesses if w not in answers]
    print(f"Candidates (not in answers): {len(candidates)}")

    # Score and rank
    scored = [(w, score_word(w)) for w in candidates]
    scored.sort(key=lambda x: -x[1])

    # Take top N
    selected = [w for w, _ in scored[:TARGET_EXTRA]]
    print(f"Selected {len(selected)} competitive-extra words")
    print(f"Total competitive pool: {len(answers) + len(selected)}")

    # Show score distribution
    scores = [s for _, s in scored[:TARGET_EXTRA]]
    print(f"Score range: {scores[-1]:.3f} – {scores[0]:.3f}")
    print(f"Top 5: {scored[:5]}")
    print(f"Bottom 5 of selected: {scored[TARGET_EXTRA-5:TARGET_EXTRA]}")

    # Write output
    out_path = DATA_DIR / "competitive_extra.txt"
    with open(out_path, "w", newline="\n") as f:
        for w in sorted(selected):
            f.write(w + "\n")
    print(f"Written to {out_path}")


if __name__ == "__main__":
    main()
