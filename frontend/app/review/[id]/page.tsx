'use client';
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  Suspense,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Lock,
  Share2,
  MessageCircle,
  X,
} from 'lucide-react';
import CoachChat from '@/components/CoachChat';
import EloProjection from '@/components/EloProjection';
import { gamesApi, analysisApi, communityApi, aiApi } from '@/lib/api';
import {
  Game,
  AnalysisResult,
  MoveAnalysis,
  PatternBucket,
  TopPick,
  patternToTiles,
} from '@/lib/types';
import clsx from 'clsx';

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                  */
/* ------------------------------------------------------------------ */

const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];

/**
 * Map a move classification to a CSS variable color.
 * Best/brilliant → blue, good → green, okay/book/forced → yellow,
 * inaccuracy/mistake → orange, blunder/miss → red.
 */
function classificationColor(c: string): string {
  switch (c) {
    case 'brilliant':
    case 'best':
      return 'var(--cls-blue)';
    case 'good':
      return 'var(--tile-correct)';
    case 'okay':
    case 'forced':
    case 'book':
      return 'var(--tile-present)';
    case 'inaccuracy':
    case 'mistake':
      return 'var(--cls-orange)';
    case 'blunder':
    case 'miss':
      return 'var(--cls-red)';
    default:
      return 'var(--text-tertiary)';
  }
}

function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `${n}th`;
}

function infoPct(m: MoveAnalysis): number {
  if (m.pattern === 242) return 100;
  const gained = m.info_gained ?? 0;
  const optimal = m.optimal_info ?? 0;
  return Math.min(100, Math.round((gained / Math.max(optimal, 0.0001)) * 100));
}

/**
 * Probability, before the pattern was revealed, that the guessed word was
 * actually the solution. If the word isn't one of the remaining candidate
 * answers it can't possibly be the solution, so we return 0% (not "—").
 */
function probWasSolution(
  guessWord: string,
  targetWord: string | null,
  remainingBefore: number,
  remainingWordsList?: string[],
): string {
  if (!guessWord) return '—';
  if (guessWord === targetWord) return '100%';
  if (remainingWordsList && remainingWordsList.length > 0) {
    if (remainingWordsList.includes(guessWord)) {
      return `${Math.round(100 / Math.max(1, remainingBefore))}%`;
    }
    return '0%';
  }
  return '—';
}

function highlightPair(
  yourVal: number | null,
  botVal: number | null,
  direction: 'lower' | 'higher',
): [boolean, boolean] {
  if (yourVal === null && botVal === null) return [false, false];
  if (yourVal === null) return [false, true];
  if (botVal === null) return [true, false];
  const eps = 0.001;
  if (Math.abs(yourVal - botVal) < eps) return [true, true];
  if (direction === 'lower') {
    return yourVal < botVal ? [true, false] : [false, true];
  }
  return yourVal > botVal ? [true, false] : [false, true];
}

