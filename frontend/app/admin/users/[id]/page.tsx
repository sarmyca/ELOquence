'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Gamepad2,
  Calendar,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { getRatingTier, EloHistoryEntry, patternToTiles } from '@/lib/types';
import EloSparkline from '@/components/EloSparkline';
import DonutChart from '@/components/admin/DonutChart';
import AdminNav from '@/components/admin/AdminNav';

interface AdminUser {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  elo_rating: number;
  games_played: number;
  total_wins: number;
  total_losses: number;
  is_placement: boolean;
  is_admin: boolean;
  provider: string | null;
  current_streak: number;
  max_streak: number;
  last_played_date: string | null;
  created_at: string;
}

interface UserProfile {
  total_games: number;
  total_wins: number;
  avg_accuracy: number | null;
}

interface UserDetail {
  user: AdminUser;
  profile: UserProfile | null;
  elo_history: EloHistoryEntry[];
  recent_games_count: { won: number; lost: number; abandoned: number };
  games_by_mode: { daily: number; competitive: number; practice: number; challenge: number };
}

interface AdminGame {
  id: string;
  mode: string;
  status: string;
  target_word: string;
  num_guesses: number;
  elo_before: number | null;
  elo_after: number | null;
  elo_delta: number | null;
  accuracy_score: number | null;
  rated: boolean;
  is_placement: boolean;
  hard_mode: boolean;
  created_at: string;
  completed_at: string | null;
}

interface GamesResponse {
  games: AdminGame[];
  total: number;
  page: number;
  per_page: number;
}

const MODE_ICONS: Record<string, React.ElementType> = {
  daily: Calendar,
  competitive: Trophy,
  practice: Gamepad2,
  challenge: TrendingUp,
};

function StatusBadge({ status }: { status: string }) {
  let bg = 'var(--bg-elevated)';
  let color = 'var(--text-secondary)';
  if (status === 'won') { bg = 'rgba(106,170,100,0.12)'; color = 'var(--tile-correct)'; }
  else if (status === 'lost') { bg = 'rgba(231,76,60,0.10)'; color = 'var(--red)'; }
  else if (status === 'abandoned') { bg = 'rgba(150,150,150,0.10)'; color = 'var(--text-tertiary)'; }
  else if (status === 'in_progress') { bg = 'rgba(201,162,39,0.10)'; color = 'var(--gold)'; }
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded font-sans text-[10px] font-semibold capitalize"
      style={{ backgroundColor: bg, color }}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

function EloDelta({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-text-tertiary font-mono tabular-nums">—</span>;
  const color = delta > 0 ? 'var(--tile-correct)' : delta < 0 ? 'var(--red)' : 'var(--text-tertiary)';
  return (
    <span className="font-mono tabular-nums font-semibold" style={{ color, fontSize: 12 }}>
      {delta > 0 ? '+' : ''}{delta}
    </span>
  );
}

function TileMini({ state }: { state: 'correct' | 'present' | 'absent' }) {
  const colors = { correct: 'var(--tile-correct)', present: 'var(--tile-present)', absent: 'var(--tile-absent)' };
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 1, backgroundColor: colors[state], flexShrink: 0 }} />;
}

