'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { leaderboardApi } from '@/lib/api';
import { getRatingTier } from '@/lib/types';
import { springs, stagger } from '@/lib/animations';
import clsx from 'clsx';

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  elo_rating: number;
  games_played: number;
  wins: number;
}

// ─── Tier dot ────────────────────────────────────────────────────────────────
function TierDot({ elo }: { elo: number }) {
  const tier = getRatingTier(elo);
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: tier.color }}
      aria-label={tier.name}
    />
  );
}

// ─── Rank badge — no medal fill, accent border approach ──────────────────────
// Top 3 use accent color text; rest use muted text
// Mirrors the Wordle-tile palette used elsewhere in the app:
// blue = best (#1), green = good (#2), yellow = okay (#3).
const TOP3_COLORS: Record<number, string> = {
  1: 'var(--cls-blue)',
  2: 'var(--tile-correct)',
  3: 'var(--tile-present)',
};

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span
        className="font-display text-sm font-bold w-7 text-right tabular-nums shrink-0"
        style={{ color: TOP3_COLORS[rank] }}
        aria-label={`Rank ${rank}`}
      >
        {rank}
      </span>
    );
  }
  return (
    <span
      className="font-display text-sm font-bold w-7 text-right tabular-nums text-text-ghost shrink-0"
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}

