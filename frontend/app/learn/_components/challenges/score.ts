/**
 * Standard Wordle scoring — duplicate-aware. Greens first, then leftward
 * yellows consume target letters until exhausted, rest are gray.
 *
 * Exported so challenge variants can compare a user's painted pattern to
 * the canonical answer.
 */
import type { TileState } from '../TileRow';

export function scoreGuess(guess: string, target: string): TileState[] {
  const g = guess.toUpperCase();
  const t = target.toUpperCase();
  const result: TileState[] = ['absent', 'absent', 'absent', 'absent', 'absent'];
  const targetChars: (string | null)[] = t.split('');

  for (let i = 0; i < 5; i++) {
    if (g[i] === t[i]) {
      result[i] = 'correct';
      targetChars[i] = null;
    }
  }
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue;
    const idx = targetChars.indexOf(g[i]);
    if (idx !== -1) {
      result[i] = 'present';
      targetChars[idx] = null;
    }
  }
  return result;
}

export function patternsEqual(a: TileState[], b: TileState[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((s, i) => s === b[i]);
}
