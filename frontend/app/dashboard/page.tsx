'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BarChart2,
  Flame,
  Trophy,
  Target,
  Hash,
  TrendingUp,
  Clock,
  Trash2,
  Star,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { gamesApi, usersApi } from '@/lib/api';
import { Game, getRatingTier, RATING_TIERS, EloHistoryEntry } from '@/lib/types';
import { springs, stagger } from '@/lib/animations';
import EloSparkline from '@/components/EloSparkline';
import GuessDistribution from '@/components/GuessDistribution';
import clsx from 'clsx';

const MODE_ICONS: Record<string, string> = {
  daily: '☀',
  competitive: '⚔',
  practice: '⚗',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  won: { label: 'Won', color: '#538d4e' },
  lost: { label: 'Lost', color: '#e74c3c' },
  in_progress: { label: 'In Progress', color: '#b59f3b' },
  abandoned: { label: 'Abandoned', color: '#565758' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface UserStats {
  distribution?: Record<string, number>;
  losses?: number;
  [key: string]: unknown;
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New state for Phase 2
  const [eloHistory, setEloHistory] = useState<EloHistoryEntry[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    gamesApi
      .list({ per_page: 20 })
      .then((res) => {
        const data = res.data;
        setGames(Array.isArray(data) ? data : data.games || data.items || []);
      })
      .catch(() => {})
      .finally(() => setLoadingGames(false));
  }, [user]);

  // Fetch ELO history
  useEffect(() => {
    if (!user) return;
    setLoadingHistory(true);
    usersApi
      .eloHistory(90)
      .then((res) => {
        const data = res.data;
        setEloHistory(Array.isArray(data) ? data : data.history || data.entries || []);
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [user]);

  // Fetch user stats
  useEffect(() => {
    if (!user) return;
    setLoadingStats(true);
    usersApi
      .stats()
      .then((res) => setUserStats(res.data))
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, [user]);

  const handleDelete = async (gameId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(gameId);
    try {
      await gamesApi.delete(gameId);
      setGames((prev) => prev.filter((g) => g.id !== gameId));
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
        <div className="w-6 h-6 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
      </div>
    );
  }

  const tier = getRatingTier(user.elo_rating);

  // Rank progress within current tier
  const tierIndex = RATING_TIERS.findIndex((t) => t.name === tier.name);
  const nextTier = RATING_TIERS[tierIndex + 1] ?? null;
  const tierMin = tier.min;
  const tierMax = nextTier ? nextTier.min - 1 : tier.max;
  const tierRange = tierMax - tierMin;
  const tierProgress =
    tierRange > 0
      ? Math.max(0, Math.min(100, ((user.elo_rating - tierMin) / tierRange) * 100))
      : 100;
  const toNextTier = nextTier
    ? Math.max(0, nextTier.min - user.elo_rating)
    : 0;

  // Compute stats from recent games
  const completedGames = games.filter(
    (g) => g.status === 'won' || g.status === 'lost'
  );
  const wonGames = games.filter((g) => g.status === 'won');
  // A "win" = gained ELO (positive elo_delta), not just status === 'won'
  const eloWins = games.filter(
    (g) => g.elo_delta != null && g.elo_delta > 0
  );
  const winRate =
    completedGames.length > 0
      ? Math.round((eloWins.length / completedGames.length) * 100)
      : 0;
  const avgGuesses =
    wonGames.length > 0
      ? (wonGames.reduce((sum, g) => sum + g.num_guesses, 0) / wonGames.length).toFixed(1)
      : '—';

  const STATS = [
    {
      icon: <Hash size={14} />,
      label: 'Games Played',
      value: user.games_played,
    },
    {
      icon: <Trophy size={14} />,
      label: 'Win Rate',
      value: `${winRate}%`,
    },
    {
      icon: <Target size={14} />,
      label: 'Avg Guesses',
      value: avgGuesses,
    },
    {
      icon: <Flame size={14} />,
      label: 'Current Streak',
      value: user.current_streak,
    },
  ];

  // Guess distribution from userStats or fallback to games
  const guessDistribution: Record<string, number> =
    (userStats?.distribution as Record<string, number>) ??
    wonGames.reduce<Record<string, number>>((acc, g) => {
      const key = String(g.num_guesses);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  const lossCount =
    typeof userStats?.losses === 'number'
      ? userStats.losses
      : games.filter((g) => g.status === 'lost').length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header: ELO display */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.slide}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4"
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <span
              className="text-5xl font-bold font-mono tabular-nums"
              style={{ color: tier.color }}
            >
              {Math.round(user.elo_rating)}
            </span>
            <div className="flex flex-col gap-1">
              <span
                className="text-sm px-2.5 py-1 rounded-full font-medium"
                style={{ color: tier.color, backgroundColor: `${tier.color}1a` }}
              >
                {tier.name}
              </span>
              {user.is_placement && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#b59f3b]/10 border border-[#b59f3b]/20 text-[#b59f3b] font-medium text-center">
                  Placement
                </span>
              )}
            </div>
          </div>
          <p className="text-sm text-text-secondary">{user.username}</p>
        </div>

        <div className="flex gap-2">
          {user.current_streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e67e22]/10 border border-[#e67e22]/20 text-[#e67e22] text-sm font-medium">
              <Flame size={14} />
              {user.current_streak} streak
            </div>
          )}
          {user.longest_streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-secondary border border-white/[0.08] text-text-secondary text-sm">
              <Star size={12} />
              Best: {user.longest_streak}
            </div>
          )}
        </div>
      </motion.div>

      {/* Rank progress bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.slide, delay: 0.1 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
            {tier.name} Progress
          </span>
          {nextTier ? (
            <span className="text-[10px] font-mono tabular-nums text-text-ghost">
              <span style={{ color: tier.color }}>{Math.round(user.elo_rating)}</span>
              {' / '}
              <span>{nextTier.min}</span>
              {' to '}
              <span style={{ color: nextTier.color }}>{nextTier.name}</span>
              {' · '}
              <span className="text-text-secondary">{toNextTier} to go</span>
            </span>
          ) : (
            <span className="text-[10px] font-mono text-text-ghost">Max rank</span>
          )}
        </div>
        <div className="h-2 rounded-full bg-bg-secondary border border-white/[0.06] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: tier.color }}
            initial={{ width: 0 }}
            animate={{ width: `${tierProgress}%` }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          />
        </div>
      </motion.div>

      {/* Stats grid */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8"
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: stagger.fast } }}
      >
        {STATS.map((stat, i) => (
          <motion.div
            key={i}
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0, transition: springs.slide },
            }}
            className="flex flex-col gap-2 p-4 rounded-xl bg-bg-secondary border border-white/[0.08]"
          >
            <div className="flex items-center gap-1.5 text-text-ghost">
              {stat.icon}
              <span className="text-[10px] uppercase tracking-wider font-medium">
                {stat.label}
              </span>
            </div>
            <span className="text-2xl font-mono font-bold tabular-nums text-text-primary">
              {stat.value}
            </span>
          </motion.div>
        ))}
      </motion.div>

      {/* ELO Sparkline */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.slide, delay: 0.2 }}
        className="rounded-2xl bg-bg-secondary border border-white/[0.08] p-4 mb-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-text-ghost" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
              Rating History
            </span>
          </div>
          {eloHistory.length > 0 && (
            <span className="text-[10px] font-mono tabular-nums text-text-ghost">
              Last {eloHistory.length} games
            </span>
          )}
        </div>
        {loadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
          </div>
        ) : (
          <EloSparkline data={eloHistory} height={180} />
        )}
      </motion.div>

      {/* Guess Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.slide, delay: 0.25 }}
        className="rounded-2xl bg-bg-secondary border border-white/[0.08] p-4 mb-8"
      >
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={14} className="text-text-ghost" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
            Guess Distribution
          </span>
        </div>
        {loadingStats ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
          </div>
        ) : (
          <GuessDistribution
            distribution={guessDistribution}
            losses={lossCount}
          />
        )}
      </motion.div>

      {/* Recent games */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.slide, delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Recent Games
          </h2>
          <Link
            href="/play"
            className="text-xs text-[#6aaa64] hover:text-[#538d4e] font-medium transition-colors"
          >
            Play New
          </Link>
        </div>

        <div className="rounded-2xl bg-bg-secondary border border-white/[0.08] overflow-hidden">
          {loadingGames ? (
            <div className="flex flex-col divide-y divide-white/[0.06]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="skeleton h-4 w-4 rounded" />
                  <div className="skeleton h-4 w-24 rounded" />
                  <div className="skeleton h-4 w-16 rounded ml-auto" />
                </div>
              ))}
            </div>
          ) : games.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <BarChart2 size={32} className="text-text-ghost" />
              <p className="text-sm text-text-secondary">No games yet.</p>
              <Link
                href="/play"
                className="px-4 py-2 rounded-lg bg-[#538d4e] hover:bg-[#6aaa64] text-white text-sm font-medium transition-colors"
              >
                Play Your First Game
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {games.map((game, i) => {
                const statusInfo = STATUS_LABELS[game.status] || STATUS_LABELS.abandoned;
                const isClickable =
                  game.status === 'won' || game.status === 'lost';
                const eloDelta = game.elo_delta;

                return (
                  <motion.div
                    key={game.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <div
                      className={clsx(
                        'flex items-center gap-3 px-4 py-3 transition-colors',
                        isClickable
                          ? 'cursor-pointer hover:bg-white/[0.04]'
                          : ''
                      )}
                      onClick={() => isClickable && router.push(`/review/${game.id}`)}
                    >
                      {/* Mode icon */}
                      <span className="text-base w-6 text-center shrink-0">
                        {MODE_ICONS[game.mode] || '?'}
                      </span>

                      {/* Word + mode */}
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-mono font-semibold uppercase text-text-primary truncate">
                          {game.status === 'in_progress'
                            ? '?????'
                            : game.target_word
                            ? game.target_word
                            : '—'}
                        </span>
                        <span className="text-[10px] text-text-ghost capitalize">
                          {game.mode}
                          {game.is_placement && game.mode === 'competitive' && ' · Placement'}
                        </span>
                      </div>

                      {/* Result */}
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span
                          className="text-xs font-medium"
                          style={{ color: statusInfo.color }}
                        >
                          {statusInfo.label}
                          {game.status === 'won' && ` ${game.num_guesses}/6`}
                        </span>
                        {eloDelta !== null && game.rated && (
                          <span
                            className={clsx(
                              'text-[10px] font-mono tabular-nums',
                              (eloDelta ?? 0) >= 0 ? 'text-tile-correct' : 'text-[#e74c3c]'
                            )}
                          >
                            {(eloDelta ?? 0) >= 0 ? '+' : ''}{Math.round(eloDelta ?? 0)}
                          </span>
                        )}
                      </div>

                      {/* Date */}
                      <div className="flex flex-col items-end shrink-0 min-w-[56px]">
                        <span className="text-[10px] text-text-ghost">
                          {formatDate(game.created_at)}
                        </span>
                        {game.time_seconds && (
                          <span className="text-[10px] text-text-ghost flex items-center gap-0.5">
                            <Clock size={8} />
                            {Math.floor(game.time_seconds / 60)}:
                            {(game.time_seconds % 60).toString().padStart(2, '0')}
                          </span>
                        )}
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDelete(game.id, e)}
                        disabled={deletingId === game.id}
                        className="p-1.5 rounded-md text-text-ghost hover:text-[#e74c3c] hover:bg-[#e74c3c]/10 transition-colors shrink-0 disabled:opacity-40"
                        aria-label="Delete game"
                      >
                        {deletingId === game.id ? (
                          <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
