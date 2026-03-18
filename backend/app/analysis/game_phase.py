"""Game phase detection utilities."""
from __future__ import annotations


def detect_game_phase(remaining_words: int, move_number: int) -> str:
    """Determine which phase of the game a move belongs to.

    Args:
        remaining_words: Number of possible answers before this move.
        move_number: 1-based move index.

    Returns:
        'opening', 'midgame', or 'endgame'.
    """
    if remaining_words > 200 or move_number <= 2:
        return "opening"
    elif remaining_words <= 5:
        return "endgame"
    else:
        return "midgame"