function WordTiles({ word, pattern }: { word: string; pattern?: number }) {
  if (!pattern) {
    return <span className="font-mono font-semibold tracking-widest text-text-primary text-xs uppercase">{word}</span>;
  }
  const tiles = patternToTiles(pattern);
  return (
    <span className="inline-flex items-center gap-0.5">
      {word.split('').map((ch, i) => (
        <span
          key={i}
          className="inline-flex items-center justify-center font-mono font-bold uppercase"
          style={{
            width: 16,
            height: 16,
            fontSize: 9,
            borderRadius: 2,
            backgroundColor: tiles[i] === 'correct' ? 'var(--tile-correct)' : tiles[i] === 'present' ? 'var(--tile-present)' : 'var(--tile-absent)',
            color: '#fff',
          }}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

export default function AdminUserDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const userId = params.id;

  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [games, setGames] = useState<AdminGame[]>([]);
  const [gamesTotal, setGamesTotal] = useState(0);
  const [gamesPage, setGamesPage] = useState(1);
  const [fetching, setFetching] = useState(true);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmAdmin, setConfirmAdmin] = useState(false);

  const PER_PAGE = 20;

  const fetchDetail = useCallback(() => {
    adminApi.user(userId)
      .then((res) => setDetail(res.data))
      .catch(() => setError('Failed to load user.'))
      .finally(() => setFetching(false));
  }, [userId]);

  const fetchGames = useCallback((page: number) => {
    setGamesLoading(true);
    adminApi.userGames(userId, { page, per_page: PER_PAGE })
      .then((res: { data: GamesResponse }) => {
        setGames(res.data.games);
        setGamesTotal(res.data.total);
      })
      .catch(() => {})
      .finally(() => setGamesLoading(false));
  }, [userId]);

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      router.replace('/play');
      return;
    }
    fetchDetail();
    fetchGames(1);
  }, [user, loading, router, fetchDetail, fetchGames]);

  const handleResetElo = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setActionLoading('reset');
    setConfirmReset(false);
    try {
      await adminApi.resetElo(userId);
      fetchDetail();
    } catch {
      setError('Failed to reset ELO.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAdmin = async () => {
    if (!confirmAdmin) {
      setConfirmAdmin(true);
      return;
    }
    setActionLoading('admin');
    setConfirmAdmin(false);
    try {
      await adminApi.toggleAdmin(userId);
      fetchDetail();
    } catch {
      setError('Failed to toggle admin.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user?.is_admin) return null;
  if (!detail) return null;

  const { user: u, profile, elo_history, recent_games_count, games_by_mode } = detail;
  const tier = getRatingTier(u.elo_rating);

  // ELO delta vs the oldest entry in our history window. Backend returns
  // entries newest-first, so the oldest is at the tail.
  const eloNow = u.elo_rating;
  const elo30dAgo = elo_history.length > 0
    ? elo_history[elo_history.length - 1].elo_before
    : eloNow;
  const eloDelta30d = eloNow - elo30dAgo;

  // Win rate last 30 days
  const totalRecent = recent_games_count.won + recent_games_count.lost + recent_games_count.abandoned;
  const recentWinRate = totalRecent > 0 ? ((recent_games_count.won / totalRecent) * 100).toFixed(0) : '—';

  // Mode donut
  const modeSegs = [
    { key: 'daily', label: 'Daily', value: games_by_mode.daily, color: 'var(--tile-correct)' },
    { key: 'competitive', label: 'Competitive', value: games_by_mode.competitive, color: '#1565c0' },
    { key: 'practice', label: 'Practice', value: games_by_mode.practice, color: 'var(--gold)' },
    { key: 'challenge', label: 'Challenge', value: games_by_mode.challenge, color: '#9c27b0' },
  ].filter((s) => s.value > 0);

  // Recent outcome donut
  const outcomeSegs = [
    { key: 'won', label: 'Won', value: recent_games_count.won, color: 'var(--tile-correct)' },
    { key: 'lost', label: 'Lost', value: recent_games_count.lost, color: 'var(--red)' },
    { key: 'abandoned', label: 'Abandoned', value: recent_games_count.abandoned, color: 'var(--text-tertiary)' },
  ].filter((s) => s.value > 0);

  const totalPages = Math.ceil(gamesTotal / PER_PAGE);
  const isSelf = user.id === u.id;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/admin" className="font-sans text-text-secondary hover:text-text-primary text-sm transition-colors">Admin</Link>
          <span className="text-text-tertiary text-sm">/</span>
          <Link href="/admin/users" className="font-sans text-text-secondary hover:text-text-primary text-sm transition-colors">Users</Link>
          <span className="text-text-tertiary text-sm">/</span>
          <span className="font-sans text-sm text-text-primary">{u.username}</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display font-black text-3xl text-text-primary">{u.username}</h1>
          {u.provider === 'google' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-sans" style={{ background: 'rgba(66,133,244,0.12)', color: '#4285f4' }}>
              Google
            </span>
          )}
          {u.is_admin && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-sans" style={{ background: 'rgba(201,162,39,0.12)', color: 'var(--gold)' }}>
              <ShieldCheck size={10} />
              Admin
            </span>
          )}
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-sans" style={{ background: `color-mix(in srgb, ${tier.color} 12%, transparent)`, color: tier.color }}>
            {tier.name}
          </span>
        </div>
        <p className="font-sans text-text-secondary text-sm mt-1">{u.email}</p>
      </motion.div>

      <AdminNav />

      {error && (
        <div role="alert" aria-live="assertive" className="mb-4 px-4 py-3 rounded-card border text-sm flex items-center justify-between" style={{ background: 'rgba(231,76,60,0.08)', borderColor: 'rgba(231,76,60,0.25)', color: 'var(--red)' }}>
          <span>{error}</span>
          <button className="ml-2 underline text-xs" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* 3 stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {[
          {
            label: 'ELO Rating',
            value: Math.round(u.elo_rating).toLocaleString(),
            sub: eloDelta30d !== 0 ? `${eloDelta30d > 0 ? '+' : ''}${eloDelta30d} vs 30d ago` : 'No change in 30d',
            color: eloDelta30d > 0 ? 'var(--tile-correct)' : eloDelta30d < 0 ? 'var(--red)' : 'var(--text-tertiary)',
          },
          {
            label: 'Games Played',
            value: u.games_played.toLocaleString(),
            sub: `${(profile?.total_wins ?? 0).toLocaleString()} wins lifetime`,
            color: 'var(--text-secondary)',
          },
          {
            label: 'Win Rate (30d)',
            value: recentWinRate === '—' ? '—' : `${recentWinRate}%`,
            sub: `${totalRecent} games in period`,
            color: 'var(--text-secondary)',
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.06, type: 'spring', damping: 22, stiffness: 350 }}
            className="bg-bg-base border border-border-default rounded-card-lg px-4 py-4"
          >
            <span className="text-xs uppercase tracking-wider text-text-secondary font-semibold font-sans block mb-2">{card.label}</span>
            <span className="font-display text-2xl font-bold text-text-primary tabular-nums block mb-1">{card.value}</span>
            <span className="font-sans text-xs" style={{ color: card.color }}>{card.sub}</span>
          </motion.div>
        ))}
      </div>

      {/* ELO history */}
      {elo_history.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.3 }} className="bg-bg-base border border-border-default rounded-card-lg p-5 mb-6">
          <h2 className="font-display font-bold text-text-primary mb-4">Rating history</h2>
          <EloSparkline data={elo_history} height={180} />
        </motion.div>
      )}

      {/* Two side-by-side panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.3 }} className="bg-bg-base border border-border-default rounded-card-lg p-5">
          <h2 className="font-display font-bold text-text-primary mb-4">Games by Mode</h2>
          <DonutChart segments={modeSegs} size={130} ariaLabel="Games by mode" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.3 }} className="bg-bg-base border border-border-default rounded-card-lg p-5">
          <h2 className="font-display font-bold text-text-primary mb-1">Recent Outcomes</h2>
          <p className="font-sans text-xs text-text-tertiary mb-3">Last 30 days</p>
          <DonutChart segments={outcomeSegs} size={130} ariaLabel="Recent outcomes" />
        </motion.div>
      </div>

      {/* Admin actions */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.3 }} className="bg-bg-base border border-border-default rounded-card-lg p-5 mb-6">
        <h2 className="font-display font-bold text-text-primary mb-4">Admin Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleResetElo}
            disabled={actionLoading === 'reset'}
            className="px-3 py-1.5 rounded-md border-2 font-sans text-sm transition-colors"
            style={
              confirmReset
                ? { borderColor: 'var(--red)', color: 'var(--red)' }
                : { borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }
            }
          >
            {actionLoading === 'reset' ? (
              <RefreshCw size={12} className="animate-spin inline" />
            ) : confirmReset ? (
              'Confirm Reset ELO?'
            ) : (
              'Reset ELO'
            )}
          </button>

          <button
            onClick={handleToggleAdmin}
            disabled={actionLoading === 'admin' || isSelf}
            className="px-3 py-1.5 rounded-md border-2 font-sans text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={
              confirmAdmin
                ? { borderColor: 'var(--red)', color: 'var(--red)' }
                : { borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }
            }
            title={isSelf ? 'Cannot change your own admin role' : undefined}
          >
            {actionLoading === 'admin' ? (
              <RefreshCw size={12} className="animate-spin inline" />
            ) : confirmAdmin ? (
              u.is_admin ? 'Confirm Demote?' : 'Confirm Make Admin?'
            ) : u.is_admin ? (
              'Demote Admin'
            ) : (
              'Make Admin'
            )}
          </button>
        </div>
        {isSelf && (
          <p className="font-sans text-xs text-text-tertiary mt-2">You cannot change your own admin role.</p>
        )}
      </motion.div>

      {/* Recent games table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.3 }} className="bg-bg-base border border-border-default rounded-card-lg overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-border-default flex items-center justify-between">
          <h2 className="font-sans font-semibold text-text-primary text-sm">Recent Games</h2>
          <span className="font-sans text-xs text-text-secondary">{gamesTotal.toLocaleString()} total</span>
        </div>

        {gamesLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }} />
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-10 text-text-secondary font-sans text-sm">No games found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b-2 border-border-default">
                  <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold">Mode</th>
                  <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold">Word</th>
                  <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold">Status</th>
                  <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold">ELO</th>
                  <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold hidden sm:table-cell">Date</th>
                  <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => {
                  const ModeIcon = MODE_ICONS[g.mode] ?? Gamepad2;
                  return (
                    <tr key={g.id} className="border-b border-border-subtle hover:bg-bg-elevated/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <ModeIcon size={12} className="text-text-tertiary" />
                          <span className="text-text-secondary capitalize text-xs">{g.mode}</span>
                          {g.is_placement && (
                            <span className="text-[9px] font-semibold px-1 rounded" style={{ background: 'rgba(201,162,39,0.12)', color: 'var(--gold)' }}>P</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold tracking-widest text-text-primary text-xs uppercase">{g.target_word}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={g.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <EloDelta delta={g.elo_delta} />
                      </td>
                      <td className="px-4 py-3 text-right text-text-tertiary text-xs hidden sm:table-cell">
                        {new Date(g.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/games/${g.id}`} className="text-text-tertiary hover:text-text-primary transition-colors">
                          <ExternalLink size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-text-secondary font-sans">
          <span>Page {gamesPage} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { const p = Math.max(1, gamesPage - 1); setGamesPage(p); fetchGames(p); }}
              disabled={gamesPage === 1}
              className="px-3 py-1.5 rounded-md border-2 border-border-default hover:border-border-strong disabled:opacity-40 transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => { const p = Math.min(totalPages, gamesPage + 1); setGamesPage(p); fetchGames(p); }}
              disabled={gamesPage === totalPages}
              className="px-3 py-1.5 rounded-md border-2 border-border-default hover:border-border-strong disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
