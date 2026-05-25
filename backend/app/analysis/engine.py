"""Core information-theory analysis engine.

Provides word list management, pattern computation, and optimal-guess
ranking backed by a pre-computed numpy pattern matrix.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

# ---------------------------------------------------------------------------
# Global state — populated by load_word_lists() + precompute_pattern_matrix()
# ---------------------------------------------------------------------------
ANSWERS: list[str] = []               # Standard answer pool (2,309 words)
COMPETITIVE_ANSWERS: list[str] = []   # Expanded competitive pool (ANSWERS + extra ≈ 5,009)
VALID_GUESSES: list[str] = []
ALL_WORDS: list[str] = []             # COMPETITIVE_ANSWERS ++ remaining VALID_GUESSES
PATTERN_MATRIX: np.ndarray | None = None  # shape: (len(ALL_WORDS), len(COMPETITIVE_ANSWERS))

_DATA_DIR = Path(__file__).parent.parent.parent / "data"
_CACHE_DIR = Path(__file__).parent.parent.parent / ".cache"


# ---------------------------------------------------------------------------
# Word list management
# ---------------------------------------------------------------------------

def load_word_lists() -> None:
    """Load answer and valid-guess word lists from the data directory.

    After loading, the global arrays satisfy:
        COMPETITIVE_ANSWERS[:len(ANSWERS)] == ANSWERS   (subset invariant)
        ALL_WORDS[:len(COMPETITIVE_ANSWERS)] == COMPETITIVE_ANSWERS
    """
    global ANSWERS, COMPETITIVE_ANSWERS, VALID_GUESSES, ALL_WORDS
    from app.analysis.words import load_answers, load_competitive_extra, load_valid_guesses

    ANSWERS = load_answers(_DATA_DIR)
    VALID_GUESSES = load_valid_guesses(_DATA_DIR)
    competitive_extra = load_competitive_extra(_DATA_DIR)

    # Competitive pool = standard answers (first) + extra competitive words
    answer_set = set(ANSWERS)
    COMPETITIVE_ANSWERS = ANSWERS + [w for w in competitive_extra if w not in answer_set]

    # ALL_WORDS = competitive answers + remaining valid guesses
    comp_set = set(COMPETITIVE_ANSWERS)
    ALL_WORDS = COMPETITIVE_ANSWERS + [w for w in VALID_GUESSES if w not in comp_set]


# ---------------------------------------------------------------------------
# Pattern computation
# ---------------------------------------------------------------------------

def compute_pattern(guess: str, answer: str) -> int:
    """Compute the ternary-encoded pattern for *guess* against *answer*.

    Encoding: green=2, yellow=1, gray=0.
    Result = sum(value * 3 ** position) for position in 0..4.

    Args:
        guess: 5-letter guess word (uppercase).
        answer: 5-letter answer word (uppercase).

    Returns:
        Integer in [0, 242].
    """
    pattern = [0] * 5
    answer_chars = list(answer)

    # First pass: greens
    for i in range(5):
        if guess[i] == answer[i]:
            pattern[i] = 2
            answer_chars[i] = None  # type: ignore[call-overload]

    # Second pass: yellows
    for i in range(5):
        if pattern[i] == 0 and guess[i] in answer_chars:
            pattern[i] = 1
            answer_chars[answer_chars.index(guess[i])] = None  # type: ignore[call-overload]

    return sum(v * (3 ** i) for i, v in enumerate(pattern))


def pattern_to_tiles(pattern_int: int) -> list[int]:
    """Decode a ternary integer back to a list of 5 tile values [0,1,2].

    Args:
        pattern_int: Ternary-encoded pattern integer.

    Returns:
        List of 5 integers, each 0 (gray), 1 (yellow), or 2 (green).
    """
    tiles: list[int] = []
    for _ in range(5):
        tiles.append(pattern_int % 3)
        pattern_int //= 3
    return tiles


# ---------------------------------------------------------------------------
# Pattern matrix precomputation
# ---------------------------------------------------------------------------

def precompute_pattern_matrix() -> None:
    """Build (or reload from cache) the full pattern matrix.

    Shape: ``(len(ALL_WORDS), len(COMPETITIVE_ANSWERS))``.  Because
    ``ANSWERS`` occupies columns 0..len(ANSWERS)-1 of COMPETITIVE_ANSWERS,
    standard-mode analysis can simply use that column range.

    The matrix is stored as a uint8 numpy array and cached to disk as a .npy
    file so subsequent startups avoid the O(n²) recomputation.
    """
    global PATTERN_MATRIX

    if not ALL_WORDS:
        load_word_lists()

    _CACHE_DIR.mkdir(exist_ok=True)
    cache_path = _CACHE_DIR / "pattern_matrix_v2.npy"

    expected_shape = (len(ALL_WORDS), len(COMPETITIVE_ANSWERS))
    if cache_path.exists():
        loaded = np.load(cache_path)
        if loaded.shape == expected_shape:
            PATTERN_MATRIX = loaded
            return

    n_guesses = len(ALL_WORDS)
    n_answers = len(COMPETITIVE_ANSWERS)
    matrix = np.zeros((n_guesses, n_answers), dtype=np.uint8)
    for i, guess in enumerate(ALL_WORDS):
        for j, answer in enumerate(COMPETITIVE_ANSWERS):
            matrix[i, j] = compute_pattern(guess, answer)

    PATTERN_MATRIX = matrix
    np.save(cache_path, matrix)


# ---------------------------------------------------------------------------
# Index helpers
# ---------------------------------------------------------------------------

_word_index_cache: dict[str, int] = {}


def get_word_index(word: str) -> int:
    """Return the index of *word* in ALL_WORDS (builds a cache on first call).

    Raises:
        ValueError: If the word is not found.
    """
    global _word_index_cache
    if not _word_index_cache:
        _word_index_cache = {w: i for i, w in enumerate(ALL_WORDS)}
    idx = _word_index_cache.get(word.upper())
    if idx is None:
        raise ValueError(f"Word '{word}' not found in word list.")
    return idx


def is_valid_word(word: str) -> bool:
    """Return True if *word* is in the combined word list."""
    global _word_index_cache
    if not _word_index_cache and ALL_WORDS:
        _word_index_cache = {w: i for i, w in enumerate(ALL_WORDS)}
    return word.upper() in _word_index_cache


# ---------------------------------------------------------------------------
# Remaining-words filtering
# ---------------------------------------------------------------------------

def get_remaining_answers(
    possible_indices: np.ndarray, guess_word: str, pattern: int
) -> np.ndarray:
    """Filter possible answer indices given a guess and its observed pattern.

    Args:
        possible_indices: Current set of possible answer indices (into ANSWERS).
        guess_word: The guess that was played.
        pattern: Ternary-encoded result pattern.

    Returns:
        Filtered numpy array of remaining possible answer indices.
    """
    guess_idx = get_word_index(guess_word)
    mask = PATTERN_MATRIX[guess_idx, possible_indices] == pattern
    return possible_indices[mask]


# ---------------------------------------------------------------------------
# Information-theory metrics
# ---------------------------------------------------------------------------

def compute_entropy(guess_idx: int, possible_indices: np.ndarray) -> float:
    """Shannon entropy (bits) of a guess distribution over possible answers.

    H = -sum(p * log2(p))

    Args:
        guess_idx: Index of the guess word in ALL_WORDS.
        possible_indices: Current possible answer indices.

    Returns:
        Entropy in bits.
    """
    if len(possible_indices) == 0:
        return 0.0
    patterns = PATTERN_MATRIX[guess_idx, possible_indices]
    _, counts = np.unique(patterns, return_counts=True)
    probs = counts / len(possible_indices)
    return float(-np.sum(probs * np.log2(probs + 1e-12)))


def compute_expected_remaining(guess_idx: int, possible_indices: np.ndarray) -> float:
    """Expected remaining words after a guess: sum(bucket² ) / total.

    Lower is better.

    Args:
        guess_idx: Index of the guess word in ALL_WORDS.
        possible_indices: Current possible answer indices.

    Returns:
        Expected remaining count.
    """
    if len(possible_indices) == 0:
        return 0.0
    patterns = PATTERN_MATRIX[guess_idx, possible_indices]
    _, counts = np.unique(patterns, return_counts=True)
    total = len(possible_indices)
    return float(np.sum(counts ** 2) / total)


def compute_negnumbins(guess_idx: int, possible_indices: np.ndarray) -> int:
    """Count the number of distinct (non-empty) pattern buckets produced by a guess.

    More buckets = better discrimination.
    """
    if len(possible_indices) == 0:
        return 0
    patterns = PATTERN_MATRIX[guess_idx, possible_indices]
    return int(len(np.unique(patterns)))


def compute_minimax(guess_idx: int, possible_indices: np.ndarray) -> int:
    """Return the worst-case bucket size (minimise for endgame play)."""
    if len(possible_indices) == 0:
        return 0
    patterns = PATTERN_MATRIX[guess_idx, possible_indices]
    _, counts = np.unique(patterns, return_counts=True)
    return int(np.max(counts))


# ---------------------------------------------------------------------------
# Optimal guess ranking
# ---------------------------------------------------------------------------

# Pre-ranked indices of ALL_WORDS sorted by average single-step entropy
# (populated lazily on first call to find_optimal_guess with large pool)
_TOP_GUESS_INDICES: list[int] | None = None
_TOP_GUESS_COUNT = 350


def _batch_entropy(eval_indices: list[int] | np.ndarray, possible_indices: np.ndarray) -> np.ndarray:
    """Vectorised entropy computation for multiple guesses at once.

    Instead of looping over each guess index and calling np.unique individually,
    extract the full submatrix and compute all entropies in one pass using
    np.apply_along_axis with bincount.

    Returns:
        1-D float64 array of entropy values, one per eval_index.
    """
    if PATTERN_MATRIX is None or len(possible_indices) == 0:
        return np.zeros(len(eval_indices), dtype=np.float64)

    sub = PATTERN_MATRIX[np.asarray(eval_indices)][:, possible_indices]  # (n_eval, n_possible)
    n = sub.shape[1]
    # Use bincount per row — 243 possible pattern values (0..242)
    n_patterns = 243
    counts = np.zeros((sub.shape[0], n_patterns), dtype=np.int32)
    for i in range(sub.shape[0]):
        counts[i] = np.bincount(sub[i], minlength=n_patterns)
    probs = counts / n  # (n_eval, 243)
    mask = probs > 0
    log_probs = np.zeros_like(probs)
    log_probs[mask] = np.log2(probs[mask])
    return -np.sum(probs * log_probs, axis=1)


def _batch_metrics(eval_indices: list[int] | np.ndarray, possible_indices: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Vectorised computation of all four metrics for multiple guesses.

    Returns:
        (entropy, expected_remaining, negnumbins, minimax) — each a 1-D array.
    """
    if PATTERN_MATRIX is None or len(possible_indices) == 0:
        z = np.zeros(len(eval_indices))
        zi = np.zeros(len(eval_indices), dtype=np.int32)
        return z, z, zi, zi

    idx_arr = np.asarray(eval_indices)
    sub = PATTERN_MATRIX[idx_arr][:, possible_indices]  # (n_eval, n_possible)
    n = sub.shape[1]
    n_patterns = 243
    counts = np.zeros((sub.shape[0], n_patterns), dtype=np.int32)
    for i in range(sub.shape[0]):
        counts[i] = np.bincount(sub[i], minlength=n_patterns)

    # Entropy
    probs = counts / n
    mask = probs > 0
    log_probs = np.zeros_like(probs)
    log_probs[mask] = np.log2(probs[mask])
    entropy = -np.sum(probs * log_probs, axis=1)

    # Expected remaining: sum(c^2) / n
    expected_remaining = np.sum(counts.astype(np.float64) ** 2, axis=1) / n

    # Number of non-empty bins
    negnumbins = np.sum(counts > 0, axis=1).astype(np.int32)

    # Minimax: max bucket size
    minimax = np.max(counts, axis=1).astype(np.int32)

    return entropy, expected_remaining, negnumbins, minimax


