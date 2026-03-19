"""Constraint state tracker for Wordle hard-mode violation detection."""
from __future__ import annotations


class ConstraintState:
    """Tracks all information revealed by previous guesses.

    Used to detect when a subsequent guess ignores known constraints.
    """

    def __init__(self) -> None:
        self.known_absent: set[str] = set()
        self.known_present: set[str] = set()
        self.known_positions: dict[int, str] = {}          # pos → letter (greens)
        self.known_not_positions: dict[str, set[int]] = {}  # letter → banned positions (yellows)

    def update(self, guess: str, pattern: list[int]) -> None:
        """Integrate a guess result into the constraint state.

        Args:
            guess: 5-letter guess word (uppercase).
            pattern: List of 5 tile values — 2=green, 1=yellow, 0=gray.
        """
        for i, (letter, tile) in enumerate(zip(guess, pattern)):
            if tile == 2:  # green
                self.known_positions[i] = letter
                self.known_present.add(letter)
            elif tile == 1:  # yellow
                self.known_present.add(letter)
                self.known_not_positions.setdefault(letter, set()).add(i)
            else:  # gray
                # Only mark absent if the letter hasn't appeared elsewhere
                if letter not in self.known_present:
                    self.known_absent.add(letter)

    def check_violation(self, guess: str) -> dict:
        """Determine if *guess* violates any known constraint.

        Returns:
            A dict with ``type`` ('hard', 'soft', or 'none') and ``reason``
            (a human-readable explanation of what was violated).
        """
        for i, letter in enumerate(guess):
            # Using a definitively absent letter is a hard violation
            if letter in self.known_absent:
                return {
                    "type": "hard",
                    "reason": f"Used letter {letter} which was already ruled out (gray)",
                }
            # Placing a yellow letter back in its banned position
            if letter in self.known_not_positions and i in self.known_not_positions[letter]:
                return {
                    "type": "hard",
                    "reason": f"Placed {letter} in position {i + 1}, already known to be wrong",
                }

        # Check that every known-present letter still appears somewhere
        missing: list[str] = []
        for letter in self.known_present:
            green_positions = {
                pos for pos, ch in self.known_positions.items() if ch == letter
            }
            satisfied = any(
                guess[i] == letter and (
                    i in green_positions or i not in self.known_not_positions.get(letter, set())
                )
                for i in range(5)
            )
            if not satisfied:
                missing.append(letter)

        if missing:
            letters = ", ".join(sorted(missing))
            return {
                "type": "soft",
                "reason": f"Didn't include known letter{'s' if len(missing) > 1 else ''} {letters}",
            }

        return {"type": "none", "reason": ""}
