"""Strategic pattern detection — engine-side analysis, no LLM required.

Patterns are derived entirely from pre-computed move analysis data produced by
the information-theory engine.  Each detected pattern is returned as a dict
with the keys:

    pattern_type  : str  — machine-readable identifier
    description   : str  — human-readable explanation
    severity      : str  — "positive" | "info" | "warning"
    move_number   : int  — (optional) 1-based move that triggered the pattern
    details       : dict — (optional) extra numeric context
"""
from __future__ import annotations

# ---------------------------------------------------------------------------
# Opening Theory Catalogue
# ---------------------------------------------------------------------------

OPENING_THEORIES: dict[str, dict] = {
    "SALET": {
        "name": "SALET System",
        "description": "Optimal by 2-step lookahead",
        "tier": "optimal",
    },
    "CRANE": {
        "name": "CRANE Opening",
        "description": "Top-tier information opener",
        "tier": "elite",
    },
    "SLATE": {
        "name": "SLATE Opening",
        "description": "High-entropy common opener",
        "tier": "elite",
    },
    "TRACE": {
        "name": "TRACE Opening",
        "description": "Strong letter coverage",
        "tier": "strong",
    },
    "CRATE": {
        "name": "CRATE Opening",
        "description": "Anagram of TRACE/CARET",
        "tier": "strong",
    },
    "RAISE": {
        "name": "RAISE Opening",
        "description": "Popular competitive opener",
        "tier": "strong",
    },
    "STARE": {
        "name": "STARE Opening",
        "description": "Tests S-T-A-R-E frequencies",
        "tier": "strong",
    },
    "SOARE": {
        "name": "SOARE Opening",
        "description": "Optimal by greedy 1-step entropy",
        "tier": "optimal",
    },
    "ADIEU": {
        "name": "ADIEU Vowel Rush",
        "description": "4 vowels in one guess — max vowel coverage",
        "tier": "vowel",
    },
    "AUDIO": {
        "name": "AUDIO Vowel Rush",
        "description": "4 vowels, different positions than ADIEU",
        "tier": "vowel",
    },
    "ARISE": {
        "name": "ARISE Opening",
        "description": "Common competitive choice",
        "tier": "strong",
    },
    "IRATE": {
        "name": "IRATE Opening",
        "description": "High information with I placement",
        "tier": "strong",
    },
}


def detect_opening_theory(first_guess: str) -> dict | None:
    """Detect and name the player's opening strategy.

    Args:
        first_guess: The player's first guess word (any case).

    Returns:
        A dict with ``name``, ``description``, and ``tier`` keys if the
        opening is in the known catalogue, otherwise ``None``.
    """
    return OPENING_THEORIES.get(first_guess.upper())


