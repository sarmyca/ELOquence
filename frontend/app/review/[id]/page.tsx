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
  Check,
  Lock,
  Share2,
  MessageCircle,
  X,
} from 'lucide-react';
import CoachChat from '@/components/CoachChat';
import { gamesApi, analysisApi, communityApi, dailyApi } from '@/lib/api';
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

function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `${n}th`;
}

function infoPct(m: MoveAnalysis): number {
  if (m.pattern === 242) return 100;
  const gained = m.info_gained ?? 0;
  const optimal = m.optimal_info ?? 0;
  return Math.min(100, Math.round((gained / Math.max(optimal, 0.0001)) * 100));
}

function probWasSolution(
  guessWord: string,
  targetWord: string | null,
  remainingBefore: number,
  remainingWordsList?: string[],
): string {
  if (guessWord === targetWord) return '100%';
  if (remainingWordsList && remainingWordsList.length > 0) {
    if (remainingWordsList.includes(guessWord)) {
      return `${Math.round(100 / remainingBefore)}%`;
    }
    return '—';
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
  const matchedBot =
    m.guess_word === optimalWord || pct >= 99;

  const suffix = isSolving ? ' Puzzle solved.' : '';
  const violationNote =
    m.constraint_violation && m.constraint_violation !== 'none'
      ? ' Note: this didn’t reuse a revealed hint.'
      : '';

  if (isForced) return 'Only one word left — locked in.';

  if (isOpener) {
    if (skill >= 75) {
      return `Your opener — these don’t count toward Skill, but you set up well.`;
    }
    return `Your opener — these don’t count toward Skill, but the bot would have played ${optimalWord}.`;
  }

  if (skill >= 95 && matchedBot) {
    return `Excellent work — I’d have played this exact word.${suffix}${violationNote}`;
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
  const TILE = 34;
  const GAP = 4;

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
                        fontSize: 12,
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
  const top3 = [...buckets]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return (
    <div className="flex-1 min-w-0">
      <p
        className="font-sans text-[10px] uppercase tracking-[0.08em] mb-3"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </p>
      <div className="flex flex-col gap-4">
        {top3.map((bucket, i) => {
          const pct =
            totalRemaining > 0
              ? Math.round((bucket.count / totalRemaining) * 100)
              : Math.round((bucket.probability ?? 0) * 100);
          const repWord = bucket.words?.[0] ?? '—';
          const labelText = bucket.is_actual
            ? 'Group with today’s solution'
            : 'Chance solution is among these words';

          return (
            <div key={i} className="flex flex-col gap-1">
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
                <span
                  className="font-sans font-semibold text-sm uppercase"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {repWord}
                </span>
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
                    backgroundColor: 'var(--tile-correct)',
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
  spoilersHidden,
}: {
  move: MoveAnalysis;
  moveIndex: number;
  activeRow: number;
  targetWord: string | null;
  spoilersHidden: boolean;
}) {
  const n = move.move_number;
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
  const botSolChance =
    optimalWord === targetWord
      ? '100%'
      : optimalWord === '—'
      ? '—'
      : '—';

  const [expRemH, botExpRemH] = highlightPair(yourExpRem, botExpRem, 'lower');
  const [actualH] = highlightPair(yourActual, null, 'lower');
  const yourSolNum =
    yourSolChance === '—' ? null : parseInt(yourSolChance.replace('%', ''));
  const botSolNum =
    botSolChance === '—' ? null : parseInt(botSolChance.replace('%', ''));
  const [solH, botSolH] = highlightPair(yourSolNum, botSolNum, 'higher');
  const [stepsH] = highlightPair(yourExpSteps, null, 'lower');

  const numGroups = pDist.length;
  const largestGroup =
    pDist.length > 0 ? Math.max(...pDist.map((b) => b.count)) : null;
  const infoGained = move.info_gained ?? 0;
  const optimalInfo = move.optimal_info ?? 0;

  const [groupsH] = highlightPair(numGroups, null, 'higher');
  const [largestH] = highlightPair(largestGroup, null, 'lower');
  const [bitsH, botBitsH] = highlightPair(infoGained, optimalInfo, 'higher');
  const dotStyle = (color: string): React.CSSProperties => ({
    width: 8, height: 8, borderRadius: '50%', backgroundColor: color,
    flexShrink: 0, display: 'inline-block',
  });
  const statusIcon: React.ReactNode =
    move.classification === 'forced'
      ? <Lock size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
      : skill >= 95
      ? <Check size={15} style={{ color: 'var(--tile-correct)', flexShrink: 0 }} />
      : skill >= 60
      ? <span style={dotStyle('var(--tile-correct)')} />
      : <span style={dotStyle('var(--text-tertiary)')} />;

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

      {spoilersHidden && moveIndex > activeRow ? (
        <div className="rounded-xl px-5 py-8 text-center" style={{ backgroundColor: 'var(--bg-muted)', border: '1px solid var(--border-subtle)' }}>
          <span className="font-sans text-sm" style={{ color: 'var(--text-tertiary)' }}>Spoiler hidden</span>
        </div>
      ) : (
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
                {move.classification && (
                  <span
                    className="font-sans text-[9px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-pill"
                    style={{
                      color:
                        move.classification === 'brilliant' ||
                        move.classification === 'best' ||
                        move.classification === 'good'
                          ? 'var(--tile-correct)'
                          : 'var(--text-tertiary)',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {move.classification}
                  </span>
                )}
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

          <p
            className="font-sans text-[15px] leading-relaxed mb-6"
            style={{ color: 'var(--text-secondary)' }}
          >
            {buildCommentary(move, optimalWord)}
          </p>

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
                    { your: yourActual != null ? String(yourActual) : '—', bot: '—', label: 'Actual solutions after guess', yH: actualH, bH: false },
                    { your: yourSolChance, bot: botSolChance, label: 'Est. chance guess was solution', yH: solH, bH: botSolH },
                    { your: yourExpSteps != null ? yourExpSteps.toFixed(2) : '—', bot: '—', label: 'Expected steps until solution', yH: stepsH, bH: false },
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
                      { your: String(numGroups), bot: '—', label: 'Number of groups', yH: groupsH, bH: false },
                      { your: largestGroup != null ? String(largestGroup) : '—', bot: '—', label: 'Largest group', yH: largestH, bH: false },
                      { your: infoGained.toFixed(2), bot: optimalInfo > 0 ? optimalInfo.toFixed(2) : '—', label: <>Bits of <a href="/learn#strategy-math" className="underline" style={{ color: 'var(--tile-correct)' }}>information</a></>, yH: bitsH, bH: botBitsH },
                    ]} />
                  </div>

                  <div className="flex gap-6 flex-wrap min-[520px]:flex-nowrap">
                    <PatternGroupPanel
                      label={`Your Groups, with ${move.guess_word}`}
                      buckets={pDist}
                      totalRemaining={remainBefore}
                    />
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
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
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
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-pill px-4 py-3 shadow-elevated transition-opacity hover:opacity-90"
        style={{
          backgroundColor: 'var(--tile-correct)',
          color: '#fff',
        }}
        aria-label="Open coach"
      >
        <MessageCircle size={18} />
        <span className="font-sans font-semibold text-sm">Coach</span>
      </button>

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
              className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
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
                <span
                  className="font-display font-semibold text-base"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Coach
                </span>
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

function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loadingGame, setLoadingGame] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [activeRow, setActiveRow] = useState(0);
  const [spoilersHidden, setSpoilersHidden] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (!analysis) return;
    const observers: IntersectionObserver[] = [];
    analysis.moves.forEach((m, i) => {
      const el = document.getElementById(`guess-${m.move_number}`);
      if (!el) return;
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) setActiveRow(i);
          });
        },
        { threshold: 0.1, rootMargin: '-5% 0px -70% 0px' },
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [analysis]);

  function scrollToGuess(row: number) {
    setActiveRow(row);
    if (!analysis) return;
    const moveNum = analysis.moves[row]?.move_number;
    if (moveNum == null) return;
    const el = document.getElementById(`guess-${moveNum}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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
      <div className="max-w-[680px] mx-auto px-5 md:px-0 pb-24">

        {/* Game header */}
        <div className="pt-10 mb-8">
          <p
            className="font-sans text-[10px] uppercase tracking-[0.1em] mb-2"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Game review
          </p>
          <h1
            className="font-display font-bold uppercase tracking-wide mb-2"
            style={{ fontSize: '2.25rem', color: 'var(--text-primary)', lineHeight: 1.1 }}
          >
            {game?.target_word ?? '—'}
          </h1>
          <div
            className="flex items-center gap-2 flex-wrap font-sans text-sm"
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
                className="rounded-pill px-2 py-0.5 text-[11px] font-semibold tabular-nums"
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

        {/* Navigator: grid + stats table */}
        <div className="flex gap-6 mb-2 flex-wrap sm:flex-nowrap">
          <div className="shrink-0">
            <NavigatorGrid
              guesses={guesses}
              patterns={boardPatterns}
              activeRow={activeRow}
              onRowClick={scrollToGuess}
            />
          </div>
          {analysis && !loadingAnalysis && (
            <StatsTable
              moves={analysis.moves}
              activeRow={activeRow}
            />
          )}
          {loadingAnalysis && (
            <div className="flex-1 flex flex-col gap-2 justify-end">
              {Array.from({ length: guesses.length || 4 }).map((_, i) => (
                <Skeleton key={i} className="h-7" />
              ))}
            </div>
          )}
        </div>

        {/* Spoilers toggle — tucked snug under the grid/stats block */}
        <div className="mt-1">
          <button
            onClick={() => setSpoilersHidden((v) => !v)}
            className="font-sans text-[13px] underline"
            style={{ color: 'var(--tile-correct)' }}
          >
            {spoilersHidden ? 'Show spoilers' : 'Hide spoilers'}
          </button>
        </div>

        {/* Summary banner */}
        {analysis && !loadingAnalysis && (
          <div
            className="mt-8 pt-6"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <div className="flex gap-6 flex-wrap mb-3">
              {[
                {
                  label: 'Skill',
                  value: String(
                    Math.round(analysis.skill_avg_excluding_opener ?? 0),
                  ),
                  sub: 'excludes opener',
                },
                {
                  label: 'Luck',
                  value: String(Math.round(analysis.luck_avg ?? 0)),
                  sub: '',
                },
                {
                  label: 'Uniqueness',
                  value: `1 in ${analysis.uniqueness_percentile ?? 1}`,
                  sub: '',
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
              className="font-sans text-[13px] leading-relaxed mb-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              Skill ignores luck; Luck is whether you eliminated more than the
              bot expected; Uniqueness is how distinctive your color-pattern
              sequence is.
            </p>

            <button
              onClick={() => setShowExplanation((v) => !v)}
              className="font-sans text-[13px] underline"
              style={{ color: 'var(--tile-correct)' }}
            >
              {showExplanation ? 'Hide explanation' : 'Show explanation'}
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
                  <div
                    className="mt-4 rounded-xl p-4"
                    style={{ backgroundColor: 'var(--bg-muted)' }}
                  >
                    <p
                      className="font-sans font-semibold text-sm mb-3"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      What the columns mean
                    </p>
                    {[
                      {
                        term: 'Skill',
                        def: 'The efficiency of each guess based on all possible solutions, regardless of the outcome for this specific puzzle.',
                      },
                      {
                        term: 'Luck',
                        def: 'The higher the score (up to 99), the luckier you are. Luck is whether the number of solutions you eliminated with each guess is more or less than what the bot expected on average.',
                      },
                      {
                        term: 'Words left',
                        def: "The bot’s estimate of plausible remaining solutions, with probabilities assigned based in part on word frequency.",
                      },
                      {
                        term: 'Info gained',
                        def: 'The share of available information gained. Guesses that divide the remaining solutions into more and smaller groups, each with a unique pattern of colored squares, yield more information on average.',
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
        )}

        {/* Analysis error */}
        {analysisError && (
          <div className="mt-8 flex flex-col gap-3">
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
          <div className="mt-8 flex flex-col gap-8">
            {Array.from({ length: guesses.length || 3 }).map((_, i) => (
              <div key={i} className="pt-10 mt-10 border-t border-border-subtle">
                <Skeleton className="h-7 w-40 mb-4" />
                <Skeleton className="h-16 mb-3" />
                <Skeleton className="h-10 w-3/4" />
              </div>
            ))}
          </div>
        )}

        {/* Per-guess cards */}
        {analysis &&
          !loadingAnalysis &&
          analysis.moves.map((move, i) => (
            <GuessCard
              key={move.id || i}
              move={move}
              moveIndex={i}
              activeRow={activeRow}
              targetWord={game?.target_word ?? null}
              spoilersHidden={spoilersHidden}
            />
          ))}

        {/* Community panel */}
        {game && game.status !== 'in_progress' && game.user_id && analysis && (
          <CommunityPanel
            gameId={game.id}
            targetWord={game.target_word}
            playerGuesses={game.num_guesses}
          />
        )}

        {/* Footer */}
        <footer
          className="pt-10 mt-10 pb-6 flex flex-col gap-2"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <button
            onClick={() => router.push('/play')}
            className="flex items-center gap-1.5 font-sans text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <ArrowLeft size={14} />
            Back to play
          </button>
          {game?.mode === 'daily' && (
            <ReplayLink createdAt={game.created_at} router={router} />
          )}
        </footer>
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
/* Replay link (daily only)                                            */
/* ------------------------------------------------------------------ */

function ReplayLink({
  createdAt,
  router,
}: {
  createdAt: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [loading, setLoading] = useState(false);

  async function handleReplay() {
    setLoading(true);
    try {
      const date = createdAt.slice(0, 10);
      const res = await dailyApi.replay(date);
      const newId: string = res.data?.id ?? res.data?.game_id ?? '';
      if (newId) router.push(`/play?game=${newId}`);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleReplay}
      disabled={loading}
      className="font-sans text-sm underline disabled:opacity-50"
      style={{ color: 'var(--tile-correct)' }}
    >
      {loading ? 'Starting…' : 'Replay this puzzle'}
    </button>
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
