'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Users,
  FileText,
  Megaphone,
  BarChart3,
  TrendingUp,
  Target,
  Calendar,
  Gamepad2,
  Activity,
  Shield,
  Heart,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { stagger } from '@/lib/animations';
import StatCardLg from '@/components/admin/StatCardLg';
import TimeSeriesChart from '@/components/admin/TimeSeriesChart';
import Histogram from '@/components/admin/Histogram';
import DonutChart from '@/components/admin/DonutChart';
import AdminNav from '@/components/admin/AdminNav';

interface Analytics {
  total_users: number;
  total_games: number;
  games_today: number;
  games_this_week: number;
  new_users_today: number;
  new_users_week: number;
  active_games: number;
  avg_accuracy: number;
  avg_guesses: number;
  win_rate: number;
  dau: number;
  wau: number;
}

interface TimeseriesEntry {
  date: string;
  signups: number;
  games_total: number;
  games_daily: number;
  games_competitive: number;
  games_practice: number;
  games_challenge: number;
  active_users: number;
  avg_accuracy: number | null;
  wins: number;
  losses: number;
}

interface Distributions {
  elo_buckets: Array<{ min: number; max: number; count: number }>;
  mode_distribution: { daily: number; competitive: number; practice: number; challenge: number };
  outcome_distribution: { won: number; lost: number; abandoned: number; in_progress: number };
  guesses_to_win: Record<string, number>;
}

function SmallStatCard({ label, value, icon: Icon, index }: { label: string; value: string | number; icon: React.ElementType; index: number }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { type: 'spring', damping: 22, stiffness: 350, delay: index * 0.05 },
        },
      }}
      className="bg-bg-base border border-border-default rounded-card-lg px-4 py-4 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-text-secondary" />
        <span className="text-xs uppercase tracking-wider text-text-secondary font-semibold font-sans">
          {label}
        </span>
      </div>
      <span className="font-display text-2xl font-bold text-text-primary tabular-nums">{value}</span>
    </motion.div>
  );
}

type TimeseriesTab = 'games' | 'users' | 'quality';

