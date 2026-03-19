'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, ChevronLeft, ChevronRight } from 'lucide-react';
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

function TierBadge({ elo }: { elo: number }) {
  const tier = getRatingTier(elo);
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
      style={{ color: tier.color, backgroundColor: `${tier.color}1a` }}
    >
      {tier.name}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-base">🥇</span>;
  if (rank === 2) return <span className="text-base">🥈</span>;
  if (rank === 3) return <span className="text-base">🥉</span>;
  return (
    <span className="text-sm font-mono font-bold text-text-ghost w-6 text-right">
      {rank}
    </span>
  );
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const PER_PAGE = 20;

  useEffect(() => {
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
  }, [page]);


  const renderRow = (entry: LeaderboardEntry, highlight: boolean) => {
    const winRate =
      entry.games_played > 0
        ? Math.round((entry.wins / entry.games_played) * 100)
        : 0;

    return (
      <motion.div
        key={entry.user_id}
        layout
        className={clsx(
          'flex items-center gap-3 px-4 py-3 transition-colors',
          highlight
            ? 'bg-[#538d4e]/10 border-l-2 border-[#538d4e]'
            : 'hover:bg-white/[0.03]'
        )}
      >
        {/* Rank */}
        <div className="w-8 flex items-center justify-end shrink-0">
          <RankBadge rank={entry.rank} />
        </div>

        {/* Username */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span
            className={clsx(
              'text-sm font-semibold truncate',
              highlight ? 'text-[#6aaa64]' : 'text-text-primary'
            )}
          >
            {entry.username}
            {highlight && (
              <span className="ml-1.5 text-[10px] text-text-ghost font-normal">
                (you)
              </span>
            )}
          </span>
          <TierBadge elo={Math.round(entry.elo_rating)} />
        </div>

        {/* ELO */}
        <span
          className="text-sm font-mono font-bold w-14 text-right shrink-0"
          style={{ color: getRatingTier(entry.elo_rating).color }}
        >
          {Math.round(entry.elo_rating)}
        </span>

        {/* Games */}
        <span className="text-xs font-mono text-text-secondary w-12 text-right shrink-0">
          {entry.games_played}
        </span>

        {/* Win rate */}
        <span className="text-xs font-mono text-text-secondary w-10 text-right shrink-0">
          {winRate}%
        </span>
      </motion.div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.slide}
        className="flex items-center gap-3 mb-8"
      >
        <div className="w-9 h-9 rounded-xl bg-[#c9a227]/10 flex items-center justify-center">
          <Trophy size={18} className="text-[#c9a227]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Leaderboard</h1>
          <p className="text-xs text-text-secondary">Top players ranked by ELO rating</p>
        </div>
      </motion.div>

      {/* Global leaderboard */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.slide, delay: 0.2 }}
      >
        <h2 className="text-xs font-semibold text-text-ghost uppercase tracking-wider mb-2 px-1">
          Global Rankings
        </h2>
        <div className="rounded-2xl bg-bg-secondary border border-white/[0.08] overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-3 px-4 py-2 text-[10px] text-text-ghost uppercase tracking-wider border-b border-white/[0.06]">
            <span className="w-8 text-right">#</span>
            <span className="flex-1">Player</span>
            <span className="w-14 text-right">ELO</span>
            <span className="w-12 text-right">Games</span>
            <span className="w-10 text-right">W%</span>
          </div>

          {loading ? (
            <div className="flex flex-col divide-y divide-white/[0.06]">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="skeleton h-4 w-6 rounded" />
                  <div className="skeleton h-4 w-32 rounded" />
                  <div className="skeleton h-4 w-12 rounded ml-auto" />
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-text-secondary">No players yet. Be the first!</p>
            </div>
          ) : (
            <motion.div
              className="divide-y divide-white/[0.06]"
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: stagger.fast } }}
            >
              {entries.map((entry) =>
                renderRow(entry, !!user && entry.user_id === user.id)
              )}
            </motion.div>
          )}
        </div>

        {/* Pagination */}
        {!loading && (entries.length > 0 || page > 1) && (
          <div className="flex items-center justify-between mt-4 px-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-bg-secondary border border-white/[0.08] text-sm text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
              Previous
            </button>
            <span className="text-xs text-text-ghost font-mono">
              Page {page}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-bg-secondary border border-white/[0.08] text-sm text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
