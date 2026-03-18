'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Plus, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi } from '@/lib/api';

interface DailyWord {
  id: string;
  word: string;
  date: string;
  difficulty: number | null;
}

export default function AdminWordsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [words, setWords] = useState<DailyWord[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formWord, setFormWord] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDifficulty, setFormDifficulty] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchWords = () => {
    adminApi
      .dailyWords()
      .then((res) => setWords(res.data))
      .catch(() => setError('Failed to load daily words.'))
      .finally(() => setFetching(false));
  };

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      router.replace('/play');
      return;
    }
    fetchWords();
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const wordClean = formWord.trim().toUpperCase();
    if (wordClean.length !== 5) {
      setFormError('Word must be exactly 5 characters.');
      return;
    }
    if (!formDate) {
      setFormError('Please select a date.');
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.setDailyWord({ word: wordClean, date: formDate, difficulty: formDifficulty });
      setSuccess(`Scheduled "${wordClean}" for ${formDate}.`);
      setFormWord('');
      setFormDate('');
      setFormDifficulty(3);
      fetchWords();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(detail || 'Failed to schedule word.');
    } finally {
      setSubmitting(false);
    }
  };

  const difficultyLabel = (d: number) => {
    if (d <= 1) return 'Very Easy';
    if (d <= 2) return 'Easy';
    if (d <= 3) return 'Medium';
    if (d <= 4) return 'Hard';
    return 'Very Hard';
  };

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
      {/* Breadcrumb + header */}
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
          <span className="text-sm text-text-primary">Daily Words</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Daily Words</h1>
        <p className="text-sm text-text-secondary mt-0.5">Schedule words for upcoming days.</p>
      </motion.div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="bg-bg-secondary border border-white/[0.08] rounded-2xl px-5 py-5 mb-6"
      >
        <h2 className="text-sm font-semibold text-text-primary mb-4">Schedule a Word</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Word */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-wider text-text-secondary font-medium">
                Word (5 letters)
              </label>
              <input
                type="text"
                value={formWord}
                onChange={(e) => setFormWord(e.target.value.toUpperCase().slice(0, 5))}
                placeholder="CRANE"
                maxLength={5}
                className="px-3 py-2.5 bg-bg-tertiary border border-white/[0.08] rounded-xl text-sm font-mono tracking-widest text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-white/[0.2] transition-colors uppercase"
              />
            </div>
            {/* Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-wider text-text-secondary font-medium">
                Date
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="px-3 py-2.5 bg-bg-tertiary border border-white/[0.08] rounded-xl text-sm text-text-primary focus:outline-none focus:border-white/[0.2] transition-colors [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Difficulty slider */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-wider text-text-secondary font-medium">
              Difficulty — {difficultyLabel(formDifficulty)} ({formDifficulty})
            </label>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={formDifficulty}
              onChange={(e) => setFormDifficulty(Number(e.target.value))}
              className="w-full accent-[#6aaa64]"
            />
            <div className="flex justify-between text-[10px] text-text-ghost">
              <span>Very Easy</span>
              <span>Very Hard</span>
            </div>
          </div>

          {formError && (
            <p className="text-xs text-red-400">{formError}</p>
          )}
          {success && (
            <p className="text-xs text-[#6aaa64]">{success}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#538d4e] hover:bg-[#6aaa64] disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Schedule Word
          </button>
        </form>
      </motion.div>

      {/* Words list */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="bg-bg-secondary border border-white/[0.08] rounded-2xl overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-text-primary">Scheduled Words</h2>
        </div>
        {fetching ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
          </div>
        ) : words.length === 0 ? (
          <div className="text-center py-12 text-text-secondary text-sm">No daily words scheduled.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider text-text-secondary font-medium">Date</th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider text-text-secondary font-medium">Word</th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider text-text-secondary font-medium">Difficulty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {[...words]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((w) => (
                    <tr key={w.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 text-text-secondary font-mono">{w.date}</td>
                      <td className="px-5 py-3 text-text-primary font-mono font-semibold tracking-widest">
                        {w.word}
                      </td>
                      <td className="px-5 py-3 text-text-secondary">
                        {w.difficulty != null ? difficultyLabel(w.difficulty) : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