const RANGE_OPTIONS = [7, 30, 90] as const;
type Range = typeof RANGE_OPTIONS[number];

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesEntry[]>([]);
  const [distributions, setDistributions] = useState<Distributions | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const [tsTab, setTsTab] = useState<TimeseriesTab>('games');
  const [tsRange, setTsRange] = useState<Range>(30);
  const [tsLoading, setTsLoading] = useState(false);

  const fetchTimeseries = useCallback((days: Range) => {
    setTsLoading(true);
    adminApi.timeseries(days)
      .then((res) => setTimeseries(res.data.series ?? []))
      .catch(() => {})
      .finally(() => setTsLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      router.replace('/play');
      return;
    }
    Promise.all([
      adminApi.analytics(),
      adminApi.timeseries(30),
      adminApi.distributions(),
    ])
      .then(([analyticsRes, tsRes, distRes]) => {
        setAnalytics(analyticsRes.data);
        setTimeseries(tsRes.data.series ?? []);
        setDistributions(distRes.data);
      })
      .catch(() => setError('Failed to load analytics.'))
      .finally(() => setFetching(false));
  }, [user, loading, router]);

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (!user?.is_admin) return null;

  // Sparkline: last 14 days signups
  const last14Signups = timeseries.slice(-14).map((d) => d.signups);
  const last14DAU = timeseries.slice(-14).map((d) => d.active_users);

  // DAU trend vs 7 days ago
  const dauNow = analytics?.dau ?? 0;
  const dauPrev = timeseries.length >= 8 ? timeseries[timeseries.length - 8]?.active_users ?? dauNow : dauNow;
  const dauTrendVal = dauPrev > 0 ? ((dauNow - dauPrev) / dauPrev) * 100 : 0;

  // Users trend (new_users_today vs yesterday)
  const signupsToday = timeseries.length >= 1 ? (timeseries[timeseries.length - 1]?.signups ?? 0) : 0;
  const signupsYesterday = timeseries.length >= 2 ? (timeseries[timeseries.length - 2]?.signups ?? signupsToday) : signupsToday;
  const signupsTrendVal = signupsYesterday > 0 ? ((signupsToday - signupsYesterday) / signupsYesterday) * 100 : 0;

  // ELO buckets for histogram
  const eloBuckets = (distributions?.elo_buckets ?? []).map((b) => ({
    label: `${b.min}`,
    count: b.count,
  }));

  // Mode distribution for donut
  const modeSegs = distributions
    ? [
        { key: 'daily', label: 'Daily', value: distributions.mode_distribution.daily, color: 'var(--tile-correct)' },
        { key: 'competitive', label: 'Competitive', value: distributions.mode_distribution.competitive, color: '#1565c0' },
        { key: 'practice', label: 'Practice', value: distributions.mode_distribution.practice, color: 'var(--gold)' },
        { key: 'challenge', label: 'Challenge', value: distributions.mode_distribution.challenge, color: '#9c27b0' },
      ]
    : [];

  const outcomeSegs = distributions
    ? [
        { key: 'won', label: 'Won', value: distributions.outcome_distribution.won, color: 'var(--tile-correct)' },
        { key: 'lost', label: 'Lost', value: distributions.outcome_distribution.lost, color: 'var(--red)' },
        { key: 'abandoned', label: 'Abandoned', value: distributions.outcome_distribution.abandoned, color: 'var(--text-tertiary)' },
        { key: 'in_progress', label: 'In Progress', value: distributions.outcome_distribution.in_progress, color: 'var(--gold)' },
      ]
    : [];

  // Timeseries series defs based on tab
  const tsSeries: Array<{ key: string; label: string; color: string }> = tsTab === 'games'
    ? [
        { key: 'games_daily', label: 'Daily', color: 'var(--tile-correct)' },
        { key: 'games_competitive', label: 'Competitive', color: '#1565c0' },
        { key: 'games_practice', label: 'Practice', color: 'var(--gold)' },
      ]
    : tsTab === 'users'
    ? [
        { key: 'signups', label: 'New Users', color: 'var(--tile-correct)' },
        { key: 'active_users', label: 'DAU', color: '#1565c0' },
      ]
    : [
        { key: 'avg_accuracy', label: 'Avg Accuracy', color: 'var(--tile-correct)' },
      ];

  const subPages = [
    { href: '/admin/users', label: 'User Management', description: 'Search, reset ELO, manage admins', icon: Users },
    { href: '/admin/words', label: 'Daily Words', description: 'Schedule upcoming daily words', icon: FileText },
    { href: '/admin/announcements', label: 'Announcements', description: 'Post and manage banners', icon: Megaphone },
    { href: '/admin/games', label: 'Games Browser', description: 'Browse and inspect all games', icon: Gamepad2 },
    { href: '/admin/audit', label: 'Audit Log', description: 'Admin action history', icon: ClipboardList },
    { href: '/admin/health', label: 'System Health', description: 'DB status, uptime, version', icon: Heart },
  ];

  const smallStats = analytics
    ? [
        { label: 'Total Games', value: analytics.total_games.toLocaleString(), icon: Gamepad2 },
        { label: 'Games This Week', value: analytics.games_this_week.toLocaleString(), icon: Calendar },
        { label: 'New Users Today', value: (analytics.new_users_today ?? 0).toLocaleString(), icon: Users },
        { label: 'New Users (Week)', value: (analytics.new_users_week ?? 0).toLocaleString(), icon: TrendingUp },
        {
          label: 'Avg Accuracy',
          value: analytics.avg_accuracy != null ? `${analytics.avg_accuracy.toFixed(1)}%` : '—',
          icon: Target,
        },
        {
          label: 'Win Rate',
          value: analytics.win_rate != null ? `${analytics.win_rate.toFixed(1)}%` : '—',
          icon: Activity,
        },
        { label: 'Avg Guesses', value: analytics.avg_guesses != null ? analytics.avg_guesses.toFixed(2) : '—', icon: BarChart3 },
        { label: 'WAU', value: (analytics.wau ?? 0).toLocaleString(), icon: Users },
      ]
    : [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <h1 className="font-display font-black text-3xl text-text-primary mb-1">Admin · Overview</h1>
        <p className="font-sans text-text-secondary">Platform health and recent activity.</p>
      </motion.div>

      {/* Admin sub-nav */}
      <AdminNav />

      {error && (
        <div
          className="mb-6 px-4 py-3 rounded-card border text-sm flex items-center justify-between"
          style={{ background: 'rgba(231,76,60,0.08)', borderColor: 'rgba(231,76,60,0.25)', color: 'var(--red)' }}
        >
          <span>{error}</span>
          <button className="ml-2 underline text-xs" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* Large stat cards */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            <StatCardLg
              key="users"
              label="Total Users"
              value={analytics.total_users.toLocaleString()}
              icon={Users}
              sparkline={last14Signups}
              trend={signupsTrendVal !== 0 ? { value: Math.abs(signupsTrendVal), direction: signupsTrendVal >= 0 ? 'up' : 'down' } : undefined}
              accent="green"
            />,
            <StatCardLg
              key="dau"
              label="Daily Active"
              value={analytics.dau.toLocaleString()}
              icon={Activity}
              sparkline={last14DAU}
              trend={dauTrendVal !== 0 ? { value: Math.abs(dauTrendVal), direction: dauTrendVal >= 0 ? 'up' : 'down' } : undefined}
              accent="green"
            />,
            <StatCardLg
              key="today"
              label="Games Today"
              value={analytics.games_today.toLocaleString()}
              icon={Calendar}
              accent="default"
            />,
            <StatCardLg
              key="active"
              label="Active Games"
              value={(analytics.active_games ?? 0).toLocaleString()}
              icon={Gamepad2}
              accent="default"
            />,
          ].map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 350, delay: i * 0.06 }}
            >
              {card}
            </motion.div>
          ))}
        </div>
      )}

      {/* Secondary stats grid */}
      {analytics && (
        <motion.div
          variants={{ visible: stagger.fast }}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8"
        >
          {smallStats.map((s, i) => (
            <SmallStatCard key={s.label} label={s.label} value={s.value} icon={s.icon} index={i} />
          ))}
        </motion.div>
      )}

      {/* Timeseries chart panel */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="bg-bg-base border border-border-default rounded-card-lg p-5 mb-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-display font-bold text-text-primary">Activity (last {tsRange} days)</h2>
          <div className="flex items-center gap-2">
            {/* Tab strip */}
            <div className="flex items-center rounded-md border border-border-default overflow-hidden">
              {(['games', 'users', 'quality'] as TimeseriesTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTsTab(tab)}
                  className="px-3 py-1 font-sans text-xs capitalize transition-colors"
                  style={
                    tsTab === tab
                      ? { backgroundColor: 'var(--tile-correct)', color: '#fff', fontWeight: 600 }
                      : { color: 'var(--text-secondary)' }
                  }
                >
                  {tab === 'quality' ? 'Accuracy' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            {/* Range selector */}
            <div className="flex items-center rounded-md border border-border-default overflow-hidden">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setTsRange(r);
                    fetchTimeseries(r);
                  }}
                  className="px-2.5 py-1 font-sans text-xs transition-colors"
                  style={
                    tsRange === r
                      ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', fontWeight: 600 }
                      : { color: 'var(--text-secondary)' }
                  }
                >
                  {r}d
                </button>
              ))}
            </div>
          </div>
        </div>
        {tsLoading ? (
          <div className="flex items-center justify-center h-[220px]">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <TimeSeriesChart data={timeseries} series={tsSeries} height={220} />
        )}
      </motion.div>

      {/* Distributions row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className="bg-bg-base border border-border-default rounded-card-lg p-5"
        >
          <h2 className="font-display font-bold text-text-primary mb-4">ELO Distribution</h2>
          {eloBuckets.length > 0 ? (
            <Histogram buckets={eloBuckets} height={160} />
          ) : (
            <div className="flex items-center justify-center h-[160px] text-sm text-text-secondary">No data</div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.3 }}
          className="bg-bg-base border border-border-default rounded-card-lg p-5"
        >
          <h2 className="font-display font-bold text-text-primary mb-4">Mode Distribution</h2>
          <DonutChart
            segments={modeSegs.filter((s) => s.value > 0)}
            size={140}
            centerLabel="games"
            centerValue={modeSegs.reduce((s, seg) => s + seg.value, 0).toLocaleString()}
            ariaLabel="Games by mode"
          />
        </motion.div>
      </div>

      {/* Outcome breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="bg-bg-base border border-border-default rounded-card-lg p-5 mb-8"
      >
        <h2 className="font-display font-bold text-text-primary mb-4">Game Outcomes</h2>
        <div className="max-w-xs">
          <DonutChart
            segments={outcomeSegs.filter((s) => s.value > 0)}
            size={140}
            ariaLabel="Game outcomes"
          />
        </div>
      </motion.div>

      {/* Sub-page links — 2×3 grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {subPages.map((page, i) => (
          <motion.div
            key={page.href}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 + i * 0.05, type: 'spring', damping: 22, stiffness: 350 }}
          >
            <Link
              href={page.href}
              className="flex flex-col gap-2 bg-bg-base border border-border-default rounded-card-lg px-4 py-4 hover:bg-bg-elevated hover:border-border-strong transition-colors"
            >
              <page.icon size={18} className="text-tile-correct" />
              <span className="font-sans font-semibold text-text-primary text-sm">{page.label}</span>
              <span className="font-sans text-xs text-text-secondary">{page.description}</span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