def detect_strategic_patterns(
    analysis_moves: list[dict], player_elo: float
) -> list[dict]:
    """Detect strategic patterns from analyzed game moves.

    Args:
        analysis_moves: List of per-move analysis dicts as returned by
            ``app.analysis.engine.analyze_game`` (the ``"moves"`` key).
        player_elo: Current ELO rating of the player, used for future
            skill-level-gated pattern thresholds.

    Returns:
        List of pattern dicts, each containing at minimum
        ``pattern_type``, ``description``, and ``severity``.
    """
    patterns: list[dict] = []

    if not analysis_moves:
        return patterns

    # Pre-compute which positions were confirmed green after each move
    green_positions_by_move: list[set[int]] = []
    for m in analysis_moves:
        tiles = _decode_pattern(m["pattern"])
        greens = {i for i, t in enumerate(tiles) if t == 2}
        green_positions_by_move.append(greens)

    # ------------------------------------------------------------------
    # 1. Green Chasing
    #    Player already has 2+ confirmed greens but wastes a guess by
    #    testing fewer than 2 new letters.
    # ------------------------------------------------------------------
    for i in range(1, len(analysis_moves)):
        prev_greens: set[int] = set()
        for j in range(i):
            prev_greens |= green_positions_by_move[j]

        if len(prev_greens) >= 2:
            prev_letters_tested: set[str] = set()
            for j in range(i):
                prev_letters_tested.update(analysis_moves[j]["guess_word"].upper())

            guess = analysis_moves[i]["guess_word"].upper()
            new_letters = sum(1 for c in guess if c not in prev_letters_tested)

            if new_letters < 2 and analysis_moves[i].get("classification") in (
                "inaccuracy",
                "mistake",
                "blunder",
            ):
                patterns.append(
                    {
                        "pattern_type": "green_chasing",
                        "description": (
                            "Green Chasing — you re-used known letters instead of"
                            " exploring new positions"
                        ),
                        "severity": "warning",
                        "move_number": analysis_moves[i]["move_number"],
                    }
                )

    # ------------------------------------------------------------------
    # 2. Letter Coverage Gap
    #    First 2 guesses test fewer than 8 unique letters.
    # ------------------------------------------------------------------
    if len(analysis_moves) >= 2:
        letters_tested: set[str] = set()
        for m in analysis_moves[:2]:
            letters_tested.update(m["guess_word"].upper())

        if len(letters_tested) < 8:
            patterns.append(
                {
                    "pattern_type": "letter_coverage_gap",
                    "description": (
                        f"Letter Coverage Gap — your first 2 guesses only tested"
                        f" {len(letters_tested)} unique letters (aim for 8+)"
                    ),
                    "severity": "info",
                    "details": {"letters_tested": len(letters_tested)},
                }
            )

    # ------------------------------------------------------------------
    # 3. Endgame Panic
    #    Efficiency drops by more than 30 percentage points between
    #    midgame and endgame (excluding forced moves).
    # ------------------------------------------------------------------
    midgame_effs = [
        m["efficiency_ratio"]
        for m in analysis_moves
        if m.get("game_phase") == "midgame"
        and m.get("classification") != "forced"
        and m.get("efficiency_ratio") is not None
    ]
    endgame_effs = [
        m["efficiency_ratio"]
        for m in analysis_moves
        if m.get("game_phase") == "endgame"
        and m.get("classification") != "forced"
        and m.get("efficiency_ratio") is not None
    ]

    if midgame_effs and endgame_effs:
        mid_avg = sum(midgame_effs) / len(midgame_effs) * 100
        end_avg = sum(endgame_effs) / len(endgame_effs) * 100
        if mid_avg - end_avg > 30:
            patterns.append(
                {
                    "pattern_type": "endgame_panic",
                    "description": (
                        f"Endgame Panic — your accuracy dropped from"
                        f" {mid_avg:.0f}% to {end_avg:.0f}% in the endgame"
                    ),
                    "severity": "warning",
                }
            )

    # ------------------------------------------------------------------
    # 4. Trap Blindness
    #    Player guessed inside a known trap pattern without first
    #    playing an elimination word.
    # ------------------------------------------------------------------
    for m in analysis_moves:
        if m.get("trap_detected") and m.get("classification") in (
            "mistake",
            "blunder",
            "miss",
        ):
            patterns.append(
                {
                    "pattern_type": "trap_blindness",
                    "description": (
                        "Trap Blindness — you guessed within a trap pattern"
                        " without using an elimination word"
                    ),
                    "severity": "warning",
                    "move_number": m["move_number"],
                }
            )

    # ------------------------------------------------------------------
    # 5. Strong Opening Theory
    #    First guess is a recognised optimal opener (is_book_move flag).
    #    We enrich the pattern with the named theory from the catalogue
    #    when available so the UI can display the specific opening name.
    # ------------------------------------------------------------------
    if analysis_moves and analysis_moves[0].get("is_book_move"):
        first_guess = analysis_moves[0]["guess_word"]
        theory = detect_opening_theory(first_guess)
        if theory:
            desc = (
                f"{theory['name']} — {theory['description']}"
                f" (tier: {theory['tier']})"
            )
        else:
            desc = f"Strong Opening — {first_guess} is a recognized optimal opener"

        patterns.append(
            {
                "pattern_type": "strong_opening",
                "description": desc,
                "severity": "positive",
                "details": theory or {},
            }
        )

    return patterns


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _decode_pattern(pattern: int) -> list[int]:
    """Decode a ternary-encoded pattern integer into a 5-element tile list.

    Each tile value: 0 = gray, 1 = yellow, 2 = green.
    The encoding is ``sum(val * 3**pos)`` for positions 0–4.

    Args:
        pattern: Ternary integer in the range 0–242.

    Returns:
        List of 5 integers (position 0 first).
    """
    tiles: list[int] = []
    for _ in range(5):
        tiles.append(pattern % 3)
        pattern //= 3
    return tiles
