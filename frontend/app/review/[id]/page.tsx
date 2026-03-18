'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
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
  }
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
  Play,
} from 'lucide-react';
import AccuracyGauge from '@/components/AccuracyGauge';
import ClassificationBadge from '@/components/ClassificationBadge';
import MiniTiles from '@/components/MiniTiles';
import TabSystem from '@/components/TabSystem';
import MoveQualityTimeline from '@/components/MoveQualityTimeline';
import EntropyWaterfall from '@/components/EntropyWaterfall';
import PatternHistogram from '@/components/PatternHistogram';
import LetterHeatmap from '@/components/LetterHeatmap';
import AutoPlayControls from '@/components/AutoPlayControls';
import AiSummary from '@/components/AiSummary';
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
} from '@/lib/types';
import clsx from 'clsx';

// ---- Skeleton ----
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={clsx('skeleton rounded-lg bg-bg-tertiary', className)} />
  );
}

// ---- Mini board (compact replay) ----
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
                    border: `1px solid ${isHighlighted ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}`,
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

// ---- Move row ----
interface MoveRowProps {
  move: MoveAnalysis;
  index: number;
  revealed: boolean;
  isActive: boolean;
  onClick: () => void;
  gameId: string;
}

function MoveRow({ move, index, revealed, isActive, onClick, gameId }: MoveRowProps) {
  const effRatio = move.efficiency_ratio ?? 0;
  const infoGained = move.info_gained ?? 0;
  const config = move.classification ? CLASSIFICATION_CONFIG[move.classification] : null;

  return (
    <motion.div
      layout
      className={clsx(
        'rounded-lg transition-colors duration-100 cursor-pointer',
        isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
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
            <span className="text-xs text-text-ghost px-2 py-0.5 rounded-full bg-bg-tertiary">
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
          <div className="flex-1 h-1 rounded-full bg-bg-tertiary overflow-hidden">
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
                <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-bg-tertiary">
                  <span className="text-[10px] text-text-ghost uppercase tracking-wider">Remaining</span>
                  <span className="text-sm font-mono font-bold tabular-nums text-text-primary">
                    {move.remaining_after ?? move.remaining_words ?? '—'}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-bg-tertiary">
                  <span className="text-[10px] text-text-ghost uppercase tracking-wider">Entropy</span>
                  <span className="text-sm font-mono font-bold tabular-nums text-text-primary">
                    {(move.entropy_before ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-bg-tertiary">
                  <span className="text-[10px] text-text-ghost uppercase tracking-wider">Luck</span>
                  <span
                    className={clsx(
                      'text-sm font-mono font-bold tabular-nums',
                      (move.luck ?? 0) > 0
                        ? 'text-tile-correct'
                        : (move.luck ?? 0) < 0
                        ? 'text-[#e74c3c]'
                        : 'text-text-primary'
                    )}
                  >
                    {(move.luck ?? 0) > 0 ? '+' : ''}{(move.luck ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>

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
                <div className="text-xs p-2 rounded-lg bg-[#e74c3c]/10 border border-[#e74c3c]/20">
                  <span className="text-[#e74c3c] font-medium">Constraint violation: </span>
                  <span className="text-text-secondary">{move.constraint_violation}</span>
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

// ---- Top Picks panel ----
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
                : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]'
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
                i === 0 ? 'bg-[#538d4e]/10' : 'hover:bg-white/[0.03]'
              )}
            >
              <span className="text-xs font-mono tabular-nums text-text-ghost">{i + 1}</span>
              <span
                className={clsx(
                  'font-mono font-semibold uppercase',
                  i === 0 ? 'text-[#6aaa64]' : 'text-text-primary'
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

// ---- Patterns panel ----
function PatternsPanel({ moves }: { moves: MoveAnalysis[] }) {
  const [selectedMove, setSelectedMove] = useState(0);
  const move = moves[selectedMove];
  const dist: PatternBucket[] = move?.pattern_distribution ?? [];
  const optDist: PatternBucket[] | undefined = move?.optimal_pattern_distribution;
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
                : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]'
            )}
          >
            {m.guess_word}
          </button>
        ))}
      </div>
      {dist.length > 0 ? (
        <PatternHistogram
          distribution={dist}
          optimalDistribution={optDist}
          actualPattern={actualPattern}
        />
      ) : (
        <p className="text-sm text-text-ghost text-center py-6">
          No pattern distribution data for this move.
        </p>
      )}
    </div>
  );
}

