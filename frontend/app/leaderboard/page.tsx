'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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

// ─── Rank badge ──────────────────────────────────────────────────────────────

const MEDAL_COLORS: Record<number, string> = {
  1: '#c9a227',
  2: '#9aa0a6',
  3: '#9e5c2d',
};

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white shrink-0"
        style={{ backgroundColor: MEDAL_COLORS[rank] }}
        aria-label={`Rank ${rank}`}
      >
        {rank}
      </span>
    );
  }
  return (
    <span
      className="font-mono text-sm font-bold text-[#5c5c66] w-7 text-right tabular-nums"
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0"
    >
      <div className="w-7 h-7 rounded-full bg-white/[0.06] shrink-0 animate-pulse" />
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <div className="h-3.5 w-28 rounded bg-white/[0.06] animate-pulse" />
        <div className="h-3 w-14 rounded-full bg-white/[0.04] animate-pulse" />
      </div>
      <div className="h-3.5 w-10 rounded bg-white/[0.06] animate-pulse ml-auto" />
      <div className="h-3 w-8 rounded bg-white/[0.04] animate-pulse" />
      <div className="h-3 w-7 rounded bg-white/[0.04] animate-pulse" />
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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

  const rowVariants = {
    hidden: { opacity: 0, y: 6 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
  };

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
          'flex items-center gap-3 px-4 py-[11px] border-b border-white/[0.04] last:border-0 transition-colors duration-150',
          isCurrentUser
            ? 'bg-[#538d4e]/[0.07] border-l-2 border-[#538d4e]'
            : 'hover:bg-white/[0.02]'
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
              'text-sm font-semibold truncate',
              isCurrentUser ? 'text-[#6aaa64]' : 'text-[#ededf0]'
            )}
          >
            {entry.username}
          </span>
          {isCurrentUser && (
            <span className="text-[10px] text-[#5c5c66] font-normal shrink-0">
              (you)
            </span>
          )}
        </div>

        {/* ELO */}
        <span
          className="text-sm font-mono font-bold w-14 text-right shrink-0 tabular-nums"
          style={{ color: tierColor }}
        >
          {Math.round(entry.elo_rating)}
        </span>

        {/* Games */}
        <span className="text-xs font-mono text-[#9898a0] w-12 text-right shrink-0 tabular-nums">
          {entry.games_played}
        </span>

        {/* Win rate */}
        <span className="text-xs font-mono text-[#9898a0] w-10 text-right shrink-0 tabular-nums">
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
        className="text-2xl font-bold text-[#ededf0] mb-1"
      >
        Leaderboard
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...springs.slide, delay: 0.08 }}
        className="text-sm text-[#9898a0] mb-7"
      >
        Top players ranked by ELO rating
      </motion.p>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.slide, delay: 0.14 }}
        className="bg-[#171719] border border-white/[0.06] rounded-[12px] overflow-hidden"
      >
        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06]">
          <span className="w-7 text-right text-[10px] font-semibold text-[#5c5c66] uppercase tracking-wider shrink-0">
            #
          </span>
          <span className="flex-1 text-[10px] font-semibold text-[#5c5c66] uppercase tracking-wider">
            Player
          </span>
          <span className="w-14 text-right text-[10px] font-semibold text-[#5c5c66] uppercase tracking-wider shrink-0">
            ELO
          </span>
          <span className="w-12 text-right text-[10px] font-semibold text-[#5c5c66] uppercase tracking-wider shrink-0">
            Games
          </span>
          <span className="w-10 text-right text-[10px] font-semibold text-[#5c5c66] uppercase tracking-wider shrink-0">
            W%
          </span>
        </div>

        {/* Body */}
        {loading ? (
          <div>
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonRow key={i} index={i} />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[#9898a0]">No players yet. Be the first!</p>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: stagger.fast } }}
          >
            {entries.map((entry) =>
              renderRow(entry, !!user && entry.user_id === user.id)
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Pagination */}
      {!loading && (entries.length > 0 || page > 1) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...springs.slide, delay: 0.22 }}
          className="flex items-center justify-between mt-4 px-1"
        >
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#171719] border border-white/[0.06] text-sm text-[#9898a0] hover:text-[#ededf0] hover:border-white/[0.10] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
          >
            <ChevronLeft size={14} />
            Previous
          </button>

          <span className="text-xs text-[#5c5c66] font-mono tabular-nums">
            Page {page}
          </span>

          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#171719] border border-white/[0.06] text-sm text-[#9898a0] hover:text-[#ededf0] hover:border-white/[0.10] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
          >
            Next
            <ChevronRight size={14} />
          </button>
        </motion.div>
      )}
    </div>
  );
}