def _get_top_guess_indices() -> list[int]:
    """Return the top _TOP_GUESS_COUNT guess-word indices by mean entropy."""
    global _TOP_GUESS_INDICES
    if _TOP_GUESS_INDICES is not None:
        return _TOP_GUESS_INDICES

    if PATTERN_MATRIX is None or len(ANSWERS) == 0:
        return list(range(min(_TOP_GUESS_COUNT, len(ALL_WORDS))))

    all_possible = np.arange(len(ANSWERS), dtype=np.int32)
    all_indices = np.arange(len(ALL_WORDS), dtype=np.int32)
    entropies = _batch_entropy(all_indices, all_possible)
    top_indices = np.argsort(-entropies)[:_TOP_GUESS_COUNT]
    _TOP_GUESS_INDICES = top_indices.tolist()
    return _TOP_GUESS_INDICES


def find_optimal_guess(
    possible_indices: np.ndarray,
    n_remaining: int,
    top_n: int = 15,
) -> list[dict]:
    """Rank candidate guesses by the appropriate metric for the current game phase.

    Performance optimisation:
    - When the pool is large (>= 100), only evaluate the 200 pre-ranked guess
      words plus all remaining answer candidates.
    - For small pools, evaluate every word in ALL_WORDS.

    Args:
        possible_indices: Current possible answer indices.
        n_remaining: Number of remaining possible answers (== len(possible_indices)).
        top_n: How many top results to return.

    Returns:
        List of dicts with keys: word, entropy, expected_remaining,
        negnumbins, minimax, is_answer, sort_key.
    """
    answer_set = set(possible_indices.tolist())
    n_answers_total = len(ANSWERS)

    # Decide which word indices to evaluate
    if n_remaining >= 100:
        candidate_indices = set(_get_top_guess_indices())
        candidate_indices.update(possible_indices.tolist())
        eval_indices = list(candidate_indices)
    else:
        eval_indices = list(range(len(ALL_WORDS)))

    # Vectorised batch computation of all four metrics
    entropy_arr, exp_rem_arr, negnumbins_arr, minimax_arr = _batch_metrics(
        eval_indices, possible_indices
    )

    results: list[dict] = []
    for k, i in enumerate(eval_indices):
        entropy = float(entropy_arr[k])
        exp_remaining = float(exp_rem_arr[k])
        negnumbins = int(negnumbins_arr[k])
        minimax_val = int(minimax_arr[k])
        is_answer = i in answer_set

        if n_remaining <= 20:
            # Endgame: minimise worst-case remaining (minimax), then expected
            # remaining, then take the most informative guess; prefer an actual
            # answer candidate only to BREAK TIES (it can win outright).
            #
            # Previously, with <=4 answers left, every candidate was force-ranked
            # above all non-answers via a (-1000, ...) key. That made the engine
            # recommend a lone candidate even when a non-answer probe split the
            # field strictly better — the multi-way "_ILES" trap, where BUMFS
            # (tests B/M/F at once) leaves 1 vs BILES' 3. Minimax already selects
            # the better splitter; the is_answer tiebreak preserves the "just
            # guess it" instinct when a candidate ties a probe (e.g. 2 left).
            sort_key: tuple = (
                float(minimax_val),
                exp_remaining,
                -entropy,
                0 if is_answer else 1,
            )
        else:
            sort_key = (-entropy, float(-negnumbins))

        results.append(
            {
                "word": ALL_WORDS[i],
                "entropy": entropy,
                "expected_remaining": exp_remaining,
                "negnumbins": negnumbins,
                "minimax": minimax_val,
                "is_answer": is_answer,
                "sort_key": sort_key,
            }
        )

    results.sort(key=lambda x: x["sort_key"])
    return results[:top_n]