// ---- Letter Map panel ----
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
                : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]'
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

// ---- Main review page ----
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

  // Auto-play state
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoMove, setAutoMove] = useState(0);
  const [playSpeed, setPlaySpeed] = useState(1);
  const autoPlayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (game.accuracy_score !== null && game.moves.every((m) => m.classification !== null)) {
        const syntheticAnalysis: AnalysisResult = {
          accuracy_score: game.accuracy_score!,
          luck_factor: game.luck_factor ?? 0,
          moves: game.moves.map((m) => ({
            ...m,
            remaining_after: m.remaining_words ?? 0,
            luck: 0,
            top_picks: [],
            trap_info: null,
          })),
          constraint_violations: 0,
          traps_encountered: 0,
          phase_accuracies: { opening: 0, midgame: 0, endgame: 0 },
        };
        setAnalysis(syntheticAnalysis);
      } else {
        runAnalysis();
      }
    }
  }, [game, runAnalysis]);

  // Classification reveal animation
  useEffect(() => {
    if (!analysis) return;
    setRevealedCount(0);
    setDisplayScore(0);

    const total = analysis.moves.length;
    const scorePerMove = analysis.accuracy_score / total;
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < total; i++) {
      const t = setTimeout(() => {
        setRevealedCount(i + 1);
        setDisplayScore(Math.round(scorePerMove * (i + 1)));
      }, 500 + i * 800);
      timers.push(t);
    }

    const finalTimer = setTimeout(() => {
      setDisplayScore(Math.round(analysis.accuracy_score));
    }, 500 + total * 800 + 200);
    timers.push(finalTimer);

    return () => timers.forEach(clearTimeout);
  }, [analysis]);

  // Auto-play engine
  const totalAutoMoves = analysis?.moves.length ?? 0;
  const msPerMove = playSpeed === 0.5 ? 1600 : playSpeed === 2 ? 400 : 800;

  useEffect(() => {
    if (!isPlaying) {
      if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
      return;
    }
    if (autoMove >= totalAutoMoves) {
      setIsPlaying(false);
      return;
    }
    autoPlayRef.current = setTimeout(() => {
      setAutoMove((prev) => prev + 1);
    }, msPerMove);
    return () => {
      if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    };
  }, [isPlaying, autoMove, totalAutoMoves, msPerMove]);

  // When auto-play advances, sync revealed count and active move
  useEffect(() => {
    if (!isPlaying) return;
    setRevealedCount(Math.min(autoMove, totalAutoMoves));
    if (autoMove > 0 && autoMove <= totalAutoMoves) {
      setActiveMove(autoMove - 1);
    }
    const scorePerMove = analysis ? analysis.accuracy_score / totalAutoMoves : 0;
    setDisplayScore(Math.round(scorePerMove * Math.min(autoMove, totalAutoMoves)));
  }, [autoMove, isPlaying, analysis, totalAutoMoves]);

  function handleAutoPlay() {
    if (autoMove >= totalAutoMoves) {
      setAutoMove(0);
    }
    setIsPlaying(true);
    setActiveTab('analysis');
  }

  function handleAutoPause() {
    setIsPlaying(false);
  }

  function handleAutoReset() {
    setIsPlaying(false);
    setAutoMove(0);
    setActiveMove(null);
    // Re-run normal reveal
    if (analysis) {
      setRevealedCount(0);
      setDisplayScore(0);
      const total = analysis.moves.length;
      const scorePerMove = analysis.accuracy_score / total;
      for (let i = 0; i < total; i++) {
        setTimeout(() => {
          setRevealedCount(i + 1);
          setDisplayScore(Math.round(scorePerMove * (i + 1)));
        }, 500 + i * 800);
      }
      setTimeout(() => {
        setDisplayScore(Math.round(analysis.accuracy_score));
      }, 500 + total * 800 + 200);
    }
  }

  function handleSetMove(n: number) {
    setIsPlaying(false);
    const clamped = Math.max(0, Math.min(totalAutoMoves, n));
    setAutoMove(clamped);
    setRevealedCount(clamped);
    if (clamped > 0) setActiveMove(clamped - 1);
    else setActiveMove(null);
    const scorePerMove = analysis ? analysis.accuracy_score / totalAutoMoves : 0;
    setDisplayScore(Math.round(scorePerMove * clamped));
  }

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
  const autoHighlightRow = isPlaying && autoMove > 0 ? autoMove - 1 : undefined;

  if (loadingGame) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
        <div className="w-6 h-6 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/dashboard')}
          className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] transition-colors"
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-text-primary">Game Review</h1>
          {game && (
            <p className="text-xs text-text-secondary capitalize">
              {game.mode} · {game.status === 'won' ? `Solved in ${game.num_guesses}/6` : 'Not solved'}
              {game.target_word && (
                <>
                  {' '}·{' '}
                  <span className="font-mono uppercase">{game.target_word}</span>
                </>
              )}
            </p>
          )}
        </div>
        {/* Auto-play trigger button */}
        {analysis && !isPlaying && (
          <motion.button
            onClick={handleAutoPlay}
            whileTap={{ scale: 0.92 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#538d4e]/10 border border-[#538d4e]/30 text-[#6aaa64] hover:bg-[#538d4e]/20 transition-colors text-xs font-medium"
          >
            <Play size={12} />
            Auto-play
          </motion.button>
        )}
        {isPlaying && (
          <motion.button
            onClick={handleAutoPause}
            whileTap={{ scale: 0.92 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#b59f3b]/10 border border-[#b59f3b]/30 text-[#b59f3b] hover:bg-[#b59f3b]/20 transition-colors text-xs font-medium"
          >
            Playing...
          </motion.button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-4 items-center lg:items-start">
          {/* Mini board */}
          <div className="p-4 rounded-2xl bg-bg-secondary border border-white/[0.08]">
            <MiniBoard
              guesses={guesses}
              patterns={boardPatterns}
              targetWord={game?.target_word ?? null}
              highlightRow={autoHighlightRow}
            />
          </div>

          {/* Accuracy gauge */}
          <div className="flex flex-col items-center p-5 rounded-2xl bg-bg-secondary border border-white/[0.08] w-full">
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
              <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-bg-secondary border border-white/[0.08]">
                <span className="text-[10px] text-text-ghost uppercase tracking-wider flex items-center gap-1">
                  <Hash size={9} /> Guesses
                </span>
                <span className="text-lg font-mono font-bold tabular-nums text-text-primary">
                  {wonGame ? `${game.num_guesses}/6` : 'X/6'}
                </span>
              </div>

              {eloDelta !== null && game.rated && (
                <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-bg-secondary border border-white/[0.08]">
                  <span className="text-[10px] text-text-ghost uppercase tracking-wider flex items-center gap-1">
                    <TrendingUp size={9} /> Rating
                  </span>
                  <span
                    className={clsx(
                      'text-lg font-mono font-bold tabular-nums',
                      (eloDelta ?? 0) >= 0 ? 'text-tile-correct' : 'text-[#e74c3c]'
                    )}
                  >
                    {(eloDelta ?? 0) >= 0 ? '+' : ''}{eloDelta}
                  </span>
                </div>
              )}

              {game.accuracy_score !== null && (
                <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-bg-secondary border border-white/[0.08]">
                  <span className="text-[10px] text-text-ghost uppercase tracking-wider flex items-center gap-1">
                    <Target size={9} /> Accuracy
                  </span>
                  <span className="text-lg font-mono font-bold tabular-nums text-text-primary">
                    {Math.round(game.accuracy_score)}%
                  </span>
                </div>
              )}

              {game.luck_factor !== null && (
                <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-bg-secondary border border-white/[0.08]">
                  <span className="text-[10px] text-text-ghost uppercase tracking-wider flex items-center gap-1">
                    <Zap size={9} /> Luck
                  </span>
                  <span
                    className={clsx(
                      'text-lg font-mono font-bold tabular-nums',
                      (game.luck_factor ?? 0) > 0
                        ? 'text-tile-correct'
                        : (game.luck_factor ?? 0) < 0
                        ? 'text-[#e74c3c]'
                        : 'text-text-primary'
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

          {/* Phase accuracies */}
          {analysis && (
            <div className="w-full p-3 rounded-xl bg-bg-secondary border border-white/[0.08]">
              <p className="text-[10px] text-text-ghost uppercase tracking-wider mb-2">Phase Accuracy</p>
              {(['opening', 'midgame', 'endgame'] as const).map((phase) => {
                const val = analysis.phase_accuracies[phase] ?? 0;
                return (
                  <div key={phase} className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs text-text-secondary capitalize w-16">{phase}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-[#538d4e]"
                        initial={{ width: 0 }}
                        animate={{ width: `${val}%` }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                      />
                    </div>
                    <span className="text-xs font-mono tabular-nums text-text-secondary w-8 text-right">
                      {Math.round(val)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* AI Summary */}
          {analysis && game && (
            <AiSummary gameId={game.id} analysis={analysis} />
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-3">
          <TabSystem
            tabs={TABS}
            activeTab={activeTab}
            onChange={setActiveTab}
          />

          {/* Auto-play controls (shown when analysis is available) */}
          {analysis && (
            <AutoPlayControls
              totalMoves={totalAutoMoves}
              currentMove={autoMove}
              isPlaying={isPlaying}
              onPlay={handleAutoPlay}
              onPause={handleAutoPause}
              onReset={handleAutoReset}
              onSetMove={handleSetMove}
              speed={playSpeed}
              onSpeedChange={setPlaySpeed}
            />
          )}

          <div className="p-4 rounded-2xl bg-bg-secondary border border-white/[0.08] min-h-[300px]">
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
                      className="px-4 py-2 rounded-lg bg-bg-tertiary hover:bg-bg-elevated text-text-primary text-sm transition-colors border border-white/[0.08]"
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
                      revealed={i < revealedCount}
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
                        <span className="text-xs text-text-ghost px-2 py-0.5 rounded-full bg-bg-tertiary">
                          ?
                        </span>
                      </div>
                    ))
                ) : null}
              </div>
            )}

            {/* Top Picks tab */}
            {activeTab === 'top_picks' && (
              analysis ? (
                <TopPicksPanel moves={analysis.moves} />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-text-ghost">
                    {loadingAnalysis ? 'Analyzing...' : 'No data available.'}
                  </p>
                </div>
              )
            )}

            {/* Timeline tab */}
            {activeTab === 'timeline' && (
              analysis ? (
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
              )
            )}

            {/* Patterns tab */}
            {activeTab === 'patterns' && (
              analysis ? (
                <PatternsPanel moves={analysis.moves} />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-text-ghost">
                    {loadingAnalysis ? 'Analyzing...' : 'No data available.'}
                  </p>
                </div>
              )
            )}

            {/* Letter Map tab */}
            {activeTab === 'letter_map' && (
              analysis ? (
                <LetterMapPanel moves={analysis.moves} />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-text-ghost">
                    {loadingAnalysis ? 'Analyzing...' : 'No data available.'}
                  </p>
                </div>
              )
            )}

            {/* Graph tab */}
            {activeTab === 'graph' && game && (
              <GameStateGraph gameId={game.id} />
            )}
          </div>

          {/* Summary flags */}
          {analysis && (analysis.constraint_violations > 0 || analysis.traps_encountered > 0) && (
            <div className="flex gap-2 flex-wrap">
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
      </div>

      {/* Coach Chat */}
      {game && analysis && (
        <div className="mt-4 max-w-lg">
          <CoachChat
            gameId={game.id}
            gameContext={`Game: ${game.target_word}, ${game.status} in ${game.num_guesses}/6, Accuracy: ${Math.round(game.accuracy_score ?? 0)}%`}
          />
        </div>
      )}
    </div>
  );
}
