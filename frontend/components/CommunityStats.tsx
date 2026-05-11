'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { communityApi } from '@/lib/api';
import clsx from 'clsx';

interface WordStats {
  word: string;
  times_played: number;
  times_solved: number;
  solve_rate: number;
  avg_guesses: number | null;
  avg_accuracy: number | null;
  difficulty: number | null;
}

interface Props {
  gameId: string;
  playerGuesses: number;
  playerAccuracy: number | null;
}

export default function CommunityStats({ gameId, playerGuesses, playerAccuracy }: Props) {
  const [stats, setStats] = useState<WordStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    communityApi
      .gameStats(gameId)
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [gameId]);

  if (loading) {
    return <div className="skeleton h-16 rounded-xl bg-bg-elevated animate-pulse" />;
  }

  if (!stats || stats.times_played < 2) return null;

  const guessComparison = stats.avg_guesses
    ? playerGuesses < stats.avg_guesses
      ? 'better'
      : playerGuesses > stats.avg_guesses
      ? 'worse'
      : 'same'
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl bg-bg-base border border-border-subtle p-3"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Users size={11} className="text-text-secondary" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
          Community
        </span>
        <span className="text-[10px] text-text-secondary ml-auto">
          {stats.times_played} games
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] text-text-secondary">Avg Guesses</span>
          <span
            className={clsx(
              'text-sm font-sans font-semibold tabular-nums',
              guessComparison === 'better'
                ? 'text-tile-correct'
                : guessComparison === 'worse'
                ? 'text-red'
                : 'text-text-primary'
            )}
            style={
              guessComparison === 'worse'
                ? { color: 'var(--red)' }
                : undefined
            }
          >
            {stats.avg_guesses?.toFixed(1) ?? '—'}
          </span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] text-text-secondary">Solve Rate</span>
          <span className="text-sm font-sans font-semibold tabular-nums text-text-primary">
            {stats.solve_rate}%
          </span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] text-text-secondary">Avg Accuracy</span>
          <span className="text-sm font-sans font-semibold tabular-nums text-text-primary">
            {stats.avg_accuracy !== null && stats.avg_accuracy !== undefined
              ? `${stats.avg_accuracy.toFixed(0)}%`
              : '—'}
          </span>
        </div>
      </div>

      {guessComparison && (
        <p className="text-[10px] text-text-secondary mt-2">
          {guessComparison === 'better'
            ? `You solved it faster than average (${stats.avg_guesses?.toFixed(1)} guesses)`
            : guessComparison === 'worse'
            ? `Community average is ${stats.avg_guesses?.toFixed(1)} guesses`
            : `Right at the community average`}
        </p>
      )}
    </motion.div>
  );
}
