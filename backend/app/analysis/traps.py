"""Trap pattern detection for Wordle endgame scenarios.

A 'trap' occurs when several remaining words share a pattern suffix or prefix
and only one letter position differentiates them — forcing inefficient guessing.
"""
from __future__ import annotations

COMMON_TRAP_SUFFIXES = ["IGHT", "ATCH", "OUND", "OULD", "ASTE", "ANCE", "ANGE"]


def detect_trap(remaining_words: list[str]) -> dict | None:
    """Detect if the remaining word set forms a trap pattern.

    A trap is identified when 4 or more words share a common suffix or differ
    in only one position.

    Args:
        remaining_words: List of 5-letter answer words still possible.

    Returns:
        A dict with keys ``suffix``, ``trapped_words``, ``differing_letters``,
        and ``trap_size``; or ``None`` if no trap is detected.
    """
    if len(remaining_words) < 4:
        return None

    # Check for shared suffixes of length 3 and 4
    for suffix_len in (4, 3):
        suffix_map: dict[str, list[str]] = {}
        for word in remaining_words:
            suffix = word[-suffix_len:]
            suffix_map.setdefault(suffix, []).append(word)

        for suffix, words in suffix_map.items():
            if len(words) >= 4:
                differing: set[str] = set()
                for word in words:
                    prefix = word[: 5 - suffix_len]
                    differing.update(prefix)
                return {
                    "suffix": "_" + suffix,
                    "trapped_words": words,
                    "differing_letters": sorted(differing),
                    "trap_size": len(words),
                }

    # Check for single-position variation among all remaining words
    for pos in range(5):
        groups: dict[str, list[str]] = {}
        for word in remaining_words:
            key = word[:pos] + "_" + word[pos + 1 :]
            groups.setdefault(key, []).append(word)

        for pattern, words in groups.items():
            if len(words) >= 4:
                return {
                    "suffix": pattern,
                    "trapped_words": words,
                    "differing_letters": sorted({w[pos] for w in words}),
                    "trap_size": len(words),
                }

    return None
