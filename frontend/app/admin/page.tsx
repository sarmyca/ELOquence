'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Users, FileText, Megaphone, BarChart3, TrendingUp, Target, Calendar, Gamepad2 } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { stagger } from '@/lib/animations';

interface Analytics {
  total_users: number;
  total_games: number;
  games_today: number;
  games_this_week: number;
  avg_accuracy: number;
  win_rate: number;
  dau: number;
  wau: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
  index,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  index: number;
}) {
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

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      router.replace('/play');
      return;
    }
    adminApi
      .analytics()
      .then((res) => setAnalytics(res.data))
      .catch(() => setError('Failed to load analytics.'))
      .finally(() => setFetching(false));
  }, [user, loading, router]);

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user?.is_admin) return null;

  const stats = analytics
    ? [
        { label: 'Total Users', value: analytics.total_users.toLocaleString(), icon: Users },
        { label: 'Total Games', value: analytics.total_games.toLocaleString(), icon: Gamepad2 },
        { label: 'Games Today', value: analytics.games_today.toLocaleString(), icon: Calendar },
        { label: 'Games This Week', value: analytics.games_this_week.toLocaleString(), icon: BarChart3 },
        {
          label: 'Avg Accuracy',
          value: analytics.avg_accuracy != null ? `${(analytics.avg_accuracy * 100).toFixed(1)}%` : '—',
          icon: Target,
        },
        {
          label: 'Win Rate',
          value: analytics.win_rate != null ? `${(analytics.win_rate * 100).toFixed(1)}%` : '—',
          icon: TrendingUp,
        },
        { label: 'DAU', value: analytics.dau.toLocaleString(), icon: Users },
        { label: 'WAU', value: analytics.wau.toLocaleString(), icon: Users },
      ]
    : [];

  const subPages = [
    { href: '/admin/users', label: 'User Management', description: 'Search, reset ELO, manage admins', icon: Users },
    { href: '/admin/words', label: 'Daily Words', description: 'Schedule upcoming daily words', icon: FileText },
    { href: '/admin/announcements', label: 'Announcements', description: 'Post and manage banners', icon: Megaphone },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <h1 className="font-display font-black text-3xl text-text-primary mb-1">Admin · Dashboard</h1>
        <p className="font-sans text-text-secondary">Platform overview and management tools.</p>
      </motion.div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-card border text-sm" style={{ background: 'rgba(231,76,60,0.08)', borderColor: 'rgba(231,76,60,0.25)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {/* Stats grid */}
      {analytics && (
        <motion.div
          variants={{ visible: stagger.fast }}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8"
        >
          {stats.map((s, i) => (
            <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} index={i} />
          ))}
        </motion.div>
      )}

      {/* Sub-page links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {subPages.map((page, i) => (
          <motion.div
            key={page.href}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06, type: 'spring', damping: 22, stiffness: 350 }}
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
