'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  RefreshCw,
  ShieldCheck,
  FileText,
  Megaphone,
  Bell,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi } from '@/lib/api';
import AdminNav from '@/components/admin/AdminNav';

interface AuditEntry {
  id: string;
  admin_user_id: string;
  admin_username: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  payload: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  per_page: number;
}

interface AdminUser {
  id: string;
  username: string;
  is_admin: boolean;
}

const ACTION_OPTIONS = [
  '',
  'reset_elo',
  'toggle_admin',
  'set_daily_word',
  'delete_daily_word',
  'create_announcement',
  'update_announcement',
  'delete_announcement',
  'trigger_notification',
];

const ACTION_LABELS: Record<string, string> = {
  reset_elo: 'Reset ELO',
  toggle_admin: 'Toggle Admin',
  set_daily_word: 'Set Daily Word',
  delete_daily_word: 'Delete Daily Word',
  create_announcement: 'Post Announcement',
  update_announcement: 'Update Announcement',
  delete_announcement: 'Delete Announcement',
  trigger_notification: 'Trigger Notification',
};

function actionVerb(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function ActionIcon({ action }: { action: string }) {
  const size = 14;
  const style = { flexShrink: 0 as const, color: 'var(--text-tertiary)' };
  if (action === 'reset_elo') return <RefreshCw size={size} style={style} />;
  if (action === 'toggle_admin') return <ShieldCheck size={size} style={style} />;
  if (action === 'set_daily_word') return <FileText size={size} style={style} />;
  if (action === 'delete_daily_word') return <Trash2 size={size} style={style} />;
  if (action === 'create_announcement') return <Megaphone size={size} style={style} />;
  if (action === 'update_announcement') return <Megaphone size={size} style={style} />;
  if (action === 'delete_announcement') return <Trash2 size={size} style={style} />;
  if (action === 'trigger_notification') return <Bell size={size} style={style} />;
  return <FileText size={size} style={style} />;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m !== 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h !== 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d !== 1 ? 's' : ''} ago`;
}

const PER_PAGE = 50;

export default function AdminAuditPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const [actionFilter, setActionFilter] = useState('');
  const [adminFilter, setAdminFilter] = useState('');
  const [admins, setAdmins] = useState<AdminUser[]>([]);

  const [expandedPayloads, setExpandedPayloads] = useState<Set<string>>(new Set());

  // Tick every minute so relativeTime() updates ("2 minutes ago" → "3 minutes ago")
  // without the user needing to refresh the page.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const fetchEntries = useCallback((p: number, action: string, adminId: string) => {
    setFetching(true);
    adminApi.auditLog({
      page: p,
      per_page: PER_PAGE,
      action: action || undefined,
      admin_id: adminId || undefined,
    })
      .then((res: { data: AuditResponse }) => {
        setEntries(res.data.entries ?? []);
        setTotal(res.data.total ?? 0);
      })
      .catch(() => setError('Failed to load audit log.'))
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      router.replace('/play');
      return;
    }
    fetchEntries(1, '', '');
    // Fetch admin list for filter
    adminApi.users({ role: 'admin', per_page: 200 } as Parameters<typeof adminApi.users>[0])
      .then((res: { data: { users: AdminUser[] } }) => setAdmins(res.data.users ?? []))
      .catch(() => {});
  }, [user, loading, router, fetchEntries]);

  const togglePayload = (id: string) => {
    setExpandedPayloads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/admin" className="font-sans text-text-secondary hover:text-text-primary text-sm transition-colors">Admin</Link>
          <span className="text-text-tertiary text-sm">/</span>
          <span className="font-sans text-sm text-text-primary">Audit Log</span>
        </div>
        <h1 className="font-display font-black text-3xl text-text-primary">Admin · Audit Log</h1>
        <p className="font-sans text-text-secondary mt-0.5">{total.toLocaleString()} entries</p>
      </motion.div>

      <AdminNav />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-card border text-sm flex items-center justify-between" style={{ background: 'rgba(231,76,60,0.08)', borderColor: 'rgba(231,76,60,0.25)', color: 'var(--red)' }}>
          <span>{error}</span>
          <button className="ml-2 underline text-xs" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="min-w-[180px]">
          <label className="block text-xs uppercase tracking-wider text-text-secondary font-semibold font-sans mb-1">Action</label>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
              fetchEntries(1, e.target.value, adminFilter);
            }}
            className="w-full bg-bg-base border-2 border-border-default rounded-md px-2 py-1.5 font-sans text-sm text-text-primary outline-none focus:border-tile-correct transition-colors"
          >
            {ACTION_OPTIONS.map((a) => (
              <option key={a} value={a}>{a ? actionVerb(a) : 'All Actions'}</option>
            ))}
          </select>
        </div>

        <div className="min-w-[180px]">
          <label className="block text-xs uppercase tracking-wider text-text-secondary font-semibold font-sans mb-1">Admin</label>
          <select
            value={adminFilter}
            onChange={(e) => {
              setAdminFilter(e.target.value);
              setPage(1);
              fetchEntries(1, actionFilter, e.target.value);
            }}
            className="w-full bg-bg-base border-2 border-border-default rounded-md px-2 py-1.5 font-sans text-sm text-text-primary outline-none focus:border-tile-correct transition-colors"
          >
            <option value="">All Admins</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>{a.username}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Entries list */}
      <div className="bg-bg-base border border-border-default rounded-card-lg overflow-hidden">
        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }} />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-text-secondary font-sans text-sm">No audit entries found.</div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {entries.map((entry) => {
              const hasPayload = entry.payload && Object.keys(entry.payload).length > 0;
              const expanded = expandedPayloads.has(entry.id);
              return (
                <li key={entry.id} className="px-5 py-3 hover:bg-bg-elevated/40 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      <ActionIcon action={entry.action} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-sm text-text-primary">
                        <span className="font-semibold">{entry.admin_username}</span>
                        <span className="text-text-secondary"> {actionVerb(entry.action)}</span>
                        {entry.target_label && (
                          <span className="text-text-tertiary"> — on {entry.target_label}</span>
                        )}
                      </p>
                      {hasPayload && (
                        <button
                          onClick={() => togglePayload(entry.id)}
                          className="flex items-center gap-1 mt-1 font-sans text-xs text-text-tertiary hover:text-text-secondary transition-colors"
                        >
                          <ChevronDown
                            size={10}
                            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                          />
                          {expanded ? 'Hide' : 'Show'} payload
                        </button>
                      )}
                      <AnimatePresence>
                        {expanded && hasPayload && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <pre
                              className="mt-2 rounded-md p-3 text-text-secondary overflow-x-auto"
                              style={{
                                fontSize: 11,
                                backgroundColor: 'var(--bg-elevated)',
                                border: '1px solid var(--border-subtle)',
                                fontFamily: 'var(--font-mono, monospace)',
                              }}
                            >
                              {JSON.stringify(entry.payload, null, 2)}
                            </pre>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <span
                        className="font-sans text-text-tertiary"
                        style={{ fontSize: 11 }}
                        title={new Date(entry.created_at).toLocaleString()}
                      >
                        {relativeTime(entry.created_at)}
                      </span>
                      {entry.ip_address && (
                        <p className="font-mono text-text-tertiary" style={{ fontSize: 9, marginTop: 2 }}>{entry.ip_address}</p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-text-secondary font-sans">
          <span>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { const p = Math.max(1, page - 1); setPage(p); fetchEntries(p, actionFilter, adminFilter); }}
              disabled={page === 1}
              className="p-1.5 rounded-md border-2 border-border-default hover:border-border-strong disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); fetchEntries(p, actionFilter, adminFilter); }}
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
