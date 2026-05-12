'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import {
  TrendingUp,
  BarChart2,
  Flame,
  Trophy,
  Target,
  Hash,
  Clock,
  Trash2,
  Star,
  Sun,
  Swords,
  FlaskConical,
  Gamepad2,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { gamesApi, usersApi } from '@/lib/api';
import { Game, getRatingTier, RATING_TIERS, EloHistoryEntry } from '@/lib/types';
import { springs, stagger, easings } from '@/lib/animations';
import EloSparkline from '@/components/EloSparkline';
import GuessDistribution from '@/components/GuessDistribution';
import clsx from 'clsx';

// ─── Mode icon map (Lucide, no emoji) ─────────────────────────────────────────
function ModeIcon({ mode, size = 14 }: { mode: string; size?: number }) {
  const cls = 'shrink-0 text-text-ghost';
  if (mode === 'daily') return <Sun size={size} className={cls} />;
  if (mode === 'competitive') return <Swords size={size} className={cls} />;
  if (mode === 'practice') return <FlaskConical size={size} className={cls} />;
  return <Gamepad2 size={size} className={cls} />;
}

// ─── Status config — token-driven colors ─────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  won:         { label: 'Won',         color: 'var(--tile-correct)' },
  lost:        { label: 'Lost',        color: 'var(--red)' },
  in_progress: { label: 'In Progress', color: 'var(--tile-present)' },
  abandoned:   { label: 'Abandoned',   color: 'var(--border-strong)' },
};

// ─── Date helper ─────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserStats {
  distribution?: Record<string, number>;
  losses?: number;
  [key: string]: unknown;
}