# ---------------------------------------------------------------------------
# WordleBot-spec metrics
# ---------------------------------------------------------------------------

# Standard NYT-aligned dictionary sizes (echoed in API responses)
DICTIONARY_SIZES: dict = {
    "guesses": 15000,
    "suggestions": 4500,
    "solutions": 3200,
    "legacy": 2309,
}

# Default openers per mode (WordleBot FAQ spec)
STANDARD_MODE_STARTER = "SLATE"
HARD_MODE_STARTER = "CLASP"


def expected_steps_remaining(possible_indices: np.ndarray) -> float:
    """Estimate expected steps until solution from this state.

    Uses the empirical log2-based heuristic:
        E[steps] ≈ max(1, log2(n) / 2.5)

    This is a fast closed-form approximation consistent with the idea that a
    well-played Wordle game narrows the solution space by roughly a factor of
    2^2.5 ≈ 5.7 per turn in the mid-game.

    Args:
        possible_indices: Current possible answer indices.

    Returns:
        Estimated steps remaining (float ≥ 1).
    """
    n = len(possible_indices)
    if n <= 1:
        return 1.0
    return max(1.0, float(np.log2(n)) / 2.5)


def expected_solutions_after(
    guess_idx: int, possible_indices: np.ndarray
) -> float:
    """Expected number of solutions remaining after playing guess_idx.

    Equivalent to compute_expected_remaining — alias exposed for clarity.

    Args:
        guess_idx: Index of guess in ALL_WORDS.
        possible_indices: Current possible answer indices.

    Returns:
        Expected remaining count (lower is better).
    """
    return compute_expected_remaining(guess_idx, possible_indices)


