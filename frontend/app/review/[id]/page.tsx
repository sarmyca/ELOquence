'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const GameStateGraph = dynamic(
  () => import('@/components/graph/GameStateGraph'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[500px]">
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }}
        />
      </div>
    ),
  },
);

import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Target,
  TrendingUp,
  Hash,
  Zap,
  ChevronDown,
  ChevronUp,
  Info,
  Check,
} from 'lucide-react';
import AccuracyGauge from '@/components/AccuracyGauge';
import ClassificationBadge from '@/components/ClassificationBadge';
import MiniTiles from '@/components/MiniTiles';
import TabSystem from '@/components/TabSystem';
import MoveQualityTimeline from '@/components/MoveQualityTimeline';
import EntropyWaterfall from '@/components/EntropyWaterfall';
import PatternHistogram from '@/components/PatternHistogram';
import LetterHeatmap from '@/components/LetterHeatmap';
import MoveExplanation from '@/components/MoveExplanation';
import MoveDetailsModal from '@/components/MoveDetailsModal';
import EducationalTip from '@/components/EducationalTip';
import CoachChat from '@/components/CoachChat';
import Modal from '@/components/Modal';
import { gamesApi, analysisApi } from '@/lib/api';
import CommunityStats from '@/components/CommunityStats';
import {
  Game,
  AnalysisResult,
  MoveAnalysis,
  CLASSIFICATION_CONFIG,
  patternToTiles,
  TopPick,
  PatternBucket,
  getRatingTier,
} from '@/lib/types';
import clsx from 'clsx';

/* ------------------------------------------------------------------ */
/*  ELO distribution calculator                                         */
/* ------------------------------------------------------------------ */

const OUTCOME_MAP: Record<number, number> = {
  1: 1.0, 2: 0.95, 3: 0.85, 4: 0.70, 5: 0.55, 6: 0.40,
};
const ACC_MAP: Record<number, number> = { 1: 100, 2: 90, 3: 75, 4: 60, 5: 45, 6: 35 };