// ─── Shimmer skeleton ─────────────────────────────────────────────────────────
function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={clsx('skeleton rounded-md bg-bg-muted', className)}
      style={style}
    />
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  variants: Variants;
}
function StatCard({ label, value, icon, variants }: StatCardProps) {
  return (
    <motion.div
      variants={variants}
      className="flex flex-col gap-3 p-5 rounded-card bg-bg-base border border-border-default"
    >
      <div className="flex items-center gap-1.5 text-text-ghost">
        {icon}
        <span className="font-sans text-xs uppercase tracking-wider text-text-secondary">
          {label}
        </span>
      </div>
      <span className="font-display text-3xl font-bold tabular-nums text-text-primary leading-none">
        {value}
      </span>
    </motion.div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-sans text-xs uppercase tracking-wider font-semibold text-text-secondary">
      {children}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [games,          setGames]         = useState<Game[]>([]);
  const [loadingGames,   setLoadingGames]   = useState(true);
  const [deletingId,     setDeletingId]     = useState<string | null>(null);
  const [eloHistory,     setEloHistory]     = useState<EloHistoryEntry[]>([]);
  const [userStats,      setUserStats]      = useState<UserStats | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingStats,   setLoadingStats]   = useState(false);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  // Fetch recent games
  useEffect(() => {
    if (!user) return;
    gamesApi
      .list({ per_page: 20 })
      .then((res) => {
        const d = res.data;
        setGames(Array.isArray(d) ? d : d.games ?? d.items ?? []);
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
        const d = res.data;
        setEloHistory(Array.isArray(d) ? d : d.history ?? d.entries ?? []);
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
      // silent
    } finally {
      setDeletingId(null);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
        <div
          className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const tier      = getRatingTier(user.elo_rating);
  const tierIndex = RATING_TIERS.findIndex((t) => t.name === tier.name);
  const nextTier  = RATING_TIERS[tierIndex + 1] ?? null;
  const tierMin   = tier.min;
  const tierMax   = nextTier ? nextTier.min - 1 : tier.max;
  const tierRange = tierMax - tierMin;
  const tierProgress =
    tierRange > 0
      ? Math.max(0, Math.min(100, ((user.elo_rating - tierMin) / tierRange) * 100))
      : 100;
  const toNextTier = nextTier ? Math.max(0, nextTier.min - user.elo_rating) : 0;

  // Tier color tokens: master uses gold, veteran uses green, others use their tier color
  const isMaster  = tier.name === 'Master';
  const isVeteran = tier.name === 'Veteran';
  const tierBadgeColor = isMaster
    ? 'var(--gold)'
    : isVeteran
      ? 'var(--green)'
      : tier.color;

  const completedGames = games.filter((g) => g.status === 'won' || g.status === 'lost');
  const wonGames       = games.filter((g) => g.status === 'won');
  const eloWins        = games.filter((g) => (g.elo_delta ?? 0) > 0);
  const winRate =
    completedGames.length > 0
      ? Math.round((eloWins.length / completedGames.length) * 100)
      : 0;
  const avgGuesses =
    wonGames.length > 0
      ? (wonGames.reduce((s, g) => s + g.num_guesses, 0) / wonGames.length).toFixed(1)
      : '—';

  const guessDistribution: Record<string, number> =
    (userStats?.distribution as Record<string, number>) ??
    wonGames.reduce<Record<string, number>>((acc, g) => {
      const k = String(g.num_guesses);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});

  const lossCount =
    typeof userStats?.losses === 'number'
      ? userStats.losses
      : games.filter((g) => g.status === 'lost').length;

  // ── Animation variants ───────────────────────────────────────────────────
  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { ...springs.slide, delay },
  });

  const cardVariants: Variants = {
    hidden:  { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: springs.slide },
  };

  const containerVariants: Variants = {
    hidden:  {},
    visible: { transition: stagger.fast },
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

      {/* ── HERO: ELO + tier + streaks ─────────────────────────────────── */}
      <motion.section {...fadeUp(0)} aria-label="Rating overview">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">

          {/* Left: ELO number + tier pill + placement badge + username */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-3 flex-wrap">
              {/* Big ELO number */}
              <span
                className="font-display text-5xl font-black tabular-nums leading-none"
                style={{ color: tier.color }}
              >
                {Math.round(user.elo_rating)}
              </span>

              {/* Tier pill — token-driven color */}
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-pill text-sm font-semibold leading-none border"
                style={{
                  color: tierBadgeColor,
                  backgroundColor: `color-mix(in srgb, ${tierBadgeColor} 12%, transparent)`,
                  borderColor: `color-mix(in srgb, ${tierBadgeColor} 25%, transparent)`,
                }}
              >
                {tier.name}
              </span>

              {/* Placement badge */}
              {user.is_placement && (
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-medium leading-none border"
                  style={{
                    color: 'var(--gold)',
                    backgroundColor: 'color-mix(in srgb, var(--gold) 10%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--gold) 25%, transparent)',
                  }}
                >
                  Placement {user.games_played}/5
                </span>
              )}
            </div>

            {/* Username */}
            <p className="font-display text-3xl font-black text-text-primary tracking-tight">
              {user.username}
            </p>
          </div>

          {/* Right: streak pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {user.current_streak > 0 && (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill border border-border-subtle text-xs font-medium"
                style={{ color: 'var(--red)' }}
              >
                <Flame size={12} />
                {user.current_streak} streak
              </div>
            )}
            {user.longest_streak > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill border border-border-subtle text-xs text-text-secondary">
                <Star size={11} />
                Best&nbsp;
                <span className="font-mono tabular-nums text-text-primary font-semibold">
                  {user.longest_streak}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tier progress bar — solid tokens, no gradient */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>{tier.name} Progress</SectionLabel>
            {nextTier ? (
              <span className="font-sans text-[10px] font-mono tabular-nums text-text-secondary">
                <span style={{ color: tier.color }}>{Math.round(user.elo_rating)}</span>
                {' → '}
                <span style={{ color: nextTier.color }}>{nextTier.name}</span>
                {' · '}
                <span className="text-text-secondary">{toNextTier} pts to go</span>
              </span>
            ) : (
              <span className="font-sans text-[10px] font-mono text-text-secondary">Max rank reached</span>
            )}
          </div>
          {/* Solid bg-bg-muted track, fill with tier-correct or gold for master */}
          <div
            className="h-1.5 rounded-pill bg-bg-muted border border-border-subtle overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(tierProgress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${tier.name} tier progress`}
          >
            <motion.div
              className="h-full rounded-pill"
              style={{ backgroundColor: isMaster ? 'var(--gold)' : 'var(--tile-correct)' }}
              initial={{ width: 0 }}
              animate={{ width: `${tierProgress}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            />
          </div>
        </div>
      </motion.section>

      {/* ── STATS GRID ─────────────────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        aria-label="Player statistics"
      >
        <StatCard
          label="Games Played"
          value={user.games_played}
          icon={<Hash size={13} />}
          variants={cardVariants}
        />
        <StatCard
          label="Win Rate"
          value={`${winRate}%`}
          icon={<Trophy size={13} />}
          variants={cardVariants}
        />
        <StatCard
          label="Avg Guesses"
          value={avgGuesses}
          icon={<Target size={13} />}
          variants={cardVariants}
        />
        <StatCard
          label="Current Streak"
          value={user.current_streak}
          icon={<Flame size={13} />}
          variants={cardVariants}
        />
      </motion.div>

      {/* ── ELO SPARKLINE ──────────────────────────────────────────────── */}
      <motion.section
        {...fadeUp(0.2)}
        className="rounded-card-lg bg-bg-elevated border border-border-subtle p-5"
        aria-label="Rating history chart"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-text-ghost" />
            <span className="font-sans font-semibold text-sm text-text-primary">Rating History</span>
          </div>
          {eloHistory.length > 0 && (
            <span className="font-sans text-[10px] font-mono tabular-nums text-text-secondary">
              Last {eloHistory.length} game{eloHistory.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {loadingHistory ? (
          <div className="space-y-2 py-4">
            <Shimmer className="h-3 w-full" />
            <Shimmer className="h-3 w-5/6" />
            <Shimmer className="h-3 w-4/6" />
            <Shimmer className="h-32 w-full mt-2" />
          </div>
        ) : (
          <EloSparkline data={eloHistory} height={180} />
        )}
      </motion.section>

      {/* ── GUESS DISTRIBUTION ─────────────────────────────────────────── */}
      <motion.section
        {...fadeUp(0.25)}
        className="rounded-card-lg bg-bg-elevated border border-border-subtle p-5"
        aria-label="Guess distribution"
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={14} className="text-text-ghost" />
          <span className="font-sans font-semibold text-sm text-text-primary">Guess Distribution</span>
        </div>

        {loadingStats ? (
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Shimmer className="h-3 w-3" />
                <Shimmer className="h-5 flex-1" style={{ width: `${40 + i * 7}%` }} />
              </div>
            ))}
          </div>
        ) : (
          <GuessDistribution distribution={guessDistribution} losses={lossCount} />
        )}
      </motion.section>

      {/* ── RECENT GAMES ───────────────────────────────────────────────── */}
      <motion.section {...fadeUp(0.3)} aria-label="Recent games">
        {/* Section header */}
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Recent Games</SectionLabel>
          <Link
            href="/play"
            className="font-sans text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 rounded"
            style={{ color: 'var(--tile-correct)' }}
            aria-label="Play a new game"
          >
            Play New
          </Link>
        </div>

        {/* Games container */}
        <div className="rounded-card-lg bg-bg-base border border-border-default overflow-hidden">
          {loadingGames ? (
            /* Shimmer rows */
            <div className="divide-y divide-border-subtle">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <Shimmer className="h-4 w-4 rounded-sm" />
                  <Shimmer className="h-4 w-28 rounded-sm" />
                  <Shimmer className="h-3 w-16 rounded-sm ml-auto" />
                  <Shimmer className="h-3 w-10 rounded-sm" />
                  <Shimmer className="h-4 w-4 rounded-sm" />
                </div>
              ))}
            </div>
          ) : completedGames.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center gap-4 py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-bg-muted border border-border-subtle flex items-center justify-center">
                <Gamepad2 size={22} className="text-text-ghost" />
              </div>
              <div className="space-y-1">
                <p className="font-sans text-sm font-medium text-text-secondary">No completed games yet</p>
                <p className="font-sans text-xs text-text-ghost">
                  Finish a game to see it here.
                </p>
              </div>
              <Link
                href="/play"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-card text-white text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2"
                style={{
                  backgroundColor: 'var(--tile-correct)',
                  outlineColor: 'var(--tile-correct)',
                }}
              >
                Play a Game
              </Link>
            </div>
          ) : (
            /* Game rows */
            <div className="divide-y divide-border-subtle" role="list">
              {completedGames.map((game, i) => {
                const statusInfo  = STATUS_CONFIG[game.status] ?? STATUS_CONFIG.abandoned;
                const isClickable = game.status === 'won' || game.status === 'lost';
                const eloDelta    = game.elo_delta;
                const showWord    =
                  !(game.status === 'in_progress') &&
                  !(game.status === 'abandoned' && game.mode === 'daily');

                return (
                  <motion.div
                    key={game.id}
                    role="listitem"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.045, 0.4), ...easings.fade }}
                  >
                    <div
                      className={clsx(
                        'flex items-center gap-3 px-4 py-3 border-b border-border-subtle last:border-0 transition-colors',
                        isClickable
                          ? 'cursor-pointer hover:bg-bg-elevated/50 active:bg-bg-muted'
                          : 'cursor-default'
                      )}
                      onClick={() => isClickable && router.push(`/review/${game.id}`)}
                      aria-label={
                        isClickable
                          ? `Review ${showWord ? game.target_word : '?????'} — ${statusInfo.label}`
                          : undefined
                      }
                    >
                      {/* Mode icon */}
                      <span className="shrink-0 w-[22px] flex items-center justify-center">
                        <ModeIcon mode={game.mode} size={14} />
                      </span>

                      {/* Word + mode label */}
                      <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                        <span className="font-mono text-sm font-semibold uppercase text-text-primary tracking-wide truncate">
                          {showWord ? (game.target_word ?? '—') : '?????'}
                        </span>
                        <span className="font-sans text-[10px] text-text-ghost capitalize leading-none">
                          {game.mode}
                          {game.is_placement && game.mode === 'competitive' && ' · Placement'}
                        </span>
                      </div>

                      {/* Status + ELO delta */}
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span
                          className="font-sans text-xs font-semibold"
                          style={{ color: statusInfo.color }}
                        >
                          {statusInfo.label}
                          {game.status === 'won' && (
                            <span className="font-mono font-normal text-[10px] ml-1 text-text-ghost">
                              {game.num_guesses}/6
                            </span>
                          )}
                        </span>
                        {eloDelta !== null && game.rated && (
                          <span
                            className="font-mono text-[10px] tabular-nums font-semibold"
                            style={{
                              color: (eloDelta ?? 0) >= 0 ? 'var(--tile-correct)' : 'var(--red)',
                            }}
                          >
                            {(eloDelta ?? 0) >= 0 ? '+' : ''}
                            {Math.round(eloDelta ?? 0)}
                          </span>
                        )}
                      </div>

                      {/* Date + time */}
                      <div className="flex flex-col items-end shrink-0 min-w-[52px] gap-0.5">
                        <span className="font-sans text-[10px] text-text-ghost tabular-nums">
                          {formatDate(game.created_at)}
                        </span>
                        {game.time_seconds != null && (
                          <span className="font-sans text-[10px] text-text-ghost flex items-center gap-0.5 tabular-nums font-mono">
                            <Clock size={8} className="shrink-0" />
                            {Math.floor(game.time_seconds / 60)}:
                            {String(game.time_seconds % 60).padStart(2, '0')}
                          </span>
                        )}
                      </div>

                      {/* Delete */}
                      <button
                        onClick={(e) => handleDelete(game.id, e)}
                        disabled={deletingId === game.id}
                        className="p-1.5 ml-1 rounded-md text-text-ghost transition-colors shrink-0 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2"
                        style={
                          {
                            '--hover-color': 'var(--red)',
                          } as React.CSSProperties
                        }
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--red)';
                          e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--red) 10%, transparent)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '';
                          e.currentTarget.style.backgroundColor = '';
                        }}
                        aria-label={`Delete game — ${showWord ? game.target_word : '?????'}`}
                      >
                        {deletingId === game.id ? (
                          <span className="block w-3.5 h-3.5 rounded-full border border-current border-t-transparent animate-spin" />
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
      </motion.section>

    </div>
  );
}
