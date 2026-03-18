"""
Utility script to regenerate or validate the word list files.

Usage:
    python scripts/generate_wordlists.py [--validate] [--count]

Options:
    --validate   Check that all words are exactly 5 letters and lowercase.
    --count      Print word counts for both files.
    --dedup      Remove duplicates from both files in-place.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
ANSWERS_FILE = DATA_DIR / "answers.txt"
VALID_GUESSES_FILE = DATA_DIR / "valid_guesses.txt"


def read_words(path: Path) -> list[str]:
    with open(path) as fh:
        return [line.strip().lower() for line in fh if line.strip()]


def validate_words(words: list[str], label: str) -> list[str]:
    errors: list[str] = []
    for word in words:
        if len(word) != 5:
            errors.append(f"  [{label}] '{word}' is {len(word)} letters (expected 5)")
        if not word.isalpha():
            errors.append(f"  [{label}] '{word}' contains non-alpha characters")
    return errors


def dedup(words: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for w in words:
        if w not in seen:
            seen.add(w)
            result.append(w)
    return result


def write_words(path: Path, words: list[str]) -> None:
    with open(path, "w") as fh:
        fh.write("\n".join(words) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--validate", action="store_true", help="Validate word files")
    parser.add_argument("--count", action="store_true", help="Print word counts")
    parser.add_argument("--dedup", action="store_true", help="Deduplicate word files in-place")
    args = parser.parse_args()

    answers = read_words(ANSWERS_FILE)
    valid_guesses = read_words(VALID_GUESSES_FILE)

    if args.count or not any([args.validate, args.dedup]):
        print(f"answers.txt       : {len(answers):,} words")
        print(f"valid_guesses.txt : {len(valid_guesses):,} words")
        answer_set = set(answers)
        overlap = [w for w in valid_guesses if w in answer_set]
        print(f"Overlap (answers in valid_guesses): {len(overlap):,}")
        combined = len(answer_set | set(valid_guesses))
        print(f"Combined unique   : {combined:,} words")

    if args.validate:
        errors = validate_words(answers, "answers") + validate_words(valid_guesses, "valid_guesses")
        if errors:
            print("\nValidation errors:")
            for e in errors:
                print(e)
            return 1
        else:
            print("\nAll words are valid 5-letter alphabetic strings.")

    if args.dedup:
        deduped_answers = dedup(answers)
        deduped_guesses = dedup(valid_guesses)
        if len(deduped_answers) < len(answers):
            print(f"Removed {len(answers) - len(deduped_answers)} duplicate answers.")
            write_words(ANSWERS_FILE, deduped_answers)
        if len(deduped_guesses) < len(valid_guesses):
            print(f"Removed {len(valid_guesses) - len(deduped_guesses)} duplicate valid guesses.")
            write_words(VALID_GUESSES_FILE, deduped_guesses)

    return 0


if __name__ == "__main__":
    sys.exit(main())
