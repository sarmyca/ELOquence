/**
 * ELO projection helpers — mirrors the formula in
 * `backend/app/services/elo.py` so the review page can show
 * "what would your ELO change be if you'd solved in N guesses?"
 * without an extra round-trip to the server.
 *
 * Keep this file in sync with elo.py:
 *  - performance score weights: accuracy 45%, outcome 35%, time 20%
 *  - outcome component table for wins 1-6, loss=0
 *  - K-factor: 128 for placement games, 32 otherwise
 *  - time sigmoid centred on 60s
 *
 * If the backend formula changes, this file must change too.
 */

const TIME_PAR = 60.0;

const OUTCOME_MAP: Record<number, number> = {
  1: 1.0,
  2: 0.95,
  3: 0.85,
  4: 0.7,
  5: 0.55,
  6: 0.4,
};

function timeScore(seconds: number | null | undefined): number {
  if (seconds == null || seconds <= 0) return 0.5;
  const ratio = seconds / TIME_PAR;
  return 1.0 / (1.0 + ratio * ratio);
}

export function calculatePerformanceScore(opts: {
  accuracy: number;        // 0-100
  numGuesses: number;      // 1-6 if won; ignored if !won
  won: boolean;
  timeSeconds?: number | null;
  includeTime?: boolean;   // false for non-competitive modes (matches backend)
}): number {
  const { accuracy, numGuesses, won, timeSeconds, includeTime = true } = opts;
  const accuracyComponent = accuracy / 100.0;
  const outcomeComponent = won ? OUTCOME_MAP[numGuesses] ?? 0 : 0;
  const timeComponent = includeTime ? timeScore(timeSeconds ?? null) : timeScore(null);
  return 0.45 * accuracyComponent + 0.35 * outcomeComponent + 0.2 * timeComponent;
}

export function calculateEloDelta(opts: {
  playerElo: number;
  wordElo: number;
  performanceScore: number;
  isPlacement: boolean;
}): number {
  const { playerElo, wordElo, performanceScore, isPlacement } = opts;
  const expected = 1.0 / (1.0 + Math.pow(10, (wordElo - playerElo) / 400));
  const k = isPlacement ? 128 : 32;
  return k * (performanceScore - expected);
}

// Minimum magnitude of a sense-guaranteed ELO move. Mirrors _OUTCOME_FLOOR
// in elo.py.
const OUTCOME_FLOOR = 1.0;

/**
 * Guarantee the ELO move's sign matches the game result — mirrors
 * `_apply_outcome_floor` in elo.py:
 *  - a loss (X/6) always costs rating
 *  - a win in ≤3 guesses always gains rating
 * Wins in 4-6 keep their natural value.
 */
export function applyOutcomeFloor(
  delta: number,
  won: boolean,
  numGuesses: number,
): number {
  if (!won) return Math.min(delta, -OUTCOME_FLOOR);
  if (numGuesses <= 3) return Math.max(delta, OUTCOME_FLOOR);
  return delta;
}

/**
 * For each hypothetical guess count 1..6 plus the X (loss) outcome,
 * compute the ELO delta the player WOULD have received if they had
 * finished the game with that outcome, holding accuracy + time fixed.
 *
 * Returns whole-number deltas (rounded the same way `apply_elo_update`
 * persists them on a Game row).
 */
export interface EloProjectionRow {
  label: string;             // "1/6", ..., "X/6"
  numGuesses: number;        // 1..6 for wins; 6 also used for X but won=false
  won: boolean;
  delta: number;             // rounded to int, may be negative
  isActual: boolean;
}

export function projectEloByOutcome(opts: {
  playerElo: number;
  wordElo: number;
  accuracy: number;
  timeSeconds?: number | null;
  includeTime?: boolean;
  isPlacement: boolean;
  actualNumGuesses: number;
  actualWon: boolean;
}): EloProjectionRow[] {
  const rows: EloProjectionRow[] = [];

  for (const n of [1, 2, 3, 4, 5, 6]) {
    const performance = calculatePerformanceScore({
      accuracy: opts.accuracy,
      numGuesses: n,
      won: true,
      timeSeconds: opts.timeSeconds,
      includeTime: opts.includeTime,
    });
    const delta = applyOutcomeFloor(
      calculateEloDelta({
        playerElo: opts.playerElo,
        wordElo: opts.wordElo,
        performanceScore: performance,
        isPlacement: opts.isPlacement,
      }),
      true,
      n,
    );
    rows.push({
      label: `${n}/6`,
      numGuesses: n,
      won: true,
      delta: Math.round(delta),
      isActual: opts.actualWon && opts.actualNumGuesses === n,
    });
  }

  // Loss scenario (X/6): outcome contribution is 0.
  const lossPerf = calculatePerformanceScore({
    accuracy: opts.accuracy,
    numGuesses: 6,
    won: false,
    timeSeconds: opts.timeSeconds,
    includeTime: opts.includeTime,
  });
  const lossDelta = applyOutcomeFloor(
    calculateEloDelta({
      playerElo: opts.playerElo,
      wordElo: opts.wordElo,
      performanceScore: lossPerf,
      isPlacement: opts.isPlacement,
    }),
    false,
    6,
  );
  rows.push({
    label: 'X/6',
    numGuesses: 6,
    won: false,
    delta: Math.round(lossDelta),
    isActual: !opts.actualWon,
  });

  return rows;
}