def actual_solutions_after(
    guess_idx: int, possible_indices: np.ndarray, observed_pattern: int
) -> int:
    """Number of solutions remaining after the observed pattern is applied.

    Args:
        guess_idx: Index of guess in ALL_WORDS.
        possible_indices: Current possible answer indices.
        observed_pattern: Ternary-encoded observed pattern integer.

    Returns:
        Count of solutions consistent with the observed pattern.
    """
    if PATTERN_MATRIX is None or len(possible_indices) == 0:
        return 0
    mask = PATTERN_MATRIX[guess_idx, possible_indices] == observed_pattern
    return int(np.sum(mask))


def compute_skill_score(
    player_entropy: float,
    optimal_entropy: float,
) -> int:
    """Compute a 0–99 skill score for a single move.

    Formula:
        ratio = player_entropy / optimal_entropy   (clamped 0–1)
        skill = round(ratio * 99)

    Pure entropy ratio against the optimal pick — no positional bonus.
    99 means the player matched the bot's expected information gain.
    Forced / trivial moves (no entropy to extract) return 99.
    """
    if optimal_entropy < 1e-9:
        return 99
    ratio = min(1.0, player_entropy / optimal_entropy)
    return int(round(ratio * 99.0))


def compute_luck_score(
    info_gained: float,
    player_entropy: float,
    remaining_before: int,
) -> int:
    """Compute a 0–99 luck score for a single move.

    Luck = how much better the actual result was versus expectation.
    A score of 50 is "neutral"; >50 is lucky, <50 is unlucky.

    Formula:
        excess = info_gained - player_entropy   (can be negative)
        max_possible_excess ≈ log2(remaining_before) - player_entropy
        norm = (excess / max(1, max_possible_excess) + 1) / 2  (→ [0,1])
        luck_score = round(clamp(norm * 99, 0, 99))

    Args:
        info_gained: Actual bits of information gained by the observed pattern.
        player_entropy: Expected bits this guess would gain on average.
        remaining_before: Pool size before the guess.

    Returns:
        Integer in [0, 99].  50 ≈ neutral luck.
    """
    excess = info_gained - player_entropy
    max_excess = float(np.log2(max(2, remaining_before))) - player_entropy
    if abs(max_excess) < 1e-9:
        return 50
    norm = (excess / max_excess + 1.0) / 2.0
    return int(round(min(99, max(0, norm * 99.0))))


