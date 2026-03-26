'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const GameStateGraph = dynamic(
  () => import('@/components/graph/GameStateGraph'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[500px]">
        <div className="w-6 h-6 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
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
import CoachChat from '@/components/CoachChat';
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

// Mirrors backend: calculate_performance_score + calculate_elo_delta
const OUTCOME_MAP: Record<number, number> = {
  1: 1.0,
  2: 0.95,
  3: 0.85,
  4: 0.70,
  5: 0.55,
  6: 0.40,
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
    <div className={clsx('skeleton rounded-lg bg-[#1e1e23]', className)} />
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

              let bg = '#1e1f23';
              if (state === 'correct') bg = '#538d4e';
              else if (state === 'present') bg = '#b59f3b';
              else if (state === 'absent') bg = '#3a3a3c';
              else if (letter) bg = '#26272c';

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
                      isHighlighted ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'
                    }`,
                    transition: 'border-color 0.15s',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: letter && tiles ? '#fff' : '#6b7280',
                      textTransform: 'uppercase',
                      fontFamily: 'Inter, sans-serif',
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
/*  Move row                                                            */
/* ------------------------------------------------------------------ */

interface MoveRowProps {
  move: MoveAnalysis;
  index: number;
  revealed: boolean;
  isActive: boolean;
  onClick: () => void;
  gameId: string;
}

function MoveRow({ move, index, revealed, isActive, onClick, gameId }: MoveRowProps) {
  const [showRemaining, setShowRemaining] = useState(false);
  const effRatio = move.efficiency_ratio ?? 0;
  const infoGained = move.info_gained ?? 0;
  const config = move.classification ? CLASSIFICATION_CONFIG[move.classification] : null;

  return (
    <motion.div
      layout
      className={clsx(
        'rounded-[12px] transition-colors duration-100 cursor-pointer',
        isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]',
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Move number */}
        <span className="text-xs font-mono text-text-ghost w-4 shrink-0 text-right">
          {index + 1}
        </span>

        {/* Mini tiles */}
        <MiniTiles pattern={move.pattern} size={13} />

        {/* Word */}
        <span className="text-sm font-mono font-semibold text-text-primary uppercase tracking-wider flex-1 min-w-0">
          {move.guess_word}
        </span>

        {/* Classification badge */}
        <div className="shrink-0 min-w-[90px] flex justify-end">
          {revealed && move.classification ? (
            <ClassificationBadge
              classification={move.classification}
              size="sm"
              animate={true}
            />
          ) : (
            <span className="text-xs text-text-ghost px-2 py-0.5 rounded-full bg-[#1e1e23]">
              ?
            </span>
          )}
        </div>

        {/* Info gained */}
        <span className="text-xs font-mono tabular-nums text-text-secondary w-14 text-right shrink-0">
          {infoGained.toFixed(2)}b
        </span>

        {/* Expand icon */}
        <span className="text-text-ghost shrink-0">
          {isActive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {/* Efficiency bar */}
      {revealed && (
        <div className="px-3 pb-2 flex items-center gap-2">
          <span className="text-[10px] text-text-ghost w-16">Efficiency</span>
          <div className="flex-1 h-1 rounded-full bg-[#1e1e23] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: config?.color || '#565758' }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, effRatio * 100)}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span className="text-[10px] font-mono tabular-nums text-text-secondary w-8 text-right">
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
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRemaining(!showRemaining);
                  }}
                  className="flex flex-col gap-0.5 p-2 rounded-lg bg-[#1e1e23] text-left hover:bg-white/[0.08] transition-colors"
                >
                  <span className="text-[10px] text-text-ghost uppercase tracking-wider flex items-center gap-1">
                    Remaining
                    <ChevronDown
                      size={9}
                      className={clsx('transition-transform', showRemaining && 'rotate-180')}
                    />
                  </span>
                  <span className="text-sm font-mono font-bold tabular-nums text-text-primary">
                    {move.remaining_after ?? move.remaining_words ?? '—'}
                  </span>
                </button>

                <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-[#1e1e23]">
                  <span className="text-[10px] text-text-ghost uppercase tracking-wider">
                    Entropy
                  </span>
                  <span className="text-sm font-mono font-bold tabular-nums text-text-primary">
                    {(move.entropy_before ?? 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-[#1e1e23]">
                  <span className="text-[10px] text-text-ghost uppercase tracking-wider">
                    Luck
                  </span>
                  <span
                    className={clsx(
                      'text-sm font-mono font-bold tabular-nums',
                      (move.luck ?? 0) > 0
                        ? 'text-[#538d4e]'
                        : (move.luck ?? 0) < 0
                          ? 'text-[#e74c3c]'
                          : 'text-text-primary',
                    )}
                  >
                    {(move.luck ?? 0) > 0 ? '+' : ''}
                    {(move.luck ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Remaining words list */}
              <AnimatePresence>
                {showRemaining &&
                  move.remaining_words_list &&
                  move.remaining_words_list.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="p-2 rounded-lg bg-[#1e1e23]">
                        <span className="text-[10px] text-text-ghost uppercase tracking-wider mb-1.5 block">
                          Remaining words ({move.remaining_words_list.length})
                        </span>
                        <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                          {move.remaining_words_list.map((word: string) => (
                            <span
                              key={word}
                              className="text-[11px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/[0.06] text-text-secondary"
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
                  <span className="text-text-ghost">Best was</span>
                  <span className="font-mono font-semibold uppercase text-[#6aaa64]">
                    {move.optimal_word}
                  </span>
                  {move.optimal_info !== null && (
                    <span className="text-text-ghost">
                      ({move.optimal_info.toFixed(2)}b)
                    </span>
                  )}
                </div>
              )}

              {/* Trap info */}
              {move.trap_info && (
                <div className="text-xs p-2 rounded-lg bg-[#9c27b0]/10 border border-[#9c27b0]/20">
                  <span className="text-[#9c27b0] font-medium">Trap detected: </span>
                  <span className="text-text-secondary">
                    -{move.trap_info.suffix} pattern traps {move.trap_info.trap_size} words
                  </span>
                </div>
              )}

              {/* Constraint violation */}
              {move.constraint_violation && move.constraint_violation !== 'none' && (
                <div
                  className={clsx(
                    'text-xs p-2 rounded-lg',
                    move.constraint_violation === 'hard'
                      ? 'bg-[#e74c3c]/10 border border-[#e74c3c]/20'
                      : 'bg-white/[0.03] border border-white/[0.06]',
                  )}
                >
                  <span
                    className={clsx(
                      'font-medium',
                      move.constraint_violation === 'hard'
                        ? 'text-[#e74c3c]'
                        : 'text-text-secondary',
                    )}
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
      {/* Move selector */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {moves.map((m, i) => (
          <button
            key={i}
            onClick={() => setSelectedMove(i)}
            className={clsx(
              'shrink-0 px-2.5 py-1 rounded-md text-xs font-mono font-semibold uppercase transition-colors',
              selectedMove === i
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]',
            )}
          >
            {m.guess_word}
          </button>
        ))}
      </div>

      {/* Picks list */}
      {move?.top_picks && move.top_picks.length > 0 ? (
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-[1.5rem_1fr_4rem_5rem] px-2 py-1 text-[10px] text-text-ghost uppercase tracking-wider border-b border-white/[0.06]">
            <span>#</span>
            <span>Word</span>
            <span className="text-right">Entropy</span>
            <span className="text-right">Exp. Rem.</span>
          </div>
          {move.top_picks.slice(0, 15).map((pick: TopPick, i: number) => (
            <div
              key={i}
              className={clsx(
                'grid grid-cols-[1.5rem_1fr_4rem_5rem] px-2 py-1.5 rounded-md text-sm',
                i === 0 ? 'bg-[#538d4e]/10' : 'hover:bg-white/[0.03]',
              )}
            >
              <span className="text-xs font-mono tabular-nums text-text-ghost">{i + 1}</span>
              <span
                className={clsx(
                  'font-mono font-semibold uppercase',
                  i === 0 ? 'text-[#6aaa64]' : 'text-text-primary',
                )}
              >
                {pick.word}
                {pick.word === move.guess_word && (
                  <span className="ml-1.5 text-[10px] text-text-ghost normal-case">(you)</span>
                )}
              </span>
              <span className="font-mono tabular-nums text-text-secondary text-right text-xs">
                {pick.entropy.toFixed(2)}b
              </span>
              <span className="font-mono tabular-nums text-text-secondary text-right text-xs">
                ~{pick.expected_remaining.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-ghost text-center py-4">
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
            className={clsx(
              'shrink-0 px-2.5 py-1 rounded-md text-xs font-mono font-semibold uppercase transition-colors',
              selectedMove === i
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]',
            )}
          >
            {m.guess_word}
          </button>
        ))}
      </div>
      {dist.length > 0 ? (
        <PatternHistogram distribution={dist} actualPattern={actualPattern} />
      ) : (
        <p className="text-sm text-text-ghost text-center py-6">
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
            className={clsx(
              'shrink-0 px-2.5 py-1 rounded-md text-xs font-mono font-semibold uppercase transition-colors',
              selectedMove === i
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]',
            )}
          >
            {m.guess_word}
          </button>
        ))}
      </div>
      {Object.keys(frequencies).length > 0 ? (
        <LetterHeatmap frequencies={frequencies} />
      ) : (
        <p className="text-sm text-text-ghost text-center py-6">
          No letter frequency data for this move.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main review page                                                    */
/* ------------------------------------------------------------------ */

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loadingGame, setLoadingGame] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [revealedCount, setRevealedCount] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [activeMove, setActiveMove] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('analysis');
  const [showEloDist, setShowEloDist] = useState(false);

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

  // Trigger analysis
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

  // Reveal all immediately, animate only the score counter
  useEffect(() => {
    if (!analysis) return;
    const total = analysis.moves.length;
    setRevealedCount(total);
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
        const total = analysis.moves.length;
        setActiveMove((prev) => {
          if (prev === null) return 0;
          return Math.min(total - 1, prev + 1);
        });
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!analysis) return;
        const total = analysis.moves.length;
        setActiveMove((prev) => {
          if (prev === null) return total - 1;
          return Math.max(0, prev - 1);
        });
      } else if (e.key >= '1' && e.key <= '6') {
        const tabIdx = parseInt(e.key) - 1;
        if (tabIdx < TABS.length) {
          setActiveTab(TABS[tabIdx].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [analysis, TABS]);

  // Compute guesses/patterns for mini board
  const guesses = game?.moves
    ? [...game.moves]
        .sort((a, b) => a.move_number - b.move_number)
        .map((m) => m.guess_word)
    : [];
  const boardPatterns = game?.moves
    ? [...game.moves]
        .sort((a, b) => a.move_number - b.move_number)
        .map((m) => m.pattern)
    : [];

  const eloDelta = game?.elo_delta;
  const wonGame = game?.status === 'won';

  if (loadingGame) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
        <div className="w-6 h-6 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-3 h-[calc(100dvh-56px)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3 shrink-0">
        <button
          onClick={() => router.push('/dashboard')}
          className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] transition-colors"
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-text-primary">Game Review</h1>
          {game && (
            <p className="text-xs text-text-secondary capitalize truncate">
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
          style={{ maxHeight: 'calc(100dvh - 120px)' }}
        >
          {/* Mini board */}
          <div className="p-4 rounded-2xl bg-[#16161a] border border-white/[0.08]">
            <MiniBoard
              guesses={guesses}
              patterns={boardPatterns}
              targetWord={game?.target_word ?? null}
              highlightRow={activeMove ?? undefined}
            />
          </div>

          {/* Accuracy gauge */}
          <div className="flex flex-col items-center p-3 rounded-2xl bg-[#16161a] border border-white/[0.08] w-full">
            {loadingAnalysis ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-5 h-5 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
                <span className="text-xs text-text-secondary">Analyzing...</span>
              </div>
            ) : analysisError ? (
              <p className="text-xs text-[#e74c3c] text-center px-2">{analysisError}</p>
            ) : (
              <AccuracyGauge score={displayScore} animated={true} />
            )}
          </div>

          {/* Stats */}
          {game && (
            <div className="grid grid-cols-2 gap-2 w-full">
              <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-[#16161a] border border-white/[0.08]">
                <span className="text-[10px] text-text-ghost uppercase tracking-wider flex items-center gap-1">
                  <Hash size={9} /> Guesses
                </span>
                <span className="text-lg font-mono font-bold tabular-nums text-text-primary">
                  {wonGame ? `${game.num_guesses}/6` : 'X/6'}
                </span>
              </div>

              {eloDelta !== null && game.rated && (
                <div className="relative">
                  <button
                    onClick={() => setShowEloDist(!showEloDist)}
                    className="w-full flex flex-col gap-0.5 p-3 rounded-xl bg-[#16161a] border border-white/[0.08] hover:bg-white/[0.04] transition-colors text-left"
                  >
                    <span className="text-[10px] text-text-ghost uppercase tracking-wider flex items-center gap-1">
                      <TrendingUp size={9} /> Rating
                      <ChevronDown
                        size={9}
                        className={clsx('transition-transform', showEloDist && 'rotate-180')}
                      />
                    </span>
                    <span
                      className={clsx(
                        'text-lg font-mono font-bold tabular-nums',
                        (eloDelta ?? 0) >= 0 ? 'text-[#538d4e]' : 'text-[#e74c3c]',
                      )}
                    >
                      {(eloDelta ?? 0) >= 0 ? '+' : ''}
                      {Math.round(eloDelta ?? 0)}
                    </span>
                  </button>

                  <AnimatePresence>
                    {showEloDist &&
                      game.elo_before != null &&
                      game.word_difficulty != null && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 right-0 top-full mt-1 z-20 p-2.5 rounded-xl bg-[#16161a] border border-white/[0.1] shadow-xl"
                        >
                          <p className="text-[10px] text-text-ghost uppercase tracking-wider mb-1.5">
                            ELO by outcome
                          </p>
                          <div className="flex flex-col gap-0.5">
                            {computeEloDist(
                              game.elo_before,
                              game.word_difficulty,
                              game.is_placement,
                            ).map((row) => {
                              const isActual =
                                (wonGame && row.label === `${game.num_guesses}/6`) ||
                                (!wonGame && row.label === 'X/6');
                              return (
                                <div
                                  key={row.label}
                                  className={clsx(
                                    'flex items-center justify-between px-2 py-1 rounded-md text-xs font-mono tabular-nums',
                                    isActual ? 'bg-white/[0.08]' : '',
                                  )}
                                >
                                  <span
                                    className={clsx(
                                      'text-text-secondary',
                                      isActual && 'text-text-primary font-semibold',
                                    )}
                                  >
                                    {row.label}
                                  </span>
                                  <span
                                    className={clsx(
                                      row.delta >= 0 ? 'text-[#538d4e]' : 'text-[#e74c3c]',
                                      isActual && 'font-semibold',
                                    )}
                                  >
                                    {row.delta >= 0 ? '+' : ''}
                                    {row.delta}
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
                <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-[#16161a] border border-white/[0.08]">
                  <span className="text-[10px] text-text-ghost uppercase tracking-wider flex items-center gap-1">
                    <Target size={9} /> Accuracy
                  </span>
                  <span className="text-lg font-mono font-bold tabular-nums text-text-primary">
                    {Math.round(game.accuracy_score)}%
                  </span>
                </div>
              )}

              {game.luck_factor !== null && (
                <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-[#16161a] border border-white/[0.08]">
                  <span className="text-[10px] text-text-ghost uppercase tracking-wider flex items-center gap-1">
                    <Zap size={9} /> Luck
                  </span>
                  <span
                    className={clsx(
                      'text-lg font-mono font-bold tabular-nums',
                      (game.luck_factor ?? 0) > 0
                        ? 'text-[#538d4e]'
                        : (game.luck_factor ?? 0) < 0
                          ? 'text-[#e74c3c]'
                          : 'text-text-primary',
                    )}
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

          <div className="p-4 rounded-2xl bg-[#16161a] border border-white/[0.08] min-h-0 flex-1 overflow-y-auto">
            {/* Analysis tab */}
            {activeTab === 'analysis' && (
              <div className="flex flex-col gap-1">
                <div className="grid grid-cols-[1.5rem_4.5rem_1fr_6rem_3.5rem_1.5rem] px-3 py-1.5 text-[10px] text-text-ghost uppercase tracking-wider border-b border-white/[0.06] mb-1">
                  <span>#</span>
                  <span>Pattern</span>
                  <span>Word</span>
                  <span className="text-right">Class.</span>
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
                    <p className="text-sm text-text-secondary mb-3">{analysisError}</p>
                    <button
                      onClick={runAnalysis}
                      className="px-4 py-2 rounded-lg bg-[#1e1e23] hover:bg-bg-elevated text-text-primary text-sm transition-colors border border-white/[0.08]"
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
                    />
                  ))
                ) : game ? (
                  [...game.moves]
                    .sort((a, b) => a.move_number - b.move_number)
                    .map((move, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04]"
                      >
                        <span className="text-xs font-mono text-text-ghost w-4 text-right">
                          {i + 1}
                        </span>
                        <MiniTiles pattern={move.pattern} size={13} />
                        <span className="text-sm font-mono font-semibold text-text-primary uppercase tracking-wider flex-1">
                          {move.guess_word}
                        </span>
                        <span className="text-xs text-text-ghost px-2 py-0.5 rounded-full bg-[#1e1e23]">
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
                        <span className="text-xs px-2.5 py-1 rounded-full bg-[#e74c3c]/10 border border-[#e74c3c]/20 text-[#e74c3c]">
                          {analysis.constraint_violations} constraint violation
                          {analysis.constraint_violations !== 1 ? 's' : ''}
                        </span>
                      )}
                      {analysis.traps_encountered > 0 && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-[#9c27b0]/10 border border-[#9c27b0]/20 text-[#9c27b0]">
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
                  <p className="text-sm text-text-ghost">
                    {loadingAnalysis ? 'Analyzing...' : 'No data available.'}
                  </p>
                </div>
              ))}

            {/* Timeline tab */}
            {activeTab === 'timeline' &&
              (analysis ? (
                <div className="flex flex-col gap-6">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-ghost mb-3">
                      Move Quality (Efficiency)
                    </p>
                    <MoveQualityTimeline moves={analysis.moves} />
                  </div>
                  <div className="border-t border-white/[0.06] pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-ghost mb-3">
                      Remaining Words Narrowing
                    </p>
                    <EntropyWaterfall moves={analysis.moves} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-text-ghost">
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
                  <p className="text-sm text-text-ghost">
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
                  <p className="text-sm text-text-ghost">
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
    </div>
  );
}
