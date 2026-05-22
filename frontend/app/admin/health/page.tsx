'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi } from '@/lib/api';
import AdminNav from '@/components/admin/AdminNav';

interface HealthData {
  db: { ok: boolean; latency_ms: number | null };
  uptime_seconds: number | null;
  version: string;
  checks: { games_table: number; users_table: number; audit_log_size: number };
}

function formatUptime(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} minute${m !== 1 ? 's' : ''}`;
  const h = Math.floor(m / 60);
  const remainingM = m % 60;
  if (h < 24) {
    return remainingM > 0
      ? `${h} hour${h !== 1 ? 's' : ''} ${remainingM} minute${remainingM !== 1 ? 's' : ''}`
      : `${h} hour${h !== 1 ? 's' : ''}`;
  }
  const d = Math.floor(h / 24);
  const remainingH = h % 24;
  return remainingH > 0
    ? `${d} day${d !== 1 ? 's' : ''} ${remainingH} hour${remainingH !== 1 ? 's' : ''}`
    : `${d} day${d !== 1 ? 's' : ''}`;
}

export default function AdminHealthPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [health, setHealth] = useState<HealthData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchHealth = useCallback(() => {
    setFetching(true);
    setError('');
    adminApi.health()
      .then((res) => {
        setHealth(res.data);
        setLastRefreshed(new Date());
      })
      .catch(() => setError('Failed to load health data.'))
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      router.replace('/play');
      return;
    }
    fetchHealth();
  }, [user, loading, router, fetchHealth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user?.is_admin) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/admin" className="font-sans text-text-secondary hover:text-text-primary text-sm transition-colors">Admin</Link>
          <span className="text-text-tertiary text-sm">/</span>
          <span className="font-sans text-sm text-text-primary">Health</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-black text-3xl text-text-primary">Admin · System Health</h1>
            {lastRefreshed && (
              <p className="font-sans text-text-tertiary text-xs mt-0.5">
                Last refreshed: {lastRefreshed.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            onClick={fetchHealth}
            disabled={fetching}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border-2 border-border-default font-sans text-sm text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={fetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </motion.div>

      <AdminNav />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-card border text-sm" style={{ background: 'rgba(231,76,60,0.08)', borderColor: 'rgba(231,76,60,0.25)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {fetching && !health ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }} />
        </div>
      ) : health ? (
        <>
          {/* Status cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {/* Database */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.3 }} className="bg-bg-base border border-border-default rounded-card-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                {health.db.ok ? (
                  <CheckCircle size={16} style={{ color: 'var(--tile-correct)', flexShrink: 0 }} />
                ) : (
                  <XCircle size={16} style={{ color: 'var(--red)', flexShrink: 0 }} />
                )}
                <span className="text-xs uppercase tracking-wider text-text-secondary font-semibold font-sans">Database</span>
              </div>
              <div
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold font-sans mb-2"
                style={health.db.ok
                  ? { backgroundColor: 'rgba(106,170,100,0.12)', color: 'var(--tile-correct)' }
                  : { backgroundColor: 'rgba(231,76,60,0.10)', color: 'var(--red)' }
                }
              >
                {health.db.ok ? 'Healthy' : 'Error'}
              </div>
              {health.db.latency_ms !== null && (
                <p className="font-mono text-text-secondary text-sm">{health.db.latency_ms.toFixed(1)}ms latency</p>
              )}
            </motion.div>

            {/* Uptime */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.3 }} className="bg-bg-base border border-border-default rounded-card-lg p-5">
              <span className="text-xs uppercase tracking-wider text-text-secondary font-semibold font-sans block mb-3">Uptime</span>
              <span className="font-display text-xl font-bold text-text-primary">
                {formatUptime(health.uptime_seconds)}
              </span>
            </motion.div>

            {/* Version */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11, duration: 0.3 }} className="bg-bg-base border border-border-default rounded-card-lg p-5">
              <span className="text-xs uppercase tracking-wider text-text-secondary font-semibold font-sans block mb-3">Version</span>
              <span className="font-mono text-text-primary text-lg">{health.version || '—'}</span>
            </motion.div>
          </div>

          {/* Table sizes */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3 }} className="bg-bg-base border border-border-default rounded-card-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-border-default">
              <h2 className="font-sans font-semibold text-text-primary text-sm">Database Table Sizes</h2>
            </div>
            <div className="divide-y divide-border-subtle">
              {[
                { label: 'Users', value: health.checks.users_table },
                { label: 'Games', value: health.checks.games_table },
                { label: 'Audit Log Entries', value: health.checks.audit_log_size },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-5 py-3">
                  <span className="font-sans text-sm text-text-secondary">{label}</span>
                  <span className="font-mono text-text-primary tabular-nums font-semibold">{value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      ) : null}
    </div>
  );
}