def bot_best_pick(
    possible_indices: np.ndarray,
    hard_mode: bool = False,
) -> str:
    """Return the bot's best pick word for the current state.

    In hard mode the bot must guess from remaining answer candidates only
    when the pool is small (≤ 20); otherwise it uses the full ranked list.

    Args:
        possible_indices: Current possible answer indices.
        hard_mode: Whether the bot is constrained to hard-mode play.

    Returns:
        The best-pick word (uppercase), or empty string if no words remain.
    """
    if len(possible_indices) == 0:
        return ""
    n = len(possible_indices)
    picks = find_optimal_guess(possible_indices, n, top_n=1)
    if not picks:
        return ""
    # Hard mode constraint: if best pick is not an answer candidate and pool ≤ 20,
    # try to find the best pick that is a candidate
    if hard_mode and n <= 20:
        candidate_indices = set(possible_indices.tolist())
        for pick in find_optimal_guess(possible_indices, n, top_n=20):
            try:
                idx = get_word_index(pick["word"])
                if idx in candidate_indices:
                    return pick["word"]
            except ValueError:
                continue
    return picks[0]["word"]


def bot_solve_path(
    guesses: list[str],
    patterns: list[int],
    hard_mode: bool = False,
    use_past_solutions: bool = False,
) -> list[str]:
    """Simulate the bot's optimal solve path from the game's opening.

    Replays the actual guesses and for each turn records what the bot
    WOULD have picked given the then-current state of knowledge.  This
    gives the per-turn "bot word" shown in the AnalysisHeader strip.

    Args:
        guesses: Actual player guesses (uppercase), in order.
        patterns: Corresponding ternary-encoded patterns.
        hard_mode: Use hard-mode constraints for bot selection.
        use_past_solutions: If True, consider past solutions in the pool.

    Returns:
        List of bot-optimal words, one per turn (same length as guesses).
    """
    if PATTERN_MATRIX is None or len(ANSWERS) == 0:
        return [""] * len(guesses)

    answer_pool = ANSWERS
    possible = np.arange(len(answer_pool), dtype=np.int32)
    path: list[str] = []

    for guess, pattern in zip(guesses, patterns):
        bot_pick = bot_best_pick(possible, hard_mode=hard_mode)
        path.append(bot_pick)
        # Narrow the pool using the actual observed pattern
        try:
            new_possible = get_remaining_answers(possible, guess, pattern)
            possible = new_possible if len(new_possible) > 0 else possible
        except ValueError:
            pass  # unknown word — keep pool unchanged

    return path


def uniqueness_percentile(
    guesses: list[str],
    patterns: list[int],
) -> int:
    """Estimate "1 in N" uniqueness of the full color-pattern grid.

    Uses a deterministic hash-based proxy.  Real implementation would
    compare against community game records in the database.

    TODO: Replace with a real DB query counting how many other completed
    games share the same sequence of (guess, pattern) pairs.  The query
    would look like:
        SELECT COUNT(*) FROM games WHERE move_fingerprint = :fp
    where move_fingerprint is a stable hash of the (guess, pattern) sequence.

    Args:
        guesses: Ordered player guess words.
        patterns: Ordered ternary-encoded patterns.

    Returns:
        N such that the grid is "1 in N" (integer ≥ 1).
    """
    # Build a stable fingerprint from the guess+pattern sequence
    import hashlib
    fp = "|".join(f"{g}:{p}" for g, p in zip(guesses, patterns))
    digest = hashlib.sha256(fp.encode()).digest()
    # Map first 3 bytes to a range [10, 5000]
    raw = int.from_bytes(digest[:3], "big")  # 0..16777215
    n = 10 + (raw % 4991)  # 10..5000
    return n
