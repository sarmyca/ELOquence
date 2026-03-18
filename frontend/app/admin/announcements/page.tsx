'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi } from '@/lib/api';

interface Announcement {
  id: string;
  text: string;
  active: boolean;
  created_at: string;
}

export default function AdminAnnouncementsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  // Create form
  const [newText, setNewText] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Action tracking
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchAnnouncements = () => {
    adminApi
      .announcements()
      .then((res) => setAnnouncements(res.data))
      .catch(() => setError('Failed to load announcements.'))
      .finally(() => setFetching(false));
  };

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      router.replace('/play');
      return;
    }
    fetchAnnouncements();
  }, [user, loading, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    const text = newText.trim();
    if (!text) {
      setCreateError('Announcement text is required.');
      return;
    }
    setCreating(true);
    try {
      await adminApi.createAnnouncement(text);
      setNewText('');
      fetchAnnouncements();
    } catch {
      setCreateError('Failed to create announcement.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    setToggling(id);
    try {
      await adminApi.updateAnnouncement(id, { active: !currentActive });
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, active: !currentActive } : a))
      );
    } catch {
      setError('Failed to toggle announcement.');
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setDeleting(id);
    setConfirmDelete(null);
    try {
      await adminApi.deleteAnnouncement(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError('Failed to delete announcement.');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
        <div className="w-6 h-6 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user?.is_admin) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 mb-1">
          <Link href="/admin" className="text-text-secondary hover:text-text-primary text-sm transition-colors">
            Admin
          </Link>
          <span className="text-text-ghost text-sm">/</span>
          <span className="text-sm text-text-primary">Announcements</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Announcements</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Manage banners shown to all users.
        </p>
      </motion.div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button className="text-xs underline" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* Create form */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="bg-bg-secondary border border-white/[0.08] rounded-2xl px-5 py-5 mb-6"
      >
        <h2 className="text-sm font-semibold text-text-primary mb-4">New Announcement</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            rows={3}
            placeholder="Enter announcement text..."
            className="px-3 py-2.5 bg-bg-tertiary border border-white/[0.08] rounded-xl text-sm text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-white/[0.2] transition-colors resize-none"
          />
          {createError && <p className="text-xs text-red-400">{createError}</p>}
          <button
            type="submit"
            disabled={creating}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#538d4e] hover:bg-[#6aaa64] disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Post Announcement
          </button>
        </form>
      </motion.div>

      {/* Announcements list */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="bg-bg-secondary border border-white/[0.08] rounded-2xl overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-text-primary">All Announcements</h2>
        </div>

        {fetching ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-12 text-text-secondary text-sm">
            No announcements yet.
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            <AnimatePresence initial={false}>
              {announcements.map((a) => (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="px-5 py-4 flex items-start gap-3"
                >
                  {/* Status dot */}
                  <div className="mt-1 flex-shrink-0">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        a.active ? 'bg-[#6aaa64]' : 'bg-bg-tertiary'
                      }`}
                    />
                  </div>

                  {/* Text + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary leading-relaxed">{a.text}</p>
                    <p className="text-[10px] text-text-ghost mt-1">{formatDate(a.created_at)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Toggle switch */}
                    <button
                      onClick={() => handleToggle(a.id, a.active)}
                      disabled={toggling === a.id}
                      aria-label={a.active ? 'Deactivate' : 'Activate'}
                      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                        a.active ? 'bg-[#538d4e]' : 'bg-bg-tertiary border border-white/[0.08]'
                      }`}
                    >
                      {toggling === a.id ? (
                        <Loader2 size={10} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" />
                      ) : (
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                            a.active ? 'left-[18px]' : 'left-0.5'
                          }`}
                        />
                      )}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={deleting === a.id}
                      aria-label="Delete"
                      className={`p-1.5 rounded-md transition-colors ${
                        confirmDelete === a.id
                          ? 'bg-red-500/20 text-red-400'
                          : 'text-text-ghost hover:text-red-400 hover:bg-red-500/10'
                      }`}
                    >
                      {deleting === a.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </motion.div>
    </div>
  );
}