// ─── Top-3 podium cards ───────────────────────────────────────────────────────
function PodiumCard({ entry, isCurrentUser }: { entry: LeaderboardEntry; isCurrentUser: boolean }) {
  const rank = entry.rank as 1 | 2 | 3;
  const accentColor = TOP3_COLORS[rank];
  const winRate =
    entry.games_played > 0
      ? Math.round((entry.wins / entry.games_played) * 100)
      : 0;

  return (
    <div
      className={clsx(
        'flex flex-col gap-1.5 p-4 rounded-card border transition-colors',
        rank === 1 ? 'bg-bg-elevated' : 'bg-bg-base'
      )}
      style={{
        borderColor: accentColor,
        borderLeftWidth: rank === 1 ? '3px' : '1px',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TierDot elo={Math.round(entry.elo_rating)} />
          <span
            className={clsx(
              'font-display font-bold text-sm truncate',
              isCurrentUser ? 'text-tile-correct' : 'text-text-primary'
            )}
          >
            {entry.username}
          </span>
          {isCurrentUser && (
            <span className="font-sans text-[10px] text-text-ghost shrink-0">(you)</span>
          )}
        </div>
        <RankBadge rank={entry.rank} />
      </div>
      <div className="flex items-baseline gap-3">
        <span
          className="font-display text-2xl font-bold tabular-nums leading-none"
          style={{ color: accentColor }}
        >
          {Math.round(entry.elo_rating)}
        </span>
        <span className="font-sans text-xs text-text-ghost tabular-nums">
          {winRate}% WR
        </span>
      </div>
    </div>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle last:border-0"
    >
      <div className="w-7 h-4 rounded bg-bg-muted shrink-0 animate-pulse" />
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-bg-muted animate-pulse" />
        <div className="h-3.5 w-28 rounded bg-bg-muted animate-pulse" />
      </div>
      <div className="h-3.5 w-10 rounded bg-bg-muted animate-pulse ml-auto" />
      <div className="h-3 w-8 rounded bg-bg-muted animate-pulse" />
      <div className="h-3 w-7 rounded bg-bg-muted animate-pulse" />
    </motion.div>
  );
}

// ─── Openers tab ──────────────────────────────────────────────────────────────
interface OpenerRow {
  rank: number;
  opener: string;
  plays: number;
  wins: number;
  solve_rate: number;
  avg_guesses_win: number | null;
  popularity_pct: number;
}

function OpenersPanel() {
  const [rows, setRows] = useState<OpenerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    leaderboardApi
      .openers(20)
      .then((res) => {
        const data = res.data as { total_games: number; openers: OpenerRow[] };
        setRows(data.openers ?? []);
        setTotal(data.total_games ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.slide, delay: 0.1 }}
      className="bg-bg-base border border-border-default rounded-card-lg overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border-subtle">
        <span className="w-7 text-right font-sans text-[10px] font-semibold text-text-ghost uppercase tracking-wider shrink-0">#</span>
        <span className="flex-1 font-sans text-[10px] font-semibold text-text-ghost uppercase tracking-wider">Opener</span>
        <span className="w-14 text-right font-sans text-[10px] font-semibold text-text-ghost uppercase tracking-wider shrink-0">Used</span>
        <span className="w-14 text-right font-sans text-[10px] font-semibold text-text-ghost uppercase tracking-wider shrink-0">Solve%</span>
        <span className="w-12 text-right font-sans text-[10px] font-semibold text-text-ghost uppercase tracking-wider shrink-0">Avg</span>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 'max(280px, calc(100dvh - 420px))', scrollbarGutter: 'stable' }}>
        {loading ? (
          <div className="py-12 text-center font-sans text-sm text-text-secondary">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center font-sans text-sm text-text-secondary">No completed games yet.</div>
        ) : (
          rows.map((r) => (
            <div
              key={r.opener}
              className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50 transition-colors"
            >
              <span className="w-7 text-right font-display font-bold text-sm tabular-nums shrink-0 text-text-ghost">{r.rank}</span>
              <span className="flex-1 font-mono text-sm font-semibold text-text-primary tracking-wider">{r.opener}</span>
              <span className="w-14 text-right font-mono text-xs text-text-secondary tabular-nums shrink-0">{r.popularity_pct}%</span>
              <span className="w-14 text-right font-mono text-xs text-text-secondary tabular-nums shrink-0">{r.solve_rate}%</span>
              <span className="w-12 text-right font-mono text-xs text-text-secondary tabular-nums shrink-0">
                {r.avg_guesses_win != null ? r.avg_guesses_win.toFixed(1) : '—'}
              </span>
            </div>
          ))
        )}
      </div>
      {!loading && total > 0 && (
        <div className="px-4 py-2.5 border-t border-border-subtle">
          <span className="font-sans text-[11px] text-text-ghost">
            From {total.toLocaleString()} completed games. Avg = guesses to win when this opener led.
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
type LeaderboardTab = 'players' | 'openers';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<LeaderboardTab>('players');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const PER_PAGE = 20;

  useEffect(() => {
    if (tab !== 'players') return;
    setLoading(true);
    leaderboardApi
      .get({ page, per_page: PER_PAGE })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setEntries(list);
        setHasMore(list.length === PER_PAGE);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, tab]);

  const rowVariants: Variants = {
    hidden:  { opacity: 0, y: 6 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
  };

  const containerVariants: Variants = {
    hidden:  {},
    visible: { transition: stagger.fast },
  };

  const topThree = entries.filter((e) => e.rank <= 3);
  const rest     = entries.filter((e) => e.rank > 3);

  const renderRow = (entry: LeaderboardEntry, isCurrentUser: boolean) => {
    const winRate =
      entry.games_played > 0
        ? Math.round((entry.wins / entry.games_played) * 100)
        : 0;
    const tierColor = getRatingTier(entry.elo_rating).color;

    return (
      <motion.div
        key={entry.user_id}
        variants={rowVariants}
        layout
        className={clsx(
          'flex items-center gap-3 px-4 py-3.5 border-b border-border-subtle last:border-0 transition-colors duration-150',
          isCurrentUser
            ? 'bg-bg-elevated border-l-4 border-l-tile-correct'
            : 'hover:bg-bg-elevated/50'
        )}
      >
        {/* Rank */}
        <div className="w-7 flex items-center justify-end shrink-0">
          <RankBadge rank={entry.rank} />
        </div>

        {/* Username + tier dot */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <TierDot elo={Math.round(entry.elo_rating)} />
          <span
            className={clsx(
              'font-sans text-sm font-semibold truncate',
              isCurrentUser ? 'text-tile-correct' : 'text-text-primary'
            )}
          >
            {entry.username}
          </span>
          {isCurrentUser && (
            <span className="font-sans text-[10px] text-text-ghost font-normal shrink-0">
              (you)
            </span>
          )}
        </div>

        {/* ELO */}
        <span
          className="font-mono text-sm font-bold w-14 text-right shrink-0 tabular-nums"
          style={{ color: tierColor }}
        >
          {Math.round(entry.elo_rating)}
        </span>

        {/* Games */}
        <span className="font-mono text-xs text-text-secondary w-12 text-right shrink-0 tabular-nums">
          {entry.games_played}
        </span>

        {/* Win rate */}
        <span className="font-mono text-xs text-text-secondary w-10 text-right shrink-0 tabular-nums">
          {winRate}%
        </span>
      </motion.div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">

      {/* Page title */}
      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.slide}
        className="font-display font-black text-4xl text-text-primary mb-1"
      >
        Leaderboard
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...springs.slide, delay: 0.08 }}
        className="font-sans text-sm text-text-secondary mb-4"
      >
        {tab === 'players'
          ? 'Top players ranked by ELO rating'
          : 'Most-played opening words across all completed games'}
      </motion.p>

      {/* Tab switcher */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...springs.slide, delay: 0.09 }}
        className="flex gap-1 mb-5 border-b border-border-subtle"
      >
        {(['players', 'openers'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'px-4 py-2 font-sans text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t
                ? 'border-tile-correct text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            {t === 'players' ? 'Players' : 'Openers'}
          </button>
        ))}
      </motion.div>

      {tab === 'openers' && <OpenersPanel />}

      {/* Top-3 podium — simple cards with accent borders */}
      {tab === 'players' && !loading && topThree.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.slide, delay: 0.1 }}
          className="grid grid-cols-3 gap-2 mb-4"
        >
          {topThree.map((entry) => (
            <PodiumCard
              key={entry.user_id}
              entry={entry}
              isCurrentUser={!!user && entry.user_id === user.id}
            />
          ))}
        </motion.div>
      )}

      {/* Main list card */}
      {tab === 'players' && (loading || rest.length > 0 || (page === 1 && !loading && entries.length === 0)) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.slide, delay: 0.14 }}
          className="bg-bg-base border border-border-default rounded-card-lg overflow-hidden"
        >
          {/* Column headers */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border-subtle">
            <span className="w-7 text-right font-sans text-[10px] font-semibold text-text-ghost uppercase tracking-wider shrink-0">
              #
            </span>
            <span className="flex-1 font-sans text-[10px] font-semibold text-text-ghost uppercase tracking-wider">
              Player
            </span>
            <span className="w-14 text-right font-sans text-[10px] font-semibold text-text-ghost uppercase tracking-wider shrink-0">
              ELO
            </span>
            <span className="w-12 text-right font-sans text-[10px] font-semibold text-text-ghost uppercase tracking-wider shrink-0">
              Games
            </span>
            <span className="w-10 text-right font-sans text-[10px] font-semibold text-text-ghost uppercase tracking-wider shrink-0">
              W%
            </span>
          </div>

          {/* Body — scrolls inside the card so the page itself doesn't grow */}
          <div
            className="overflow-y-auto"
            style={{
              maxHeight: 'max(280px, calc(100dvh - 420px))',
              scrollbarGutter: 'stable',
            }}
          >
          {loading ? (
            <div>
              {Array.from({ length: 10 }).map((_, i) => (
                <SkeletonRow key={i} index={i} />
              ))}
            </div>
          ) : rest.length === 0 && page === 1 && entries.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-sans text-sm text-text-secondary">No players yet. Be the first!</p>
            </div>
          ) : rest.length > 0 ? (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={containerVariants}
            >
              {rest.map((entry) =>
                renderRow(entry, !!user && entry.user_id === user.id)
              )}
            </motion.div>
          ) : null}
          </div>
        </motion.div>
      )}

      {/* Pagination — ghost buttons matching play-page style */}
      {tab === 'players' && !loading && (entries.length > 0 || page > 1) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...springs.slide, delay: 0.22 }}
          className="flex items-center justify-between mt-4 px-1"
        >
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-card bg-bg-base border border-border-default font-sans text-sm text-text-secondary hover:text-text-primary hover:border-border-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
            style={{ outlineColor: 'var(--tile-correct)' }}
          >
            <ChevronLeft size={14} />
            Previous
          </button>

          <span className="font-sans text-xs text-text-ghost font-mono tabular-nums">
            Page {page}
          </span>

          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            className="flex items-center gap-1.5 px-4 py-2 rounded-card bg-bg-base border border-border-default font-sans text-sm text-text-secondary hover:text-text-primary hover:border-border-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
            style={{ outlineColor: 'var(--tile-correct)' }}
          >
            Next
            <ChevronRight size={14} />
          </button>
        </motion.div>
      )}
    </div>
  );
}
