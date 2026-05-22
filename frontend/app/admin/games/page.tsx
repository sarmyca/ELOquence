'use client';
import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Search, X, ChevronLeft, ChevronRight, ExternalLink, Calendar, Trophy, Gamepad2, TrendingUp } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi } from '@/lib/api';
import AdminNav from '@/components/admin/AdminNav';

interface AdminGame {
  id: string;
  user_id: string | null;
  username: string | null;
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

interface UserSearchResult {
  id: string;
  username: string;
}

const MODE_OPTIONS = ['', 'daily', 'competitive', 'practice', 'challenge'];
const STATUS_OPTIONS = ['', 'in_progress', 'won', 'lost', 'abandoned'];

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
    <span className="inline-flex items-center px-1.5 py-0.5 rounded font-sans text-[10px] font-semibold capitalize" style={{ backgroundColor: bg, color }}>
      {status.replace('_', ' ')}
    </span>
  );
}

function EloDelta({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-text-tertiary font-mono tabular-nums">—</span>;
  const color = delta > 0 ? 'var(--tile-correct)' : delta < 0 ? 'var(--red)' : 'var(--text-tertiary)';
  return <span className="font-mono tabular-nums font-semibold" style={{ color, fontSize: 12 }}>{delta > 0 ? '+' : ''}{delta}</span>;
}

const PER_PAGE = 50;

function AdminGamesPageInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filters from URL
  const [userSearch, setUserSearch] = useState(searchParams.get('username') ?? '');
  const [userId, setUserId] = useState(searchParams.get('user_id') ?? '');
  const [mode, setMode] = useState(searchParams.get('mode') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') ?? '');
  const [dateTo, setDateTo] = useState(searchParams.get('to') ?? '');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1'));

  const [games, setGames] = useState<AdminGame[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const [userSuggestions, setUserSuggestions] = useState<UserSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const userDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushParams = useCallback((overrides: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { user_id: userId, mode, status, from: dateFrom, to: dateTo, page, username: userSearch, ...overrides };
    if (merged.user_id) p.set('user_id', String(merged.user_id));
    if (merged.username) p.set('username', String(merged.username));
    if (merged.mode) p.set('mode', String(merged.mode));
    if (merged.status) p.set('status', String(merged.status));
    if (merged.from) p.set('from', String(merged.from));
    if (merged.to) p.set('to', String(merged.to));
    if (merged.page && Number(merged.page) > 1) p.set('page', String(merged.page));
    router.push(`/admin/games?${p.toString()}`);
  }, [userId, mode, status, dateFrom, dateTo, page, userSearch, router]);

  const fetchGames = useCallback((params: {
    page?: number; user_id?: string; mode?: string; status?: string; from?: string; to?: string;
  }) => {
    setFetching(true);
    adminApi.games({
      page: params.page ?? 1,
      per_page: PER_PAGE,
      user_id: params.user_id || undefined,
      mode: params.mode || undefined,
      status: params.status || undefined,
      from: params.from || undefined,
      to: params.to || undefined,
    })
      .then((res: { data: GamesResponse }) => {
        setGames(res.data.games);
        setTotal(res.data.total);
      })
      .catch(() => setError('Failed to load games.'))
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      router.replace('/play');
      return;
    }
    fetchGames({ page, user_id: userId, mode, status, from: dateFrom, to: dateTo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router]);

  const handleUserSearch = (val: string) => {
    setUserSearch(val);
    setUserId('');
    if (userDebounce.current) clearTimeout(userDebounce.current);
    if (!val.trim()) {
      setUserSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    userDebounce.current = setTimeout(() => {
      adminApi.users({ search: val, per_page: 5 } as Parameters<typeof adminApi.users>[0])
        .then((res: { data: { users: UserSearchResult[] } }) => {
          setUserSuggestions(res.data.users ?? []);
          setShowSuggestions(true);
        })
        .catch(() => {});
    }, 350);
  };

  const selectUser = (u: UserSearchResult) => {
    setUserSearch(u.username);
    setUserId(u.id);
    setShowSuggestions(false);
    const newPage = 1;
    setPage(newPage);
    fetchGames({ page: newPage, user_id: u.id, mode, status, from: dateFrom, to: dateTo });
    pushParams({ user_id: u.id, username: u.username, page: newPage });
  };

  const applyFilters = (overrides: Partial<{ mode: string; status: string; from: string; to: string; page: number }> = {}) => {
    const newMode = overrides.mode ?? mode;
    const newStatus = overrides.status ?? status;
    const newFrom = overrides.from ?? dateFrom;
    const newTo = overrides.to ?? dateTo;
    const newPage = overrides.page ?? 1;
    setPage(newPage);
    fetchGames({ page: newPage, user_id: userId, mode: newMode, status: newStatus, from: newFrom, to: newTo });
    pushParams({ mode: newMode, status: newStatus, from: newFrom, to: newTo, page: newPage, user_id: userId, username: userSearch });
  };

  const clearFilters = () => {
    setUserSearch('');
    setUserId('');
    setMode('');
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    fetchGames({ page: 1 });
    router.push('/admin/games');
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user?.is_admin) return null;

  const hasFilters = !!(userId || mode || status || dateFrom || dateTo);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/admin" className="font-sans text-text-secondary hover:text-text-primary text-sm transition-colors">Admin</Link>
          <span className="text-text-tertiary text-sm">/</span>
          <span className="font-sans text-sm text-text-primary">Games</span>
        </div>
        <h1 className="font-display font-black text-3xl text-text-primary">Admin · Games</h1>
        <p className="font-sans text-text-secondary mt-0.5">{total.toLocaleString()} games total</p>
      </motion.div>

      <AdminNav />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-card border text-sm flex items-center justify-between" style={{ background: 'rgba(231,76,60,0.08)', borderColor: 'rgba(231,76,60,0.25)', color: 'var(--red)' }}>
          <span>{error}</span>
          <button className="ml-2 underline text-xs" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-bg-base border border-border-default rounded-card-lg p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* User search */}
          <div className="relative flex-1 min-w-[160px]">
            <label className="block text-xs uppercase tracking-wider text-text-secondary font-semibold font-sans mb-1">User</label>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => handleUserSearch(e.target.value)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Search username..."
                className="w-full pl-7 pr-8 bg-transparent border-2 border-border-default rounded-md py-1.5 focus:border-tile-correct outline-none text-text-primary font-sans text-sm placeholder:text-text-tertiary transition-colors"
              />
              {userSearch && (
                <button onClick={() => { setUserSearch(''); setUserId(''); setShowSuggestions(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary">
                  <X size={12} />
                </button>
              )}
            </div>
            {showSuggestions && userSuggestions.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-bg-base border border-border-default rounded-md shadow-lg overflow-hidden">
                {userSuggestions.map((u) => (
                  <button
                    key={u.id}
                    className="w-full text-left px-3 py-2 font-sans text-sm text-text-primary hover:bg-bg-elevated transition-colors"
                    onMouseDown={() => selectUser(u)}
                  >
                    {u.username}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mode */}
          <div className="min-w-[130px]">
            <label className="block text-xs uppercase tracking-wider text-text-secondary font-semibold font-sans mb-1">Mode</label>
            <select
              value={mode}
              onChange={(e) => { setMode(e.target.value); applyFilters({ mode: e.target.value }); }}
              className="w-full bg-bg-base border-2 border-border-default rounded-md px-2 py-1.5 font-sans text-sm text-text-primary outline-none focus:border-tile-correct transition-colors"
            >
              {MODE_OPTIONS.map((m) => (
                <option key={m} value={m}>{m ? m.charAt(0).toUpperCase() + m.slice(1) : 'All Modes'}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="min-w-[130px]">
            <label className="block text-xs uppercase tracking-wider text-text-secondary font-semibold font-sans mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); applyFilters({ status: e.target.value }); }}
              className="w-full bg-bg-base border-2 border-border-default rounded-md px-2 py-1.5 font-sans text-sm text-text-primary outline-none focus:border-tile-correct transition-colors"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s ? s.replace('_', ' ') : 'All Statuses'}</option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div className="min-w-[130px]">
            <label className="block text-xs uppercase tracking-wider text-text-secondary font-semibold font-sans mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); applyFilters({ from: e.target.value }); }}
              className="w-full bg-bg-base border-2 border-border-default rounded-md px-2 py-1.5 font-sans text-sm text-text-primary outline-none focus:border-tile-correct transition-colors"
            />
          </div>

          {/* Date to */}
          <div className="min-w-[130px]">
            <label className="block text-xs uppercase tracking-wider text-text-secondary font-semibold font-sans mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); applyFilters({ to: e.target.value }); }}
              className="w-full bg-bg-base border-2 border-border-default rounded-md px-2 py-1.5 font-sans text-sm text-text-primary outline-none focus:border-tile-correct transition-colors"
            />
          </div>

          {/* Clear */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border-2 border-border-default font-sans text-sm text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors"
            >
              <X size={12} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-base border border-border-default rounded-card-lg overflow-hidden">
        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }} />
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-16 text-text-secondary font-sans text-sm">No games found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b-2 border-border-default">
                  <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold">User</th>
                  <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold">Mode</th>
                  <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold hidden sm:table-cell">Word</th>
                  <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold">Status</th>
                  <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold">ELO</th>
                  <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold hidden sm:table-cell">Guesses</th>
                  <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold hidden md:table-cell">Date</th>
                  <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => {
                  const ModeIcon = MODE_ICONS[g.mode] ?? Gamepad2;
                  return (
                    <tr key={g.id} className="border-b border-border-subtle hover:bg-bg-elevated/50 transition-colors">
                      <td className="px-4 py-3">
                        {g.user_id ? (
                          <Link href={`/admin/users/${g.user_id}`} className="font-medium text-text-primary hover:underline hover:text-tile-correct transition-colors text-xs">
                            {g.username ?? g.user_id.slice(0, 8)}
                          </Link>
                        ) : (
                          <span className="text-text-tertiary text-xs">Guest</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <ModeIcon size={12} className="text-text-tertiary" />
                          <span className="text-text-secondary capitalize text-xs">{g.mode}</span>
                          {g.is_placement && <span className="text-[9px] font-semibold px-1 rounded" style={{ background: 'rgba(201,162,39,0.12)', color: 'var(--gold)' }}>P</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="font-mono font-semibold tracking-widest text-text-primary text-xs uppercase">{g.target_word}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={g.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <EloDelta delta={g.elo_delta} />
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary tabular-nums text-xs hidden sm:table-cell">
                        {g.num_guesses > 0 ? g.num_guesses : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-text-tertiary text-xs hidden md:table-cell">
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
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-text-secondary font-sans">
          <span>Page {page} of {totalPages} ({total.toLocaleString()} total)</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { const p = Math.max(1, page - 1); setPage(p); applyFilters({ page: p }); }}
              disabled={page === 1}
              className="p-1.5 rounded-md border-2 border-border-default hover:border-border-strong disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); applyFilters({ page: p }); }}
              disabled={page === totalPages}
              className="p-1.5 rounded-md border-2 border-border-default hover:border-border-strong disabled:opacity-40 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrapping the page in Suspense is required by Next.js 14 App Router whenever
// a client component reads useSearchParams() — without it the page is opted
// out of static prerendering and may flash blank in production.
export default function AdminGamesPage() {
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
      <AdminGamesPageInner />
    </Suspense>
  );
}