function buildCommentary(m: MoveAnalysis, optimalWord: string): string {
  const skill = m.skill_score ?? 0;
  const isOpener = m.move_number === 1;
  const isSolving = m.pattern === 242;
  const isForced = m.classification === 'forced';
  const pct = infoPct(m);
  const exactMatch = m.guess_word === optimalWord;
  // "Tied" = info gain is within 1% of optimal but the word itself differs.
  // This is the multiple-best-picks case (e.g. CRONY vs DRAIN both ~6.3 bits).
  const tiedWithBot = !exactMatch && pct >= 99;

  const suffix = isSolving ? ' Puzzle solved.' : '';
  const violationNote =
    m.constraint_violation && m.constraint_violation !== 'none'
      ? ' Note: this didn’t reuse a revealed hint.'
      : '';

  if (isForced) return 'Only one word left — locked in.';

  if (isOpener) {
    if (skill >= 90) {
      return `Strong opener — sets up the rest of the game well.`;
    }
    if (skill >= 75) {
      return `Reasonable opener, though ${optimalWord} splits the field slightly better.`;
    }
    return `Weak opener — ${optimalWord} would have given more information up front.`;
  }

  if (skill >= 95 && exactMatch) {
    return `Excellent work — I’d have played this exact word.${suffix}${violationNote}`;
  }
  if (skill >= 95 && tiedWithBot) {
    return `Tied with my pick — your ${m.guess_word} and ${optimalWord} extract essentially the same information. My tiebreaker landed on ${optimalWord}.${suffix}${violationNote}`;
  }
  if (skill >= 95) {
    return `Solid choice. Mine was ${optimalWord} but yours is essentially as good.${suffix}${violationNote}`;
  }
  if (skill >= 80) {
    return `Good guess — ${optimalWord} would have been slightly sharper.${suffix}${violationNote}`;
  }
  if (skill >= 60) {
    return `Decent guess, but ${optimalWord} would have narrowed things down faster.${suffix}${violationNote}`;
  }
  if (skill >= 30) {
    return `This one missed some easy information — I’d have played ${optimalWord}.${suffix}${violationNote}`;
  }
  return `Tough call. ${optimalWord} would have eliminated far more candidates.${suffix}${violationNote}`;
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                             */
/* ------------------------------------------------------------------ */

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx('skeleton rounded-lg', className)}
      style={{ backgroundColor: 'var(--bg-muted)' }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Metric chip                                                          */
/* ------------------------------------------------------------------ */

function Chip({
  value,
  highlighted,
}: {
  value: string;
  highlighted: boolean;
}) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-pill px-3 py-1.5 font-display font-semibold tabular-nums text-base min-w-[60px]"
      style={
        highlighted
          ? { backgroundColor: 'var(--tile-correct)', color: '#fff' }
          : {
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
            }
      }
    >
      {value}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Mini tile row (for pattern groups)                                  */
/* ------------------------------------------------------------------ */

function MiniPatternRow({ pattern }: { pattern: number }) {
  const tiles = patternToTiles(pattern);
  return (
    <div className="flex gap-0.5">
      {tiles.map((state, i) => {
        let bg = 'var(--tile-absent)';
        if (state === 'correct') bg = 'var(--tile-correct)';
        else if (state === 'present') bg = 'var(--tile-present)';
        return (
          <div
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: 2,
              backgroundColor: bg,
            }}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Navigator grid (6×5 Wordle tiles, clickable rows)                  */
/* ------------------------------------------------------------------ */

function NavigatorGrid({
  guesses,
  patterns,
  activeRow,
  onRowClick,
}: {
  guesses: string[];
  patterns: number[];
  activeRow: number;
  onRowClick: (row: number) => void;
}) {
  const TILE = 26;
  const GAP = 3;

  return (
    <div className="flex flex-col" style={{ gap: GAP }}>
      {Array.from({ length: 6 }).map((_, row) => {
        const guess = guesses[row] || '';
        const pat = patterns[row] !== undefined ? patterns[row] : null;
        const tiles = pat !== null ? patternToTiles(pat) : null;
        const isActive = row === activeRow;
        const hasGuess = !!guess;

        return (
          <div
            key={row}
            onClick={() => hasGuess && onRowClick(row)}
            className="flex transition-all duration-200"
            style={{
              gap: GAP,
              cursor: hasGuess ? 'pointer' : 'default',
              opacity: hasGuess && !isActive ? 0.55 : 1,
              transform: isActive ? 'scale(1.05)' : 'scale(0.97)',
              transformOrigin: 'left center',
            }}
          >
            {Array.from({ length: 5 }).map((_, col) => {
              const letter = guess[col] || '';
              const state = tiles ? tiles[col] : 'empty';
              let bg = 'transparent';
              let border = '1px solid var(--tile-empty-border)';
              if (state === 'correct') { bg = 'var(--tile-correct)'; border = 'none'; }
              else if (state === 'present') { bg = 'var(--tile-present)'; border = 'none'; }
              else if (state === 'absent') { bg = 'var(--tile-absent)'; border = 'none'; }
              else if (letter) { bg = 'var(--bg-muted)'; border = '1px solid var(--border-default)'; }

              return (
                <div
                  key={col}
                  style={{
                    width: TILE,
                    height: TILE,
                    backgroundColor: bg,
                    border,
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {letter && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: tiles ? '#fff' : 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {letter}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stats table (right of grid)                                         */
/* ------------------------------------------------------------------ */

function StatsTable({
  moves,
  activeRow,
}: {
  moves: MoveAnalysis[];
  activeRow: number;
}) {
  const COL = 'font-sans text-[10px] uppercase tracking-[0.08em] text-right';

  return (
    <div className="flex-1 min-w-0">
      <div
        className="grid gap-x-2 sm:gap-x-4 mb-1.5 px-1"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
      >
        {[
          { full: 'SKILL', short: 'SKILL' },
          { full: 'LUCK', short: 'LUCK' },
          { full: 'WORDS LEFT', short: 'LEFT' },
          { full: 'INFO GAINED', short: 'INFO' },
        ].map((h) => (
          <span
            key={h.full}
            className={clsx(COL, 'text-right')}
            style={{ color: 'var(--text-tertiary)' }}
          >
            <span className="sm:hidden">{h.short}</span>
            <span className="hidden sm:inline">{h.full}</span>
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-0.5">
        {moves.map((m, i) => {
          const isActive = i === activeRow;
          const pct = infoPct(m);
          const wordsLeft = m.pattern === 242 ? '—' : String(m.remaining_after ?? '—');
          return (
            <div
              key={i}
              className="grid gap-x-2 sm:gap-x-4 rounded-md px-1 py-0.5"
              style={{
                gridTemplateColumns: 'repeat(4, 1fr)',
                backgroundColor: isActive
                  ? 'color-mix(in srgb, var(--tile-correct) 8%, transparent)'
                  : 'transparent',
              }}
            >
              {[
                String(m.skill_score ?? '—'),
                String(m.luck_score ?? '—'),
                wordsLeft,
                `${pct}%`,
              ].map((val, j) => (
                <span
                  key={j}
                  className="font-display font-semibold tabular-nums text-base text-right"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {val}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MY PICKS expandable                                                  */
/* ------------------------------------------------------------------ */

function BotPicksExpand({
  picks,
  optimalWord,
}: {
  picks: TopPick[];
  optimalWord: string;
}) {
  const [open, setOpen] = useState(false);
  const filtered = picks
    .filter((p) => p.word !== optimalWord)
    .slice(0, 5);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Check
          size={15}
          style={{ color: 'var(--tile-correct)', flexShrink: 0 }}
        />
        <span
          className="font-display font-semibold text-xl uppercase tracking-wide"
          style={{ color: 'var(--text-primary)' }}
        >
          {optimalWord}
        </span>
        <span
          className="font-display font-semibold text-xl tabular-nums"
          style={{ color: 'var(--tile-correct)' }}
        >
          99
        </span>
        {filtered.length > 0 && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="ml-1 p-0.5 rounded"
            style={{ color: 'var(--tile-correct)' }}
            aria-expanded={open}
            aria-label="Show alternative picks"
          >
            <ChevronDown
              size={16}
              style={{
                transform: open ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s',
              }}
            />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && filtered.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex flex-col gap-1 pl-1">
              {filtered.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 text-sm"
                >
                  <span
                    className="font-sans font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-secondary)', minWidth: 52 }}
                  >
                    {p.word}
                  </span>
                  <span
                    className="tabular-nums"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    ~{p.expected_remaining.toFixed(1)} exp.
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Metric matrix row                                                    */
/* ------------------------------------------------------------------ */

type MetricRowData = {
  your: string;
  bot: string;
  label: React.ReactNode;
  yH: boolean;
  bH: boolean;
};

function MetricMatrix({ rows }: { rows: MetricRowData[] }) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <div
          key={i}
          className="grid items-center gap-3"
          style={{ gridTemplateColumns: '60px 1fr 60px' }}
        >
          <div className="flex justify-center">
            <Chip value={r.your} highlighted={r.yH} />
          </div>
          <p
            className="font-sans text-[13px] text-center leading-tight"
            style={{ color: 'var(--text-secondary)' }}
          >
            {r.label}
          </p>
          <div className="flex justify-center">
            <Chip value={r.bot} highlighted={r.bH} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pattern group panel                                                  */
/* ------------------------------------------------------------------ */

function PatternGroupPanel({
  label,
  buckets,
  totalRemaining,
}: {
  label: string;
  buckets: PatternBucket[];
  totalRemaining: number;
}) {
  // Top 3 by count, plus the bucket that contains the actual solution
  // (appended only when it's not already among the top 3 so the user
  // can always see where the answer landed).
  const sorted = [...buckets].sort((a, b) => b.count - a.count);
  const top3 = sorted.slice(0, 3);
  const actualBucket = sorted.find((b) => b.is_actual);
  const actualOutsideTop3 =
    actualBucket && !top3.includes(actualBucket) ? actualBucket : null;

  type Row = { bucket: PatternBucket; isExtra: boolean };
  const rows: Row[] = [
    ...top3.map((b) => ({ bucket: b, isExtra: false })),
    ...(actualOutsideTop3 ? [{ bucket: actualOutsideTop3, isExtra: true }] : []),
  ];

  return (
    <div className="flex-1 min-w-0">
      <p
        className="font-sans text-[10px] uppercase tracking-[0.08em] mb-3"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </p>
      <div className="flex flex-col gap-4">
        {rows.map(({ bucket, isExtra }, i) => {
          const pct =
            totalRemaining > 0
              ? Math.round((bucket.count / totalRemaining) * 100)
              : Math.round((bucket.probability ?? 0) * 100);
          const repWord = bucket.words?.[0] ?? '—';
          const labelText = bucket.is_actual
            ? 'Group with the solution'
            : 'Chance solution is among these words';
          const barColor = bucket.is_actual
            ? 'var(--tile-correct)'
            : 'var(--border-strong)';

          return (
            <div
              key={`${bucket.pattern}-${i}`}
              className="flex flex-col gap-1"
              style={
                isExtra
                  ? {
                      paddingTop: 12,
                      borderTop: '1px dashed var(--border-subtle)',
                    }
                  : undefined
              }
            >
              {isExtra && (
                <span
                  className="font-sans text-[9px] uppercase tracking-[0.08em] mb-1"
                  style={{ color: 'var(--tile-correct)' }}
                >
                  Where the answer landed
                </span>
              )}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <span
                    className="font-sans text-[10px] uppercase tracking-[0.06em]"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    Pattern
                  </span>
                  <MiniPatternRow pattern={bucket.pattern} />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span
                    className="font-sans text-[10px] tracking-[0.02em]"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    e.g.
                  </span>
                  <span
                    className="font-sans font-semibold text-sm uppercase"
                    style={{
                      color: bucket.is_actual
                        ? 'var(--tile-correct)'
                        : 'var(--text-secondary)',
                    }}
                  >
                    {repWord}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span
                    className="font-sans text-[9px] uppercase tracking-[0.06em] text-right leading-tight"
                    style={{ color: 'var(--text-tertiary)', maxWidth: 80 }}
                  >
                    {labelText}
                  </span>
                  <span
                    className="font-display font-semibold tabular-nums text-base"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {pct}%
                  </span>
                </div>
              </div>
              <div
                className="w-full rounded-full overflow-hidden"
                style={{ height: 6, backgroundColor: 'var(--bg-muted)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Per-guess card                                                       */
/* ------------------------------------------------------------------ */

function GuessCard({
  move,
  moveIndex,
  activeRow,
  targetWord,
  gameId,
  aiCacheRef,
}: {
  move: MoveAnalysis;
  moveIndex: number;
  activeRow: number;
  targetWord: string | null;
  gameId: string | null;
  aiCacheRef: { current: Map<number, string> };
}) {
  const n = move.move_number;
  // AI-written per-move commentary. Falls back to the rule-based commentary
  // (`buildCommentary`) if the LLM is unavailable or the request fails.
  // Cache lives on the page so flipping between slides doesn't re-hit Gemini.
  const cachedAi = aiCacheRef.current.get(n) ?? null;
  const [aiCommentary, setAiCommentary] = useState<string | null>(cachedAi);
  const [aiCommentaryLoading, setAiCommentaryLoading] = useState(!cachedAi && !!gameId);

  useEffect(() => {
    if (!gameId) {
      setAiCommentaryLoading(false);
      return;
    }
    if (aiCacheRef.current.has(n)) {
      setAiCommentary(aiCacheRef.current.get(n)!);
      setAiCommentaryLoading(false);
      return;
    }
    let cancelled = false;
    setAiCommentaryLoading(true);
    aiApi
      .explainMove(gameId, n)
      .then((res) => {
        const text = (res.data as { explanation: string }).explanation;
        aiCacheRef.current.set(n, text);
        if (!cancelled) setAiCommentary(text);
      })
      .catch(() => {
        /* leave aiCommentary null; the render path falls back to buildCommentary */
      })
      .finally(() => {
        if (!cancelled) setAiCommentaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, n, aiCacheRef]);
  const isSolving = move.pattern === 242;
  const optimalWord = move.optimal_word ?? move.bot_pick ?? '—';
  const skill = move.skill_score ?? 0;
  const remainBefore = move.remaining_before ?? move.remaining_words ?? 1;
  const picks: TopPick[] = move.top_picks?.length
    ? move.top_picks
    : move.candidates_top_n ?? [];
  const pDist: PatternBucket[] = move.pattern_distribution ?? [];

  const yourExpRem = move.expected_remaining ?? move.expected_solutions_after ?? null;
  const botExpRem = move.optimal_expected_remaining ?? null;
  const yourActual = move.actual_solutions_after ?? null;
  const yourExpSteps = move.expected_steps_until_solution ?? null;

  const yourSolChance = probWasSolution(
    move.guess_word,
    targetWord,
    remainBefore,
    move.remaining_words_list,
  );
  const botSolChance = probWasSolution(
    optimalWord === '—' ? '' : optimalWord,
    targetWord,
    remainBefore,
    move.remaining_words_list,
  );

  const botActualSolutionsAfter = move.optimal_actual_solutions_after ?? null;
  const botExpStepsUntilSolution =
    move.optimal_expected_steps_until_solution ?? null;

  const [expRemH, botExpRemH] = highlightPair(yourExpRem, botExpRem, 'lower');
  const [actualH, botActualH] = highlightPair(
    yourActual,
    botActualSolutionsAfter,
    'lower',
  );
  const yourSolNum =
    yourSolChance === '—' ? null : parseInt(yourSolChance.replace('%', ''));
  const botSolNum =
    botSolChance === '—' ? null : parseInt(botSolChance.replace('%', ''));
  const [solH, botSolH] = highlightPair(yourSolNum, botSolNum, 'higher');
  const [stepsH, botStepsH] = highlightPair(
    yourExpSteps,
    botExpStepsUntilSolution,
    'lower',
  );

  const numGroups = pDist.length;
  const largestGroup =
    pDist.length > 0 ? Math.max(...pDist.map((b) => b.count)) : null;
  const infoGained = move.info_gained ?? 0;
  const optimalInfo = move.optimal_info ?? 0;

  const botPDist: PatternBucket[] = move.optimal_pattern_distribution ?? [];
  const botNumGroups = move.optimal_num_groups ?? (botPDist.length || null);
  const botLargestGroup =
    move.optimal_largest_group ??
    (botPDist.length > 0 ? Math.max(...botPDist.map((b) => b.count)) : null);

  const [groupsH, botGroupsH] = highlightPair(numGroups, botNumGroups, 'higher');
  const [largestH, botLargestH] = highlightPair(largestGroup, botLargestGroup, 'lower');
  const [bitsH, botBitsH] = highlightPair(infoGained, optimalInfo, 'higher');
  const dotStyle = (color: string): React.CSSProperties => ({
    width: 8, height: 8, borderRadius: '50%', backgroundColor: color,
    flexShrink: 0, display: 'inline-block',
  });
  const classColor = move.classification ? classificationColor(move.classification) : 'var(--text-tertiary)';
  const statusIcon: React.ReactNode =
    move.classification === 'forced'
      ? <Lock size={15} style={{ color: classColor, flexShrink: 0 }} />
      : move.classification === 'brilliant' || move.classification === 'best'
      ? <Check size={15} style={{ color: classColor, flexShrink: 0 }} />
      : <span style={dotStyle(classColor)} />;

  return (
    <section
      id={`guess-${n}`}
      data-guess={n}
      className="pt-10 mt-10"
      style={{ borderTop: '1px solid var(--border-subtle)' }}
    >
      <h2
        className="font-display font-semibold text-2xl mb-5"
        style={{ color: 'var(--text-primary)' }}
      >
        Your {ordinal(n)} Guess
      </h2>

      <>
          {/* Comparison row */}
          <div className="flex gap-6 mb-5 flex-wrap min-[520px]:flex-nowrap">
            <div className="flex-1 min-w-0">
              <p
                className="font-sans text-[10px] uppercase tracking-[0.08em] mb-2"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Your Guess
              </p>
              <div className="flex items-center gap-2">
                {statusIcon}
                <span
                  className="font-display font-semibold text-xl uppercase tracking-wide"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {move.guess_word}
                </span>
                <span
                  className="font-display font-semibold text-xl tabular-nums"
                  style={{
                    color:
                      skill >= 95
                        ? 'var(--tile-correct)'
                        : 'var(--text-primary)',
                  }}
                >
                  {skill}
                </span>
                {move.classification && (() => {
                  const c = classificationColor(move.classification);
                  return (
                    <span
                      className="font-sans text-[9px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-pill font-semibold"
                      style={{
                        color: c,
                        backgroundColor: `color-mix(in srgb, ${c} 14%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${c} 35%, transparent)`,
                      }}
                    >
                      {move.classification}
                    </span>
                  );
                })()}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <p
                className="font-sans text-[10px] uppercase tracking-[0.08em] mb-2"
                style={{ color: 'var(--text-tertiary)' }}
              >
                My Picks
              </p>
              {optimalWord === '—' ? (
                <span
                  className="font-display font-semibold text-xl"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  —
                </span>
              ) : (
                <BotPicksExpand
                  picks={picks}
                  optimalWord={optimalWord}
                />
              )}
            </div>
          </div>

          {aiCommentaryLoading ? (
            <div className="mb-6 flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-[85%]" />
            </div>
          ) : (
            <p
              className="font-sans text-[15px] leading-relaxed mb-6"
              style={{ color: 'var(--text-secondary)' }}
            >
              {aiCommentary || buildCommentary(move, optimalWord)}
            </p>
          )}

          {/* Solved variant — skip metrics/groups */}
          {isSolving ? (
            <div
              className="flex items-center gap-3 py-4 px-5 rounded-xl"
              style={{ backgroundColor: 'var(--bg-muted)' }}
            >
              <span
                className="font-display font-semibold text-lg"
                style={{ color: 'var(--tile-correct)' }}
              >
                Puzzle solved in {n}/6
              </span>
              <span
                className="font-display font-semibold text-xl uppercase tracking-wide"
                style={{ color: 'var(--text-primary)' }}
              >
                {move.guess_word}
              </span>
            </div>
          ) : (
            <>
              {/* Metrics matrix */}
              <div
                className="pt-6 mt-6"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                <p
                  className="font-display font-semibold text-base mb-4"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Comparing our guesses
                </p>

                <div className="mb-3">
                  <MetricMatrix rows={[
                    { your: yourExpRem != null ? yourExpRem.toFixed(1) : '—', bot: botExpRem != null ? botExpRem.toFixed(1) : '—', label: 'Expected solutions after guess', yH: expRemH, bH: botExpRemH },
                    { your: yourActual != null ? String(yourActual) : '—', bot: botActualSolutionsAfter != null ? String(botActualSolutionsAfter) : '—', label: 'Actual solutions after guess', yH: actualH, bH: botActualH },
                    // "Est. chance guess was solution" is only meaningful when at least
                    // one side's word is in the answer pool. Both 0% (info-only probes
                    // like SALET/TARES) adds no insight, so hide it in that case.
                    ...((yourSolChance === '0%' || yourSolChance === '—') &&
                       (botSolChance === '0%' || botSolChance === '—')
                      ? []
                      : [{ your: yourSolChance, bot: botSolChance, label: 'Est. chance guess was solution', yH: solH, bH: botSolH }]),
                    { your: yourExpSteps != null ? yourExpSteps.toFixed(2) : '—', bot: botExpStepsUntilSolution != null ? botExpStepsUntilSolution.toFixed(2) : '—', label: 'Expected steps until solution', yH: stepsH, bH: botStepsH },
                  ]} />
                </div>

                <p
                  className="font-sans text-[13px]"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Better outcomes are{' '}
                  <Chip value="highlighted" highlighted={true} />.
                </p>
              </div>

              {/* Pattern groups */}
              {pDist.length > 0 && (
                <div
                  className="pt-6 mt-6"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                >
                  <p
                    className="font-sans text-[15px] leading-relaxed mb-5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Here&rsquo;s how our guesses divided the{' '}
                    <strong
                      style={{ color: 'var(--text-primary)', fontWeight: 600 }}
                    >
                      {remainBefore} solutions
                    </strong>{' '}
                    that I think remained before your guess. (On average, more
                    and smaller groups mean faster solving.)
                  </p>

                  <div className="mb-4">
                    <MetricMatrix rows={[
                      { your: String(numGroups), bot: botNumGroups != null ? String(botNumGroups) : '—', label: 'Number of groups', yH: groupsH, bH: botGroupsH },
                      { your: largestGroup != null ? String(largestGroup) : '—', bot: botLargestGroup != null ? String(botLargestGroup) : '—', label: 'Largest group', yH: largestH, bH: botLargestH },
                      { your: infoGained.toFixed(2), bot: optimalInfo > 0 ? optimalInfo.toFixed(2) : '—', label: <>Bits of <a href="/faq#strategy-math" className="underline" style={{ color: 'var(--tile-correct)' }}>information</a></>, yH: bitsH, bH: botBitsH },
                    ]} />
                  </div>

                  <div className="flex gap-6 flex-wrap min-[520px]:flex-nowrap">
                    <PatternGroupPanel
                      label={`Your Groups, with ${move.guess_word}`}
                      buckets={pDist}
                      totalRemaining={remainBefore}
                    />
                    {botPDist.length > 0 ? (
                      <PatternGroupPanel
                        label={`My Groups, with ${optimalWord}`}
                        buckets={botPDist}
                        totalRemaining={remainBefore}
                      />
                    ) : (
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-sans text-[10px] uppercase tracking-[0.08em] mb-3"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          {`My Groups, with ${optimalWord}`}
                        </p>
                        <p
                          className="font-sans text-sm italic"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          My groups not available for this analysis.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Community panel                                                      */
/* ------------------------------------------------------------------ */

interface WordStats {
  word: string;
  times_played: number;
  times_solved: number;
  solve_rate: number;
  avg_guesses: number | null;
  avg_accuracy: number | null;
  difficulty: number | null;
}

function CommunityPanel({
  gameId,
  targetWord,
  playerGuesses,
}: {
  gameId: string;
  targetWord: string | null;
  playerGuesses: number;
}) {
  const [stats, setStats] = useState<WordStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    communityApi
      .gameStats(gameId)
      .then((res: { data: WordStats }) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [gameId]);

  if (loading) {
    return (
      <section
        className="pt-10 mt-10"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <Skeleton className="h-6 w-48 mb-3" />
        <Skeleton className="h-24" />
      </section>
    );
  }

  if (!stats) return null;

  const hasData = stats.times_played > 0;
  const delta =
    hasData && stats.avg_guesses != null
      ? playerGuesses - stats.avg_guesses
      : null;
  const beatAvg = delta != null && delta < 0;

  return (
    <section
      className="pt-10 mt-10"
      style={{ borderTop: '1px solid var(--border-subtle)' }}
    >
      <h2
        className="font-display font-semibold text-xl mb-1"
        style={{ color: 'var(--text-primary)' }}
      >
        How others did with {targetWord ?? 'this word'}
      </h2>
      <p
        className="font-sans text-[15px] leading-relaxed mb-6"
        style={{ color: 'var(--text-secondary)' }}
      >
        {hasData
          ? `${stats.times_played.toLocaleString()} other ELOquence players have faced this word.`
          : 'No one else has played this word yet — stats will appear as others solve it.'}
      </p>

      {hasData && (
        <div className="flex gap-8 mb-4">
          <div className="flex flex-col gap-0.5">
            <span
              className="font-display font-semibold tabular-nums"
              style={{ fontSize: '2.25rem', lineHeight: 1, color: 'var(--text-primary)' }}
            >
              {Math.round(stats.solve_rate)}%
            </span>
            <span
              className="font-sans text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--text-tertiary)' }}
            >
              solve rate
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span
              className="font-display font-semibold tabular-nums"
              style={{ fontSize: '2.25rem', lineHeight: 1, color: 'var(--text-primary)' }}
            >
              {stats.avg_guesses != null
                ? stats.avg_guesses.toFixed(1)
                : '—'}
            </span>
            <span
              className="font-sans text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--text-tertiary)' }}
            >
              community avg
            </span>
            {delta != null && (
              <span
                className="font-sans text-[12px] mt-0.5"
                style={{
                  color: beatAvg
                    ? 'var(--tile-correct)'
                    : 'var(--text-tertiary)',
                }}
              >
                You: {playerGuesses} ({delta > 0 ? '+' : ''}
                {delta.toFixed(1)} vs avg)
              </span>
            )}
          </div>
        </div>
      )}

      {hasData && (
        <p
          className="font-sans text-[13px] italic"
          style={{ color: 'var(--text-tertiary)' }}
        >
          As more players solve this word, this card gets richer.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Floating Coach FAB + slide-in panel                                 */
/* ------------------------------------------------------------------ */

function CoachFab({
  gameId,
  gameContext,
}: {
  gameId: string;
  gameContext: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Idle pulse ring behind the FAB */}
      <motion.span
        className="fixed bottom-6 right-6 rounded-pill pointer-events-none"
        style={{
          width: 120,
          height: 48,
          zIndex: 39,
          backgroundColor: 'var(--tile-correct)',
          opacity: 0,
        }}
        animate={open ? {} : { opacity: [0, 0.25, 0], scale: [1, 1.18, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.6 }}
      />
      <motion.button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-pill px-5 py-3.5"
        style={{
          backgroundColor: 'var(--tile-correct)',
          color: '#fff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.18), 0 0 0 0 var(--tile-correct)',
        }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        aria-label="Open coach"
      >
        <MessageCircle size={20} />
        <span className="font-sans font-bold text-sm tracking-wide">Coach</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              key="panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-14 right-0 bottom-0 z-40 flex flex-col"
              style={{
                width: '100%',
                maxWidth: 380,
                backgroundColor: 'var(--bg-elevated)',
                borderLeft: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-modal)',
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3 shrink-0"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-center gap-2">
                  <MessageCircle size={15} style={{ color: 'var(--tile-correct)' }} />
                  <span
                    className="font-display font-semibold text-base"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Coach
                  </span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-md"
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-label="Close coach"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <CoachChat
                  gameId={gameId}
                  gameContext={gameContext}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Step panels                                                         */
/* ------------------------------------------------------------------ */

function StepOverview({
  analysis,
  activeRow,
  showExplanation,
  setShowExplanation,
  game,
}: {
  analysis: AnalysisResult;
  activeRow: number;
  showExplanation: boolean;
  setShowExplanation: (fn: (v: boolean) => boolean) => void;
  game: Game | null;
}) {
  return (
    <div>
      <StatsTable moves={analysis.moves} activeRow={activeRow} />

      <div
        className="mt-8 pt-6"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <div className="flex gap-6 flex-wrap mb-3">
          {[
            {
              label: 'Skill',
              value: String(
                Math.round(
                  analysis.skill_avg ?? analysis.skill_avg_excluding_opener ?? 0,
                ),
              ),
              sub: 'your decisions',
            },
            { label: 'Luck', value: String(Math.round(analysis.luck_avg ?? 0)), sub: 'your outcomes' },
            {
              label: 'Opener',
              value: analysis.opener_word || '—',
              sub:
                (analysis.opener_total_games ?? 0) > 1
                  ? `${analysis.opener_rarity_pct ?? 0}% chose differently`
                  : 'first play of this opener',
            },
          ].map(({ label, value, sub }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span
                className="font-sans text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {label}
              </span>
              <span
                className="font-display font-semibold tabular-nums text-3xl leading-none"
                style={{ color: 'var(--text-primary)' }}
              >
                {value}
              </span>
              {sub && (
                <span
                  className="font-sans text-[11px]"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {sub}
                </span>
              )}
            </div>
          ))}
        </div>

        <p
          className="font-sans text-[13px] mb-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          Decision quality vs. how the tiles fell — judged separately.
        </p>

        <button
          onClick={() => setShowExplanation((v) => !v)}
          className="font-sans text-[13px] underline"
          style={{ color: 'var(--tile-correct)' }}
        >
          {showExplanation ? 'Show less' : 'Show more'}
        </button>

        <AnimatePresence>
          {showExplanation && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              {/* ELO distribution — top of the disclosure so it's the
                  first thing the player sees when they open "Show more". */}
              {game && game.rated && game.accuracy_score != null && (
                <div className="mt-4">
                  <EloProjection game={game} accuracy={game.accuracy_score} />
                </div>
              )}

              <div
                className="mt-4 rounded-xl p-4"
                style={{ backgroundColor: 'var(--bg-muted)' }}
              >
                <p
                  className="font-sans font-semibold text-sm mb-3"
                  style={{ color: 'var(--text-primary)' }}
                >
                  How to read the columns
                </p>
                {[
                  {
                    term: 'Skill (0–99)',
                    def: 'How close your guess was to the bot’s best pick — judged before the tiles flip. 99 means you picked a word that would, on average, narrow things down as well as any other word. A low score doesn’t mean you played a bad word — it means there was a clearly better one available.',
                  },
                  {
                    term: 'Luck (50 = average)',
                    def: 'Whether the tiles flipped better or worse than your guess deserved. Above 50: the pattern eliminated more words than expected. Below 50: it eliminated fewer. Same guess, different answer → totally different luck score.',
                  },
                  {
                    term: 'Words left',
                    def: 'How many possible answer words were still in the running before this guess. Starts around 2,300 (full Wordle answer list) and shrinks as the colors narrow things down.',
                  },
                  {
                    term: 'Info gained',
                    def: 'What share of the puzzle’s remaining uncertainty this guess cleared up. 100% would mean you solved it. 50% means you cut the possibilities roughly in half. A great guess clears a lot; a wasted guess clears little.',
                  },
                ].map(({ term, def }) => (
                  <p
                    key={term}
                    className="font-sans text-[13px] leading-relaxed mb-2 last:mb-0"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {term}
                    </strong>{' '}
                    &mdash; {def}
                  </p>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepFinal({
  game,
  analysis,
  router,
}: {
  game: Game | null;
  analysis: AnalysisResult;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div>
      {game && game.status !== 'in_progress' && game.user_id && (
        <CommunityPanel
          gameId={game.id}
          targetWord={game.target_word}
          playerGuesses={game.num_guesses}
        />
      )}
      <footer
        className="pt-10 mt-10 pb-6 flex flex-col gap-3"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <button
          onClick={() => router.push('/play')}
          className="flex items-center gap-1.5 font-sans text-sm self-start"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <ArrowLeft size={14} />
          Back to play
        </button>
      </footer>
    </div>
  );
}

function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loadingGame, setLoadingGame] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stepper navigation. Steps:
  //   0           — Overview (NavigatorGrid + StatsTable + summary banner)
  //   1..N        — One per move (GuessCard)
  //   N+1         — Final (community + actions)
  const [currentStep, setCurrentStep] = useState(0);
  const [stepDir, setStepDir] = useState<1 | -1>(1);
  // Per-move AI commentary survives slide nav so flipping back to a guess
  // doesn't re-call Gemini. Keyed by move_number.
  const aiCacheRef = useRef<Map<number, string>>(new Map());
  const moveCount = analysis?.moves.length ?? 0;
  const totalSteps = moveCount > 0 ? moveCount + 2 : 1;
  // -1 = no row is "current" (e.g. on the Overview or Final step). Per-move
  // steps map to their move index. Used to highlight the active row in the
  // NavigatorGrid and the StatsTable.
  const activeRow =
    currentStep >= 1 && currentStep <= moveCount ? currentStep - 1 : -1;

  useEffect(() => {
    if (!id) return;
    gamesApi
      .get(id)
      .then((res: { data: Game }) => setGame(res.data))
      .catch(() => router.push('/play'))
      .finally(() => setLoadingGame(false));
  }, [id, router]);

  const runAnalysis = useCallback(async () => {
    if (!id) return;
    setLoadingAnalysis(true);
    setAnalysisError('');
    try {
      const res = await analysisApi.analyze(id);
      setAnalysis(res.data);
    } catch {
      setAnalysisError('Analysis failed. The service may be unavailable.');
    } finally {
      setLoadingAnalysis(false);
    }
  }, [id]);

  useEffect(() => {
    if (game && game.status !== 'in_progress') {
      runAnalysis();
    }
  }, [game, runAnalysis]);

  const goToStep = useCallback(
    (next: number) => {
      if (totalSteps <= 1) return;
      const clamped = Math.max(0, Math.min(totalSteps - 1, next));
      setCurrentStep((prev) => {
        if (clamped === prev) return prev;
        setStepDir(clamped > prev ? 1 : -1);
        return clamped;
      });
    },
    [totalSteps],
  );
  // Use functional setters so rapid presses don't stale-capture currentStep
  const goPrev = useCallback(() => {
    if (totalSteps <= 1) return;
    setCurrentStep((prev) => {
      if (prev <= 0) return prev;
      setStepDir(-1);
      return prev - 1;
    });
  }, [totalSteps]);
  const goNext = useCallback(() => {
    if (totalSteps <= 1) return;
    setCurrentStep((prev) => {
      if (prev >= totalSteps - 1) return prev;
      setStepDir(1);
      return prev + 1;
    });
  }, [totalSteps]);
  // Clicking a mini-tile row jumps to that move's step (offset by 1 — step 0 is overview)
  const goToMoveRow = useCallback((row: number) => goToStep(row + 1), [goToStep]);

  // Keyboard navigation — ignore when typing in an input/textarea/contenteditable
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToStep(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToStep(totalSteps - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext, goToStep, totalSteps]);

  // Clamp current step if the analysis arrives and we're somehow past the end
  useEffect(() => {
    if (currentStep > totalSteps - 1) setCurrentStep(totalSteps - 1);
  }, [totalSteps, currentStep]);

  function handleShare() {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200);
  }

  const guesses = game?.moves
    ? [...game.moves].sort((a, b) => a.move_number - b.move_number).map((m) => m.guess_word)
    : [];
  const boardPatterns = game?.moves
    ? [...game.moves].sort((a, b) => a.move_number - b.move_number).map((m) => m.pattern)
    : [];

  const wonGame = game?.status === 'won';
  const lostGame = game?.status === 'lost';
  const eloDelta = game?.elo_delta ?? null;

  if (loadingGame) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  const gameContext = game
    ? `Game: ${game.target_word ?? 'unknown'}, ${game.status} in ${game.num_guesses}/6, mode: ${game.mode}`
    : '';

  return (
    <div
      className="min-h-[calc(100dvh-56px)]"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/* Sticky mini-header */}
      <div
        className="sticky top-0 z-10 h-[52px] flex items-center px-5 gap-3"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          backgroundColor: 'color-mix(in srgb, var(--bg-base) 85%, transparent)',
        }}
      >
        <button
          onClick={() => router.push('/play')}
          className="flex items-center gap-1.5 text-sm"
          style={{ color: 'var(--text-tertiary)' }}
          aria-label="Back to play"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Play</span>
        </button>

        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          {game?.target_word && (
            <span
              className="font-display font-semibold uppercase tracking-wide text-sm"
              style={{ color: 'var(--text-primary)' }}
            >
              {game.target_word}
            </span>
          )}
          <span
            className="inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
            style={{
              backgroundColor: wonGame
                ? 'color-mix(in srgb, var(--tile-correct) 15%, transparent)'
                : 'color-mix(in srgb, var(--text-tertiary) 15%, transparent)',
              color: wonGame ? 'var(--tile-correct)' : 'var(--text-tertiary)',
            }}
          >
            {wonGame
              ? `Won ${game.num_guesses}/6`
              : lostGame
              ? 'Lost'
              : game?.status ?? ''}
          </span>
          {game?.mode && (
            <span
              className="hidden sm:inline rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
              style={{
                backgroundColor: 'var(--bg-muted)',
                color: 'var(--text-tertiary)',
              }}
            >
              {game.mode}
            </span>
          )}
        </div>

        <div className="relative">
          <button
            onClick={handleShare}
            className="p-1.5 rounded-md"
            style={{ color: 'var(--text-tertiary)' }}
            aria-label="Share"
          >
            <Share2 size={16} />
          </button>
          <AnimatePresence>
            {toastVisible && (
              <motion.span
                key="toast"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1 rounded-md px-2.5 py-1.5 text-xs font-sans whitespace-nowrap pointer-events-none"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  zIndex: 99,
                }}
              >
                Link copied
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main column */}
      <div className="max-w-[680px] mx-auto px-5 md:px-0 pb-4 relative">

        {/* Persistent header — compact layout so the analysis box fits in viewport */}
        <div className="pt-6 mb-4 flex items-start gap-6 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <p
              className="font-sans text-[10px] uppercase tracking-[0.1em] mb-1"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Game review
            </p>
            <h1
              className="font-display font-bold uppercase tracking-wide mb-1.5"
              style={{ fontSize: '1.75rem', color: 'var(--text-primary)', lineHeight: 1.1 }}
            >
              {game?.target_word ?? '—'}
            </h1>
            <div
              className="flex items-center gap-2 flex-wrap font-sans text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span>
                {wonGame
                  ? `Won in ${game!.num_guesses}/6`
                  : lostGame
                  ? 'Not solved'
                  : '—'}
              </span>
              <span style={{ color: 'var(--text-tertiary)' }}>·</span>
              <span className="capitalize">{game?.mode ?? '—'}</span>
              {game?.created_at && (
                <>
                  <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                  <span>
                    {new Date(game.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </>
              )}
              {eloDelta != null && eloDelta !== 0 && (
                <span
                  className="rounded-pill px-2 py-0.5 text-[10px] font-semibold tabular-nums"
                  style={{
                    backgroundColor:
                      eloDelta > 0
                        ? 'color-mix(in srgb, var(--tile-correct) 15%, transparent)'
                        : 'color-mix(in srgb, var(--red) 15%, transparent)',
                    color: eloDelta > 0 ? 'var(--tile-correct)' : 'var(--red)',
                  }}
                >
                  {eloDelta > 0 ? '+' : ''}
                  {Math.round(eloDelta)} ELO
                </span>
              )}
            </div>
          </div>

          {/* Persistent NavigatorGrid — sits inline with the title to save vertical space */}
          {analysis && !loadingAnalysis && (
            <div className="shrink-0">
              <NavigatorGrid
                guesses={guesses}
                patterns={boardPatterns}
                activeRow={activeRow}
                onRowClick={goToMoveRow}
              />
            </div>
          )}
        </div>

        {/* Analysis error */}
        {analysisError && (
          <div className="mt-6 flex flex-col gap-3">
            <p className="font-sans text-sm" style={{ color: 'var(--text-secondary)' }}>
              {analysisError}
            </p>
            <button
              onClick={runAnalysis}
              className="self-start font-sans text-sm underline"
              style={{ color: 'var(--tile-correct)' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton for analysis */}
        {loadingAnalysis && (
          <div className="mt-6 flex flex-col gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-16" />
          </div>
        )}

        {/* Step panels — internal scrolling so the page itself stays put */}
        {analysis && !loadingAnalysis && (
          <div
            className="relative"
            style={{ height: 'max(280px, calc(100dvh - 400px))' }}
          >
            {/* Anchored arrows — sit just outside the box, vertically centered with it */}
            {totalSteps > 1 && (
              <>
                <button
                  onClick={goPrev}
                  disabled={currentStep === 0}
                  aria-label="Previous step (←)"
                  className="hidden md:flex absolute -left-32 top-1/2 -translate-y-1/2 z-10 w-11 h-11 items-center justify-center rounded-full transition-all disabled:opacity-0 disabled:pointer-events-none enabled:hover:scale-105"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-secondary)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  onClick={goNext}
                  disabled={currentStep === totalSteps - 1}
                  aria-label="Next step (→)"
                  className="hidden md:flex absolute -right-32 top-1/2 -translate-y-1/2 z-10 w-11 h-11 items-center justify-center rounded-full transition-all disabled:opacity-0 disabled:pointer-events-none enabled:hover:scale-105"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-secondary)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}

            <div className="overflow-x-hidden h-full">
            <AnimatePresence mode="wait" custom={stepDir}>
              <motion.div
                key={currentStep}
                custom={stepDir}
                initial={{ opacity: 0, x: stepDir > 0 ? 40 : -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: stepDir > 0 ? -40 : 40 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="h-full overflow-y-auto pr-1 rounded-card"
                style={{ scrollbarGutter: 'stable' }}
              >
                {currentStep === 0 && (
                  <StepOverview
                    analysis={analysis}
                    activeRow={activeRow}
                    showExplanation={showExplanation}
                    setShowExplanation={setShowExplanation}
                    game={game}
                  />
                )}
                {currentStep >= 1 && currentStep <= moveCount && (
                  <GuessCard
                    move={analysis.moves[currentStep - 1]}
                    moveIndex={currentStep - 1}
                    activeRow={activeRow}
                    targetWord={game?.target_word ?? null}
                    gameId={game?.id ?? null}
                    aiCacheRef={aiCacheRef}
                  />
                )}
                {currentStep === moveCount + 1 && (
                  <StepFinal
                    game={game}
                    analysis={analysis}
                    router={router}
                  />
                )}
              </motion.div>
            </AnimatePresence>
            </div>
          </div>
        )}

        {/* Step indicator dots */}
        {analysis && !loadingAnalysis && totalSteps > 1 && (
          <div
            className="mt-4 flex justify-center items-center gap-1.5"
            role="tablist"
            aria-label="Review steps"
          >
            {Array.from({ length: totalSteps }).map((_, i) => {
              const active = i === currentStep;
              const label =
                i === 0
                  ? 'Overview'
                  : i === moveCount + 1
                  ? 'Final'
                  : `Move ${i}`;
              return (
                <button
                  key={i}
                  role="tab"
                  aria-selected={active}
                  aria-label={label}
                  onClick={() => goToStep(i)}
                  className="rounded-full transition-all focus-visible:outline-none focus-visible:ring-2"
                  style={{
                    width: active ? 18 : 6,
                    height: 6,
                    backgroundColor: active
                      ? 'var(--tile-correct)'
                      : 'var(--border-strong)',
                    outlineColor: 'var(--tile-correct)',
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Step counter + arrow controls */}
        {analysis && !loadingAnalysis && totalSteps > 1 && (
          <div
            className="mt-2 flex items-center justify-center gap-4 font-mono text-xs"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <button
              onClick={goPrev}
              disabled={currentStep === 0}
              aria-label="Previous step"
              className="p-1.5 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:bg-bg-muted"
              style={{ color: 'var(--text-secondary)' }}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="tabular-nums select-none">
              {currentStep + 1} / {totalSteps}
            </span>
            <button
              onClick={goNext}
              disabled={currentStep === totalSteps - 1}
              aria-label="Next step"
              className="p-1.5 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:bg-bg-muted"
              style={{ color: 'var(--text-secondary)' }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>


      {/* Floating coach */}
      {game && analysis && (
        <CoachFab
          gameId={game.id}
          gameContext={gameContext}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export default function ReviewPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
          <div
            className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }}
          />
        </div>
      }
    >
      <ReviewPage />
    </Suspense>
  );
}
