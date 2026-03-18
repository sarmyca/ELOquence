"""Word list loader helper — used by the analysis engine."""
from __future__ import annotations

from pathlib import Path


def load_answers(data_dir: Path) -> list[str]:
    """Read and return the answer word list (uppercase)."""
    path = data_dir / "answers.txt"
    with open(path) as fh:
        return [w.strip().upper() for w in fh if w.strip()]


def load_valid_guesses(data_dir: Path) -> list[str]:
    """Read and return the extended valid-guess word list (uppercase)."""
    path = data_dir / "valid_guesses.txt"
    with open(path) as fh:
        return [w.strip().upper() for w in fh if w.strip()]
