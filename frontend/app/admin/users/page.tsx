'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, ShieldCheck, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { getRatingTier } from '@/lib/types';

interface AdminUser {
  id: string;
  username: string;
  email: string;
  elo_rating: number;
  games_played: number;
  is_admin: boolean;
  created_at: string;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
}

export default function AdminUsersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const PER_PAGE = 20;

  const fetchUsers = useCallback(
    (p: number, q: string) => {
      setFetching(true);
      adminApi
        .users({ page: p, search: q || undefined })
        .then((res) => {
          const data: UsersResponse = res.data;
          setUsers(data.users);
          setTotal(data.total);
        })
        .catch(() => setError('Failed to load users.'))
        .finally(() => setFetching(false));
    },
    []
  );

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      router.replace('/play');
      return;
    }
    fetchUsers(page, search);
  }, [user, loading, router, page, fetchUsers]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchUsers(1, val);
    }, 350);
  };

  const handleResetElo = async (userId: string) => {
    if (confirmReset !== userId) {
      setConfirmReset(userId);
      return;
    }
    setActionLoading(userId + '-reset');
    setConfirmReset(null);
    try {
      await adminApi.resetElo(userId);
      fetchUsers(page, search);
    } catch {
      setError('Failed to reset ELO.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAdmin = async (userId: string) => {
    setActionLoading(userId + '-admin');
    try {
      await adminApi.toggleAdmin(userId);
      fetchUsers(page, search);
    } catch {
      setError('Failed to toggle admin.');
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
        <div className="w-6 h-6 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user?.is_admin) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6 flex items-center justify-between"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin" className="text-text-secondary hover:text-text-primary text-sm transition-colors">
              Admin
            </Link>
            <span className="text-text-ghost text-sm">/</span>
            <span className="text-sm text-text-primary">Users</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">User Management</h1>
          <p className="text-sm text-text-secondary mt-0.5">{total.toLocaleString()} total users</p>
        </div>
      </motion.div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
          <button className="ml-2 underline" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* Search */}
      <div className="mb-4 relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by username or email..."
          className="w-full pl-9 pr-4 py-2.5 bg-bg-secondary border border-white/[0.08] rounded-xl text-sm text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-white/[0.2] transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-bg-secondary border border-white/[0.08] rounded-2xl overflow-hidden">
        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-text-secondary text-sm">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-text-secondary font-medium">Username</th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-text-secondary font-medium hidden sm:table-cell">Email</th>
                  <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-text-secondary font-medium">ELO</th>
                  <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-text-secondary font-medium hidden sm:table-cell">Games</th>
                  <th className="text-center px-4 py-3 text-[10px] uppercase tracking-wider text-text-secondary font-medium">Role</th>
                  <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-text-secondary font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {users.map((u) => {
                  const tier = getRatingTier(u.elo_rating);
                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-text-primary">
                        {u.username}
                      </td>
                      <td className="px-4 py-3 text-text-secondary hidden sm:table-cell truncate max-w-[200px]">
                        {u.email}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: tier.color }}>
                        {u.elo_rating}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary hidden sm:table-cell">
                        {u.games_played}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {u.is_admin ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#c9a227]/15 text-[#c9a227]">
                            <ShieldCheck size={10} />
                            Admin
                          </span>
                        ) : (
                          <span className="text-[10px] text-text-ghost">User</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleResetElo(u.id)}
                            disabled={actionLoading === u.id + '-reset'}
                            className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                              confirmReset === u.id
                                ? 'border-red-500/50 text-red-400 bg-red-500/10 hover:bg-red-500/20'
                                : 'border-white/[0.08] text-text-secondary hover:text-text-primary hover:border-white/[0.16]'
                            }`}
                          >
                            {actionLoading === u.id + '-reset' ? (
                              <RefreshCw size={10} className="animate-spin" />
                            ) : confirmReset === u.id ? (
                              'Confirm?'
                            ) : (
                              'Reset ELO'
                            )}
                          </button>
                          <button
                            onClick={() => handleToggleAdmin(u.id)}
                            disabled={actionLoading === u.id + '-admin'}
                            className="text-[11px] px-2 py-1 rounded-md border border-white/[0.08] text-text-secondary hover:text-text-primary hover:border-white/[0.16] transition-colors"
                          >
                            {actionLoading === u.id + '-admin' ? (
                              <RefreshCw size={10} className="animate-spin" />
                            ) : u.is_admin ? (
                              'Demote'
                            ) : (
                              'Make Admin'
                            )}
                          </button>
                        </div>
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
        <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-md border border-white/[0.08] hover:border-white/[0.16] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-md border border-white/[0.08] hover:border-white/[0.16] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