function computeEloDist(
  playerElo: number,
  wordElo: number,
  isPlacement: boolean,
): { label: string; delta: number }[] {
  const expected = 1 / (1 + Math.pow(10, (wordElo - playerElo) / 400));
  const k = isPlacement ? 128 : 32;
  const timeScore = 0.5;
  const rows: { label: string; delta: number }[] = [];
  for (let g = 1; g <= 6; g++) {
    const outcome = OUTCOME_MAP[g];
    const acc = ACC_MAP[g] / 100;
    const perf = 0.45 * acc + 0.35 * outcome + 0.20 * timeScore;
    const raw = k * (perf - expected);
    rows.push({
      label: `${g}/6`,
      delta: Math.round(Math.max(100 - playerElo, playerElo + raw) - playerElo),
    });
  }
  const lossPerf = 0.45 * 0 + 0.35 * 0 + 0.20 * timeScore;
  const lossRaw = k * (lossPerf - expected);
  rows.push({
    label: 'X/6',
    delta: Math.round(Math.max(100 - playerElo, playerElo + lossRaw) - playerElo),
  });
  return rows;
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                            */
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
/*  Mini board (compact replay)                                         */
/* ------------------------------------------------------------------ */

function MiniBoard({
  guesses,
  patterns,
  targetWord,
  highlightRow,
}: {
  guesses: string[];
  patterns: number[];
  targetWord: string | null;
  highlightRow?: number;
}) {
  const TILE_SIZE = 28;
  const GAP = 3;

  return (
    <div className="flex flex-col" style={{ gap: GAP }}>
      {Array.from({ length: 6 }).map((_, row) => {
        const guess = guesses[row] || '';
        const tiles = patterns[row] !== undefined ? patternToTiles(patterns[row]) : null;
        const isHighlighted = highlightRow === row;

        return (
          <div
            key={row}
            className="flex"
            style={{
              gap: GAP,
              opacity: highlightRow !== undefined && !isHighlighted && guess ? 0.4 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {Array.from({ length: 5 }).map((_, col) => {
              const letter = guess[col] || '';
              const state = tiles ? tiles[col] : 'empty';

              let bg = 'var(--bg-muted)';
              if (state === 'correct') bg = 'var(--tile-correct)';
              else if (state === 'present') bg = 'var(--tile-present)';
              else if (state === 'absent') bg = 'var(--tile-absent)';
              else if (letter) bg = 'var(--bg-elevated)';

              return (
                <div
                  key={col}
                  style={{
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                    backgroundColor: bg,
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${
                      isHighlighted
                        ? 'var(--border-default)'
                        : 'var(--border-subtle)'
                    }`,
                    transition: 'border-color 0.15s',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: letter && tiles ? 'var(--bg-base)' : 'var(--text-ghost)',
                      textTransform: 'uppercase',
                      fontFamily: 'var(--font-mono, monospace)',
                    }}
                  >
                    {letter}
                  </span>
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
/*  AnalysisHeader — 3 big numbers + bot solve-path strip               */
/* ------------------------------------------------------------------ */

function AnalysisHeader({
  analysis,
  moves,
  displayScore,
  loadingAnalysis,
}: {
  analysis: AnalysisResult | null;
  moves: MoveAnalysis[];
  displayScore: number;
  loadingAnalysis: boolean;
}) {
  if (loadingAnalysis) {
    return (
      <div className="flex items-center gap-3 py-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    );
  }
  if (!analysis) return null;

  const skillAvg = analysis.skill_avg_excluding_opener ?? 0;
  const luckAvg = analysis.luck_avg ?? 50;
  const uniqueN = analysis.uniqueness_percentile ?? 1;
  const botPath = analysis.bot_solve_path ?? [];

  const skillColor =
    skillAvg >= 80
      ? 'var(--tile-correct)'
      : skillAvg >= 50
      ? 'var(--tile-present)'
      : 'var(--red)';
  const luckColor =
    luckAvg >= 80
      ? '#1565c0'
      : luckAvg >= 30
      ? 'var(--text-secondary)'
      : 'var(--red)';

  return (
    <div>
      {/* Three big numbers */}
      <div className="flex items-end gap-6 mb-3">
        <div className="flex flex-col gap-0.5">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-ghost)' }}
          >
            Skill
          </span>
          <span
            className="text-3xl font-display font-bold tabular-nums leading-none"
            style={{ color: skillColor }}
          >
            {skillAvg}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-ghost)' }}
          >
            Luck
          </span>
          <span
            className="text-3xl font-display font-bold tabular-nums leading-none"
            style={{ color: luckColor }}
          >
            {luckAvg}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-ghost)' }}
          >
            Uniqueness
          </span>
          <span
            className="text-3xl font-display font-bold tabular-nums leading-none"
            style={{ color: 'var(--text-primary)' }}
          >
            1 in {uniqueN}
          </span>
        </div>
      </div>

      {/* Bot solve-path strip */}
      {botPath.length > 0 && moves.length > 0 && (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          aria-label="Bot solve path vs player path"
        >
          {moves.map((m, i) => {
            const botWord = botPath[i] ?? '';
            const matched = botWord === m.guess_word;
            return (
              <div
                key={i}
                className="flex flex-col items-center gap-1 shrink-0"
              >
                {/* Player word */}
                <span
                  className="text-[10px] font-mono uppercase font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {m.guess_word}
                </span>
                {/* Color divider */}
                <div
                  className="w-full h-0.5 rounded-full"
                  style={{
                    backgroundColor: matched
                      ? 'var(--tile-correct)'
                      : 'var(--border-default)',
                    minWidth: 36,
                  }}
                />
                {/* Bot word */}
                <span
                  className="text-[10px] font-mono uppercase"
                  style={{ color: matched ? 'var(--tile-correct)' : 'var(--text-tertiary)' }}
                >
                  {botWord || '—'}
                </span>
                {/* Labels on first item only */}
                {i === 0 && (
                  <>
                    <span
                      className="absolute -top-4 left-0 text-[8px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-ghost)' }}
                    >
                      You
                    </span>
                    <span
                      className="absolute -bottom-4 left-0 text-[8px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-ghost)' }}
                    >
                      Bot
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AnalysisSettings toggle bar                                          */
/* ------------------------------------------------------------------ */

function AnalysisSettings({
  hardMode,
  usePast,
  onToggleHard,
  onTogglePast,
}: {
  hardMode: boolean;
  usePast: boolean;
  onToggleHard: () => void;
  onTogglePast: () => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-ghost)' }}
      >
        Mode
      </span>
      <button
        onClick={onToggleHard}
        aria-pressed={hardMode}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors"
        style={{
          backgroundColor: hardMode ? 'var(--tile-correct)' : 'var(--bg-muted)',
          color: hardMode ? 'var(--bg-base)' : 'var(--text-secondary)',
          border: `1px solid ${hardMode ? 'var(--tile-correct)' : 'var(--border-subtle)'}`,
        }}
      >
        {hardMode && <Check size={10} />}
        Hard mode
      </button>
      <button
        onClick={onTogglePast}
        aria-pressed={usePast}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors"
        style={{
          backgroundColor: usePast ? 'var(--tile-correct)' : 'var(--bg-muted)',
          color: usePast ? 'var(--bg-base)' : 'var(--text-secondary)',
          border: `1px solid ${usePast ? 'var(--tile-correct)' : 'var(--border-subtle)'}`,
        }}
      >
        {usePast && <Check size={10} />}
        Use past solutions
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DictionaryInfoBadge                                                  */
/* ------------------------------------------------------------------ */

function DictionaryInfoBadge({
  guesses,
  suggestions,
  solutions,
}: {
  guesses: number;
  suggestions: number;
  solutions: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors"
        style={{
          backgroundColor: 'var(--bg-muted)',
          color: 'var(--text-tertiary)',
          border: '1px solid var(--border-subtle)',
        }}
        aria-label="Dictionary info"
      >
        <Info size={9} />
        {guesses.toLocaleString()} accepted · {suggestions.toLocaleString()} suggestions · {solutions.toLocaleString()} solutions
      </button>

      <Modal open={open} onClose={() => setOpen(false)} maxWidth="max-w-sm" label="Dictionary Info">
        <div className="px-5 py-5">
          <h2
            className="text-base font-display font-bold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            Dictionary
          </h2>
          <div className="flex flex-col gap-3">
            {[
              {
                label: 'Accepted guesses',
                value: guesses.toLocaleString(),
                desc: 'All words you can type as a guess.',
              },
              {
                label: 'Suggestions',
                value: suggestions.toLocaleString(),
                desc: 'Words the bot considers as candidate guesses.',
              },
              {
                label: 'Solutions',
                value: solutions.toLocaleString(),
                desc: 'Words that can be the daily answer.',
              },
            ].map(({ label, value, desc }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <div className="flex items-baseline justify-between">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {label}
                  </span>
                  <span
                    className="font-mono font-bold text-sm tabular-nums"
                    style={{ color: 'var(--tile-correct)' }}
                  >
                    {value}
                  </span>
                </div>
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Move row                                                            */
/* ------------------------------------------------------------------ */

interface MoveRowProps {
  move: MoveAnalysis;
  index: number;
  revealed: boolean;
  isActive: boolean;
  onClick: () => void;
  gameId: string;
  onShowDetails: () => void;
}

function MoveRow({ move, index, revealed, isActive, onClick, gameId, onShowDetails }: MoveRowProps) {
  const [showRemaining, setShowRemaining] = useState(false);
  const effRatio = move.efficiency_ratio ?? 0;
  const infoGained = move.info_gained ?? 0;
  const config = move.classification ? CLASSIFICATION_CONFIG[move.classification] : null;
  const skill = move.skill_score ?? 0;
  const luck = move.luck_score ?? 50;
  const isGolden = skill === 99;
  const remainBefore = move.remaining_before ?? move.remaining_words ?? 0;
  const remainAfter = move.remaining_after ?? 0;
  const hasTip = !!(move.tip_case) && skill < 50 && remainBefore > 5;

  function skillChipColor(): string {
    if (skill >= 80) return 'var(--tile-correct)';
    if (skill >= 50) return 'var(--tile-present)';
    return 'var(--red)';
  }

  function luckChipColor(): string {
    if (luck >= 80) return '#1565c0';
    if (luck >= 30) return 'var(--text-secondary)';
    return 'var(--red)';
  }

  return (
    <motion.div
      layout
      className="rounded-xl transition-colors duration-100 cursor-pointer overflow-hidden"
      style={{
        backgroundColor: isActive ? 'var(--bg-muted)' : 'transparent',
        border: '1px solid',
        borderColor: isActive ? 'var(--border-default)' : 'transparent',
      }}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Move number */}
        <span
          className="text-xs font-mono w-4 shrink-0 text-right"
          style={{ color: 'var(--text-ghost)' }}
        >
          {index + 1}
        </span>

        {/* Mini tiles */}
        <MiniTiles pattern={move.pattern} size={13} />

        {/* Word */}
        <span
          className="text-sm font-mono font-semibold uppercase tracking-wider flex-1 min-w-0"
          style={{ color: 'var(--text-primary)' }}
        >
          {move.guess_word}
        </span>

        {/* Skill chip */}
        {revealed && (
          <div className="flex items-center gap-1 shrink-0">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{
                color: skillChipColor(),
                backgroundColor: `${skillChipColor()}18`,
              }}
              title={`Skill: ${skill}/99`}
            >
              {isGolden && (
                <Check
                  size={9}
                  style={{ color: 'var(--gold)' }}
                  aria-label="Matched bot pick"
                />
              )}
              {skill}
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{
                color: luckChipColor(),
                backgroundColor: `${luckChipColor()}18`,
              }}
              title={`Luck: ${luck}/99`}
            >
              {luck}
            </span>
          </div>
        )}

        {/* Classification badge */}
        <div className="shrink-0 min-w-[80px] flex justify-end">
          {revealed && move.classification ? (
            <ClassificationBadge
              classification={move.classification}
              size="sm"
              animate={true}
            />
          ) : (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ color: 'var(--text-ghost)', backgroundColor: 'var(--bg-muted)' }}
            >
              ?
            </span>
          )}
        </div>

        {/* Info gained */}
        <span
          className="text-xs font-mono tabular-nums w-14 text-right shrink-0"
          style={{ color: 'var(--text-secondary)' }}
        >
          {infoGained.toFixed(2)}b
        </span>

        {/* Expand icon */}
        <span style={{ color: 'var(--text-ghost)' }} className="shrink-0">
          {isActive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {/* Efficiency bar */}
      {revealed && (
        <div className="px-3 pb-2 flex items-center gap-2">
          <span
            className="text-[10px] w-16"
            style={{ color: 'var(--text-ghost)' }}
          >
            Efficiency
          </span>
          <div
            className="flex-1 h-1 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--bg-muted)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: config?.color || 'var(--text-ghost)' }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, effRatio * 100)}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span
            className="text-[10px] font-mono tabular-nums w-8 text-right"
            style={{ color: 'var(--text-secondary)' }}
          >
            {Math.round(effRatio * 100)}%
          </span>
        </div>
      )}

      {/* Expanded details */}
      <AnimatePresence>
        {isActive && revealed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 flex flex-col gap-2">
              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2">
                {/* Remaining */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRemaining(!showRemaining);
                  }}
                  className="flex flex-col gap-0.5 p-2 rounded-lg text-left transition-colors"
                  style={{ backgroundColor: 'var(--bg-muted)' }}
                >
                  <span
                    className="text-[10px] uppercase tracking-wider flex items-center gap-1"
                    style={{ color: 'var(--text-ghost)' }}
                  >
                    Remaining
                    <ChevronDown
                      size={9}
                      style={{
                        transform: showRemaining ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.15s',
                      }}
                    />
                  </span>
                  <span
                    className="text-sm font-mono font-bold tabular-nums"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {remainBefore} → {remainAfter}
                  </span>
                </button>

                {/* Expected solutions after */}
                <div
                  className="flex flex-col gap-0.5 p-2 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-muted)' }}
                >
                  <span
                    className="text-[10px] uppercase tracking-wider"
                    style={{ color: 'var(--text-ghost)' }}
                  >
                    Exp. Solutions
                  </span>
                  <span
                    className="text-sm font-mono font-bold tabular-nums"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {(move.expected_solutions_after ?? 0).toFixed(1)}
                  </span>
                </div>

                {/* Luck score */}
                <div
                  className="flex flex-col gap-0.5 p-2 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-muted)' }}
                >
                  <span
                    className="text-[10px] uppercase tracking-wider"
                    style={{ color: 'var(--text-ghost)' }}
                  >
                    Luck
                  </span>
                  <span
                    className="text-sm font-mono font-bold tabular-nums"
                    style={{
                      color:
                        (move.luck ?? 0) > 0
                          ? 'var(--tile-correct)'
                          : (move.luck ?? 0) < 0
                          ? 'var(--red)'
                          : 'var(--text-primary)',
                    }}
                  >
                    {(move.luck ?? 0) > 0 ? '+' : ''}
                    {(move.luck ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Expected steps row */}
              <div className="flex items-center gap-3">
                <span
                  className="text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Exp. steps until solution:{' '}
                  <span className="font-mono font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {(move.expected_steps_until_solution ?? 1).toFixed(1)}
                  </span>
                </span>

                {/* Bot pick inline */}
                {move.bot_pick && move.bot_pick !== move.guess_word && (
                  <span className="text-xs" style={{ color: 'var(--text-ghost)' }}>
                    Bot:{' '}
                    <span
                      className="font-mono font-semibold uppercase"
                      style={{ color: 'var(--tile-present)' }}
                    >
                      {move.bot_pick}
                    </span>
                  </span>
                )}

                {/* Show Details button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowDetails();
                  }}
                  className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors"
                  style={{
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-muted)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  Show Details
                </button>

                {/* Educational tip */}
                {hasTip && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <EducationalTip tipCase={move.tip_case ?? ''} />
                  </div>
                )}
              </div>

              {/* Remaining words list */}
              <AnimatePresence>
                {showRemaining && move.remaining_words_list && move.remaining_words_list.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: 'var(--bg-muted)' }}
                    >
                      <span
                        className="text-[10px] uppercase tracking-wider mb-1.5 block"
                        style={{ color: 'var(--text-ghost)' }}
                      >
                        Remaining words ({move.remaining_words_list.length})
                      </span>
                      <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                        {move.remaining_words_list.map((word: string) => (
                          <span
                            key={word}
                            className="text-[11px] font-mono uppercase px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: 'var(--bg-elevated)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Optimal word */}
              {move.optimal_word && move.optimal_word !== move.guess_word && (
                <div className="flex items-center gap-2 text-xs">
                  <span style={{ color: 'var(--text-ghost)' }}>Best was</span>
                  <span
                    className="font-mono font-semibold uppercase"
                    style={{ color: 'var(--tile-correct)' }}
                  >
                    {move.optimal_word}
                  </span>
                  {move.optimal_info !== null && (
                    <span style={{ color: 'var(--text-ghost)' }}>
                      ({move.optimal_info.toFixed(2)}b)
                    </span>
                  )}
                </div>
              )}

              {/* Trap info */}
              {move.trap_info && (
                <div
                  className="text-xs p-2 rounded-lg"
                  style={{
                    backgroundColor: 'rgba(156, 39, 176, 0.08)',
                    border: '1px solid rgba(156, 39, 176, 0.2)',
                  }}
                >
                  <span style={{ color: '#9c27b0', fontWeight: 600 }}>Trap detected: </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    -{move.trap_info.suffix} pattern traps {move.trap_info.trap_size} words
                  </span>
                </div>
              )}

              {/* Constraint violation */}
              {move.constraint_violation && move.constraint_violation !== 'none' && (
                <div
                  className="text-xs p-2 rounded-lg"
                  style={
                    move.constraint_violation === 'hard'
                      ? {
                          backgroundColor: 'rgba(231, 76, 60, 0.08)',
                          border: '1px solid rgba(231, 76, 60, 0.2)',
                        }
                      : {
                          backgroundColor: 'var(--bg-muted)',
                          border: '1px solid var(--border-subtle)',
                        }
                  }
                >
                  <span
                    style={{
                      fontWeight: 600,
                      color:
                        move.constraint_violation === 'hard'
                          ? 'var(--red)'
                          : 'var(--text-secondary)',
                    }}
                  >
                    {move.constraint_violation_reason ||
                      (move.constraint_violation === 'hard'
                        ? 'Constraint violation'
                        : 'Non-hard mode guess')}
                  </span>
                </div>
              )}
            </div>

            {/* AI Explanation */}
            {move.classification &&
              move.classification !== 'best' &&
              move.classification !== 'forced' && (
                <MoveExplanation
                  gameId={gameId}
                  moveNumber={move.move_number}
                  visible={isActive && revealed}
                  candidatesTopN={move.candidates_top_n}
                />
              )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Top Picks panel                                                     */
/* ------------------------------------------------------------------ */

function TopPicksPanel({ moves }: { moves: MoveAnalysis[] }) {
  const [selectedMove, setSelectedMove] = useState(0);
  const move = moves[selectedMove];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {moves.map((m, i) => (
          <button
            key={i}
            onClick={() => setSelectedMove(i)}
            className="shrink-0 px-2.5 py-1 rounded-md text-xs font-mono font-semibold uppercase transition-colors"
            style={{
              backgroundColor: selectedMove === i ? 'var(--bg-muted)' : 'transparent',
              color: selectedMove === i ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {m.guess_word}
          </button>
        ))}
      </div>

      {move?.top_picks && move.top_picks.length > 0 ? (
        <div className="flex flex-col gap-1">
          <div
            className="grid grid-cols-[1.5rem_1fr_4rem_5rem] px-2 py-1 text-[10px] uppercase tracking-wider"
            style={{
              color: 'var(--text-ghost)',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <span>#</span>
            <span>Word</span>
            <span className="text-right">Entropy</span>
            <span className="text-right">Exp. Rem.</span>
          </div>
          {move.top_picks.slice(0, 15).map((pick: TopPick, i: number) => (
            <div
              key={i}
              className="grid grid-cols-[1.5rem_1fr_4rem_5rem] px-2 py-1.5 rounded-md text-sm"
              style={{
                backgroundColor: i === 0 ? 'rgba(106,170,100,0.08)' : 'transparent',
              }}
            >
              <span
                className="text-xs font-mono tabular-nums"
                style={{ color: 'var(--text-ghost)' }}
              >
                {i + 1}
              </span>
              <span
                className="font-mono font-semibold uppercase"
                style={{ color: i === 0 ? 'var(--tile-correct)' : 'var(--text-primary)' }}
              >
                {pick.word}
                {pick.word === move.guess_word && (
                  <span
                    className="ml-1.5 text-[10px] normal-case"
                    style={{ color: 'var(--text-ghost)' }}
                  >
                    (you)
                  </span>
                )}
              </span>
              <span
                className="font-mono tabular-nums text-right text-xs"
                style={{ color: 'var(--text-secondary)' }}
              >
                {pick.entropy.toFixed(2)}b
              </span>
              <span
                className="font-mono tabular-nums text-right text-xs"
                style={{ color: 'var(--text-secondary)' }}
              >
                ~{pick.expected_remaining.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p
          className="text-sm text-center py-4"
          style={{ color: 'var(--text-ghost)' }}
        >
          No top picks data for this move.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Patterns panel                                                      */
/* ------------------------------------------------------------------ */

function PatternsPanel({ moves }: { moves: MoveAnalysis[] }) {
  const [selectedMove, setSelectedMove] = useState(0);
  const move = moves[selectedMove];
  const dist: PatternBucket[] = move?.pattern_distribution ?? [];
  const actualPattern = move?.pattern ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {moves.map((m, i) => (
          <button
            key={i}
            onClick={() => setSelectedMove(i)}
            className="shrink-0 px-2.5 py-1 rounded-md text-xs font-mono font-semibold uppercase transition-colors"
            style={{
              backgroundColor: selectedMove === i ? 'var(--bg-muted)' : 'transparent',
              color: selectedMove === i ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {m.guess_word}
          </button>
        ))}
      </div>
      {dist.length > 0 ? (
        <PatternHistogram distribution={dist} actualPattern={actualPattern} />
      ) : (
        <p
          className="text-sm text-center py-6"
          style={{ color: 'var(--text-ghost)' }}
        >
          No pattern distribution data for this move.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Letter Map panel                                                    */
/* ------------------------------------------------------------------ */

function LetterMapPanel({ moves }: { moves: MoveAnalysis[] }) {
  const [selectedMove, setSelectedMove] = useState(0);
  const move = moves[selectedMove];
  const frequencies = move?.letter_frequencies ?? {};

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {moves.map((m, i) => (
          <button
            key={i}
            onClick={() => setSelectedMove(i)}
            className="shrink-0 px-2.5 py-1 rounded-md text-xs font-mono font-semibold uppercase transition-colors"
            style={{
              backgroundColor: selectedMove === i ? 'var(--bg-muted)' : 'transparent',
              color: selectedMove === i ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {m.guess_word}
          </button>
        ))}
      </div>
      {Object.keys(frequencies).length > 0 ? (
        <LetterHeatmap frequencies={frequencies} />
      ) : (
        <p
          className="text-sm text-center py-6"
          style={{ color: 'var(--text-ghost)' }}
        >
          No letter frequency data for this move.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main review page                                                    */
/* ------------------------------------------------------------------ */

function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Settings from URL params
  const hardMode = searchParams.get('hard') === '1';
  const usePast = searchParams.get('past') === '1';

  function toggleHard() {
    const params = new URLSearchParams(searchParams.toString());
    if (hardMode) params.delete('hard'); else params.set('hard', '1');
    router.replace(`/review/${id}?${params.toString()}`);
  }

  function togglePast() {
    const params = new URLSearchParams(searchParams.toString());
    if (usePast) params.delete('past'); else params.set('past', '1');
    router.replace(`/review/${id}?${params.toString()}`);
  }

  const [game, setGame] = useState<Game | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loadingGame, setLoadingGame] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [displayScore, setDisplayScore] = useState(0);
  const [activeMove, setActiveMove] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('analysis');
  const [showEloDist, setShowEloDist] = useState(false);
  // Move details modal state
  const [detailsMoveIdx, setDetailsMoveIdx] = useState<number | null>(null);

  const TABS = [
    { id: 'analysis', label: 'Analysis' },
    { id: 'top_picks', label: 'Top Picks' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'patterns', label: 'Patterns' },
    { id: 'letter_map', label: 'Letter Map' },
    { id: 'graph', label: 'Graph' },
  ];

  // Load game
  useEffect(() => {
    if (!id) return;
    gamesApi
      .get(id)
      .then((res) => setGame(res.data))
      .catch(() => router.push('/play'))
      .finally(() => setLoadingGame(false));
  }, [id, router]);

  // Trigger analysis (re-fires when hard/past toggles change)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, hardMode, usePast]);

  // Animate accuracy score counter
  useEffect(() => {
    if (!analysis) return;
    setDisplayScore(0);
    const steps = 20;
    const stepMs = 30;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= steps; i++) {
      const t = setTimeout(() => {
        setDisplayScore(Math.round((i / steps) * analysis.accuracy_score));
      }, i * stepMs);
      timers.push(t);
    }
    return () => timers.forEach(clearTimeout);
  }, [analysis]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!analysis) return;
        setActiveMove((prev) => {
          if (prev === null) return 0;
          return Math.min(analysis.moves.length - 1, prev + 1);
        });
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!analysis) return;
        setActiveMove((prev) => {
          if (prev === null) return analysis.moves.length - 1;
          return Math.max(0, prev - 1);
        });
      } else if (e.key >= '1' && e.key <= '6') {
        const tabIdx = parseInt(e.key) - 1;
        if (tabIdx < TABS.length) setActiveTab(TABS[tabIdx].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [analysis, TABS]);

  const guesses = game?.moves
    ? [...game.moves].sort((a, b) => a.move_number - b.move_number).map((m) => m.guess_word)
    : [];
  const boardPatterns = game?.moves
    ? [...game.moves].sort((a, b) => a.move_number - b.move_number).map((m) => m.pattern)
    : [];

  const eloDelta = game?.elo_delta;
  const wonGame = game?.status === 'won';
  const dictInfo = analysis?.dictionary_sizes;

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

  const detailsMove =
    detailsMoveIdx !== null && analysis ? analysis.moves[detailsMoveIdx] ?? null : null;

  return (
    <div
      className="max-w-7xl mx-auto px-4 py-3 h-[calc(100dvh-56px)] flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/* Header bar */}
      <div className="flex items-center gap-3 mb-3 shrink-0">
        <button
          onClick={() => router.push('/dashboard')}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
          aria-label="Back to dashboard"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-muted)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)';
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1
            className="text-lg font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Game Review
          </h1>
          {game && (
            <p
              className="text-xs capitalize truncate"
              style={{ color: 'var(--text-secondary)' }}
            >
              {game.mode} · {game.status === 'won' ? `Solved in ${game.num_guesses}/6` : 'Not solved'}
              {game.target_word && (
                <>
                  {' '}·{' '}
                  <span className="font-mono uppercase">{game.target_word}</span>
                  {game.word_difficulty != null && (
                    <span>
                      {' '}·{' '}
                      <span style={{ color: getRatingTier(game.word_difficulty).color }}>
                        {Math.round(game.word_difficulty)}
                      </span>
                    </span>
                  )}
                </>
              )}
            </p>
          )}
        </div>

        {/* Settings toggles + dictionary badge inline */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <AnalysisSettings
            hardMode={hardMode}
            usePast={usePast}
            onToggleHard={toggleHard}
            onTogglePast={togglePast}
          />
          {dictInfo && (
            <DictionaryInfoBadge
              guesses={dictInfo.guesses}
              suggestions={dictInfo.suggestions}
              solutions={dictInfo.solutions}
            />
          )}
        </div>
      </div>

      {/* Mobile settings row */}
      <div className="flex md:hidden items-center gap-2 mb-2 shrink-0 flex-wrap">
        <AnalysisSettings
          hardMode={hardMode}
          usePast={usePast}
          onToggleHard={toggleHard}
          onTogglePast={togglePast}
        />
        {dictInfo && (
          <DictionaryInfoBadge
            guesses={dictInfo.guesses}
            suggestions={dictInfo.suggestions}
            solutions={dictInfo.solutions}
          />
        )}
      </div>

      {/* Three-column grid */}
      <div
        className={clsx(
          'grid grid-cols-1 gap-4 min-h-0 flex-1',
          game && analysis
            ? 'lg:grid-cols-[auto_1fr_320px]'
            : 'lg:grid-cols-[auto_1fr]',
        )}
      >
        {/* LEFT COLUMN */}
        <div
          className="flex flex-col gap-3 items-center lg:items-start overflow-y-auto pr-1"
          style={{ maxHeight: 'calc(100dvh - 140px)' }}
        >
          {/* Mini board */}
          <div
            className="p-4 rounded-2xl"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <MiniBoard
              guesses={guesses}
              patterns={boardPatterns}
              targetWord={game?.target_word ?? null}
              highlightRow={activeMove ?? undefined}
            />
          </div>

          {/* Accuracy gauge */}
          <div
            className="flex flex-col items-center p-3 rounded-2xl w-full"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {loadingAnalysis ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div
                  className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }}
                />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Analyzing...
                </span>
              </div>
            ) : analysisError ? (
              <p className="text-xs text-center px-2" style={{ color: 'var(--red)' }}>
                {analysisError}
              </p>
            ) : (
              <AccuracyGauge score={displayScore} animated={true} />
            )}
          </div>

          {/* WordleBot big header numbers */}
          <div
            className="w-full p-3 rounded-2xl"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <AnalysisHeader
              analysis={analysis}
              moves={analysis?.moves ?? []}
              displayScore={displayScore}
              loadingAnalysis={loadingAnalysis}
            />
          </div>

          {/* Game stats */}
          {game && (
            <div className="grid grid-cols-2 gap-2 w-full">
              <div
                className="flex flex-col gap-0.5 p-3 rounded-xl"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span
                  className="text-[10px] uppercase tracking-wider flex items-center gap-1"
                  style={{ color: 'var(--text-ghost)' }}
                >
                  <Hash size={9} /> Guesses
                </span>
                <span
                  className="text-lg font-mono font-bold tabular-nums"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {wonGame ? `${game.num_guesses}/6` : 'X/6'}
                </span>
              </div>

              {eloDelta !== null && game.rated && (
                <div className="relative">
                  <button
                    onClick={() => setShowEloDist(!showEloDist)}
                    className="w-full flex flex-col gap-0.5 p-3 rounded-xl text-left transition-colors"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span
                      className="text-[10px] uppercase tracking-wider flex items-center gap-1"
                      style={{ color: 'var(--text-ghost)' }}
                    >
                      <TrendingUp size={9} /> Rating
                      <ChevronDown
                        size={9}
                        style={{
                          transform: showEloDist ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s',
                        }}
                      />
                    </span>
                    <span
                      className="text-lg font-mono font-bold tabular-nums"
                      style={{
                        color: (eloDelta ?? 0) >= 0 ? 'var(--tile-correct)' : 'var(--red)',
                      }}
                    >
                      {(eloDelta ?? 0) >= 0 ? '+' : ''}
                      {Math.round(eloDelta ?? 0)}
                    </span>
                  </button>

                  <AnimatePresence>
                    {showEloDist && game.elo_before != null && game.word_difficulty != null && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 right-0 top-full mt-1 z-20 p-2.5 rounded-xl shadow-xl"
                        style={{
                          backgroundColor: 'var(--bg-elevated)',
                          border: '1px solid var(--border-default)',
                        }}
                      >
                        <p
                          className="text-[10px] uppercase tracking-wider mb-1.5"
                          style={{ color: 'var(--text-ghost)' }}
                        >
                          ELO by outcome
                        </p>
                        <div className="flex flex-col gap-0.5">
                          {computeEloDist(game.elo_before, game.word_difficulty, game.is_placement).map((row) => {
                            const isActual =
                              (wonGame && row.label === `${game.num_guesses}/6`) ||
                              (!wonGame && row.label === 'X/6');
                            return (
                              <div
                                key={row.label}
                                className="flex items-center justify-between px-2 py-1 rounded-md text-xs font-mono tabular-nums"
                                style={{
                                  backgroundColor: isActual ? 'var(--bg-muted)' : 'transparent',
                                }}
                              >
                                <span
                                  style={{
                                    color: isActual ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    fontWeight: isActual ? 600 : 400,
                                  }}
                                >
                                  {row.label}
                                </span>
                                <span
                                  style={{
                                    color: row.delta >= 0 ? 'var(--tile-correct)' : 'var(--red)',
                                    fontWeight: isActual ? 600 : 400,
                                  }}
                                >
                                  {row.delta >= 0 ? '+' : ''}{row.delta}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {game.accuracy_score !== null && (
                <div
                  className="flex flex-col gap-0.5 p-3 rounded-xl"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <span
                    className="text-[10px] uppercase tracking-wider flex items-center gap-1"
                    style={{ color: 'var(--text-ghost)' }}
                  >
                    <Target size={9} /> Accuracy
                  </span>
                  <span
                    className="text-lg font-mono font-bold tabular-nums"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {Math.round(game.accuracy_score)}%
                  </span>
                </div>
              )}

              {game.luck_factor !== null && (
                <div
                  className="flex flex-col gap-0.5 p-3 rounded-xl"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <span
                    className="text-[10px] uppercase tracking-wider flex items-center gap-1"
                    style={{ color: 'var(--text-ghost)' }}
                  >
                    <Zap size={9} /> Luck
                  </span>
                  <span
                    className="text-lg font-mono font-bold tabular-nums"
                    style={{
                      color:
                        (game.luck_factor ?? 0) > 0
                          ? 'var(--tile-correct)'
                          : (game.luck_factor ?? 0) < 0
                          ? 'var(--red)'
                          : 'var(--text-primary)',
                    }}
                  >
                    {(game.luck_factor ?? 0) > 0 ? '+' : ''}
                    {(game.luck_factor ?? 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Community stats */}
          {game && game.status !== 'in_progress' && (
            <CommunityStats
              gameId={game.id}
              playerGuesses={game.num_guesses}
              playerAccuracy={game.accuracy_score}
            />
          )}
        </div>

        {/* CENTER COLUMN */}
        <div className="flex flex-col gap-2 min-h-0">
          <TabSystem tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

          <div
            className="p-4 rounded-2xl min-h-0 flex-1 overflow-y-auto"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {/* Analysis tab */}
            {activeTab === 'analysis' && (
              <div className="flex flex-col gap-1">
                <div
                  className="grid grid-cols-[1.5rem_4.5rem_1fr_5.5rem_3.5rem_1.5rem] px-3 py-1.5 text-[10px] uppercase tracking-wider mb-1"
                  style={{
                    color: 'var(--text-ghost)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <span>#</span>
                  <span>Pattern</span>
                  <span>Word</span>
                  <span className="text-right">Skill/Luck</span>
                  <span className="text-right">Info</span>
                  <span />
                </div>

                {loadingAnalysis ? (
                  <div className="flex flex-col gap-2 mt-2">
                    {Array.from({ length: game?.num_guesses || 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : analysisError ? (
                  <div className="py-8 text-center">
                    <p
                      className="text-sm mb-3"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {analysisError}
                    </p>
                    <button
                      onClick={runAnalysis}
                      className="px-4 py-2 rounded-lg text-sm transition-colors"
                      style={{
                        backgroundColor: 'var(--bg-muted)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      Retry Analysis
                    </button>
                  </div>
                ) : analysis ? (
                  analysis.moves.map((move, i) => (
                    <MoveRow
                      key={move.id || i}
                      move={move}
                      index={i}
                      revealed={true}
                      isActive={activeMove === i}
                      onClick={() => setActiveMove(activeMove === i ? null : i)}
                      gameId={game?.id || id}
                      onShowDetails={() => setDetailsMoveIdx(i)}
                    />
                  ))
                ) : game ? (
                  [...game.moves]
                    .sort((a, b) => a.move_number - b.move_number)
                    .map((move, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <span
                          className="text-xs font-mono w-4 text-right"
                          style={{ color: 'var(--text-ghost)' }}
                        >
                          {i + 1}
                        </span>
                        <MiniTiles pattern={move.pattern} size={13} />
                        <span className="text-sm font-mono font-semibold uppercase tracking-wider flex-1">
                          {move.guess_word}
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            color: 'var(--text-ghost)',
                            backgroundColor: 'var(--bg-muted)',
                          }}
                        >
                          ?
                        </span>
                      </div>
                    ))
                ) : null}

                {/* Summary flags */}
                {analysis &&
                  (analysis.constraint_violations > 0 || analysis.traps_encountered > 0) && (
                    <div className="flex gap-2 flex-wrap mt-3">
                      {analysis.constraint_violations > 0 && (
                        <span
                          className="text-xs px-2.5 py-1 rounded-full"
                          style={{
                            backgroundColor: 'rgba(231,76,60,0.08)',
                            border: '1px solid rgba(231,76,60,0.2)',
                            color: 'var(--red)',
                          }}
                        >
                          {analysis.constraint_violations} constraint violation
                          {analysis.constraint_violations !== 1 ? 's' : ''}
                        </span>
                      )}
                      {analysis.traps_encountered > 0 && (
                        <span
                          className="text-xs px-2.5 py-1 rounded-full"
                          style={{
                            backgroundColor: 'rgba(156,39,176,0.08)',
                            border: '1px solid rgba(156,39,176,0.2)',
                            color: '#9c27b0',
                          }}
                        >
                          {analysis.traps_encountered} trap
                          {analysis.traps_encountered !== 1 ? 's' : ''} encountered
                        </span>
                      )}
                    </div>
                  )}
              </div>
            )}

            {/* Top Picks tab */}
            {activeTab === 'top_picks' &&
              (analysis ? (
                <TopPicksPanel moves={analysis.moves} />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm" style={{ color: 'var(--text-ghost)' }}>
                    {loadingAnalysis ? 'Analyzing...' : 'No data available.'}
                  </p>
                </div>
              ))}

            {/* Timeline tab */}
            {activeTab === 'timeline' &&
              (analysis ? (
                <div className="flex flex-col gap-6">
                  <div>
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wider mb-3"
                      style={{ color: 'var(--text-ghost)' }}
                    >
                      Move Quality (Efficiency)
                    </p>
                    <MoveQualityTimeline moves={analysis.moves} />
                  </div>
                  <div
                    className="pt-4"
                    style={{ borderTop: '1px solid var(--border-subtle)' }}
                  >
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wider mb-3"
                      style={{ color: 'var(--text-ghost)' }}
                    >
                      Remaining Words Narrowing
                    </p>
                    <EntropyWaterfall moves={analysis.moves} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm" style={{ color: 'var(--text-ghost)' }}>
                    {loadingAnalysis ? 'Analyzing...' : 'No data available.'}
                  </p>
                </div>
              ))}

            {/* Patterns tab */}
            {activeTab === 'patterns' &&
              (analysis ? (
                <PatternsPanel moves={analysis.moves} />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm" style={{ color: 'var(--text-ghost)' }}>
                    {loadingAnalysis ? 'Analyzing...' : 'No data available.'}
                  </p>
                </div>
              ))}

            {/* Letter Map tab */}
            {activeTab === 'letter_map' &&
              (analysis ? (
                <LetterMapPanel moves={analysis.moves} />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm" style={{ color: 'var(--text-ghost)' }}>
                    {loadingAnalysis ? 'Analyzing...' : 'No data available.'}
                  </p>
                </div>
              ))}

            {/* Graph tab */}
            {activeTab === 'graph' && game && <GameStateGraph gameId={game.id} />}
          </div>
        </div>

        {/* RIGHT COLUMN — Coach Chat */}
        {game && analysis && (
          <div className="hidden lg:flex flex-col min-h-0">
            <CoachChat
              gameId={game.id}
              gameContext={`Game: ${game.target_word}, ${game.status} in ${game.num_guesses}/6, Accuracy: ${Math.round(game.accuracy_score ?? 0)}%`}
            />
          </div>
        )}
      </div>

      {/* Move Details Modal */}
      <MoveDetailsModal
        open={detailsMoveIdx !== null}
        onClose={() => setDetailsMoveIdx(null)}
        move={detailsMove}
      />
    </div>
  );
}

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
