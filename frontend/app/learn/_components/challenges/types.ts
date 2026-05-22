import { TileState } from '../TileRow';

/* ──────────────────────────────────────────────────────────────────
 *  Challenge contracts
 *
 *  Each challenge variant is a discriminated union member. The runner
 *  reads `kind`, mounts the matching component, and the component reports
 *  back via `onResolve(correct: boolean)`.
 *
 *  Keep challenge payloads small + declarative — content authors define
 *  them as plain data in `_lessons/m{n}l{k}.ts`. No render logic here.
 * ──────────────────────────────────────────────────────────────────
 */

export type Challenge =
  | TileTapChallenge
  | TilePaintChallenge
  | MultipleChoiceChallenge
  | GuessTheNextChallenge
  | RevealCardChallenge
  | WordSurvivorsChallenge
  | SortIntoBucketsChallenge
  | PoolShrinkChallenge
  | LetterPickerChallenge;

/* Click the tile that should be a specific colour, given a guess+target pair. */
export interface TileTapChallenge {
  kind: 'tile-tap';
  prompt: string;
  guess: string;
  target: string;
  /** which tile is the right answer (0-indexed) */
  correctIdx: number;
  /** what colour the correct tile should be */
  correctState: TileState;
  /** the tiles already revealed before this challenge (e.g. previously known greens) */
  initialReveal?: TileState[];
  successNote?: string;
}

/* Paint each tile with its colour (correct/present/absent) for a known target.
   User taps each tile to cycle through colours; submits when done. */
export interface TilePaintChallenge {
  kind: 'tile-paint';
  prompt: string;
  guess: string;
  target: string;
  successNote?: string;
}

/* Pick the right option from 2-4 visual cards. */
export interface MultipleChoiceChallenge {
  kind: 'multiple-choice';
  prompt: string;
  options: Array<{
    label: string;
    /** Optional preview of a guess+pattern shown on the card. */
    word?: string;
    pattern?: TileState[];
    /** Short subtitle shown on the card */
    sub?: string;
  }>;
  correctIdx: number;
  successNote?: string;
}

/* Pick which guess to play next — same as MC but flavoured for "next move". */
export interface GuessTheNextChallenge {
  kind: 'guess-next';
  prompt: string;
  /** prior rows in the game so far */
  history: Array<{ guess: string; pattern: TileState[] }>;
  options: Array<{
    word: string;
    /** if the user picks this and it's right, this pattern is what plays out */
    revealPattern?: TileState[];
    sub?: string;
  }>;
  correctIdx: number;
  successNote?: string;
}

/* Pure narrative beat — no question, just an animated reveal. The user
   presses "Got it" and continues. Cheap way to deliver one fact or one
   nice viz between challenges without breaking flow. */
export interface RevealCardChallenge {
  kind: 'reveal';
  title: string;
  body: string;
  /** Optional tile row to animate in alongside the text */
  guess?: string;
  target?: string;
  pattern?: TileState[];
}

/* Constraint-filter mini-game. Given a stated set of constraints (shown as
 * chips), click which of N candidate words still survive. Wrong picks
 * highlight red; correct picks green. Submit when done. */
export interface WordSurvivorsChallenge {
  kind: 'word-survivors';
  prompt: string;
  /** Human-readable constraints displayed as chips above the word grid */
  constraints: string[];
  /** All candidate words shown; `survives` is the canonical answer */
  candidates: Array<{ word: string; survives: boolean }>;
  successNote?: string;
}

/* Drag-or-tap classification game. User assigns each item to a bucket. */
export interface SortIntoBucketsChallenge {
  kind: 'sort-buckets';
  prompt: string;
  buckets: Array<{ id: string; label: string }>;
  items: Array<{ id: string; label: string; bucketId: string }>;
  successNote?: string;
}

/* Pool-shrink visualization. Walk through ordered constraints, each one
 * removing a chunk from a population of dots. Pedagogical viz for "bits"
 * and entropy lessons. User taps to advance through steps. */
export interface PoolShrinkChallenge {
  kind: 'pool-shrink';
  prompt: string;
  /** Starting population size, e.g. 100 dots representing ~2300 candidates */
  startCount: number;
  /** Ordered constraint steps, each chopping the pool down */
  steps: Array<{
    label: string;
    remaining: number;
    /** Hint shown when the step is active */
    note?: string;
  }>;
  successNote?: string;
}

/* Build a 5-letter probe from the alphabet. User taps letters to select 5,
 * then submits. We grade by what fraction of the chosen letters are
 * "useful" (not already known absent / not already known position). */
export interface LetterPickerChallenge {
  kind: 'letter-picker';
  prompt: string;
  /** Letters already known absent (will appear gray-locked in the keyboard) */
  absent: string[];
  /** Letters already known present somewhere (yellow-locked, can still pick them) */
  known: string[];
  /** A target probe word (or set of acceptable words) the user is trying to find */
  validProbes: string[];
  successNote?: string;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  /** Short, displayed under title at the start of the lesson */
  subtitle?: string;
  challenges: Challenge[];
}

export interface Module {
  id: string;
  title: string;
  blurb: string;
  lessons: Lesson[];
}
