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
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }} />
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
          <Link href="/admin" className="font-sans text-text-secondary hover:text-text-primary text-sm transition-colors">
            Admin
          </Link>
          <span className="text-text-tertiary text-sm">/</span>
          <span className="font-sans text-sm text-text-primary">Daily Words</span>
        </div>
        <h1 className="font-display font-black text-3xl text-text-primary">Admin · Words</h1>
        <p className="font-sans text-text-secondary mt-0.5">Schedule words for upcoming days.</p>
      </motion.div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-card border text-sm" style={{ background: 'rgba(231,76,60,0.08)', borderColor: 'rgba(231,76,60,0.25)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {/* Form card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="bg-bg-base border border-border-default rounded-card-lg p-6 mb-6"
      >
        <h2 className="font-sans font-semibold text-text-primary text-sm mb-4">Schedule a Word</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Word */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-text-secondary font-semibold font-sans">
                Word (5 letters)
              </label>
              <input
                type="text"
                value={formWord}
                onChange={(e) => setFormWord(e.target.value.toUpperCase().slice(0, 5))}
                placeholder="CRANE"
                maxLength={5}
                className="bg-transparent border-2 border-border-default rounded-md px-3 py-2 focus:border-tile-correct outline-none text-text-primary font-mono tracking-widest text-sm uppercase placeholder:text-text-tertiary transition-colors"
              />
            </div>
            {/* Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-text-secondary font-semibold font-sans">
                Date
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="bg-transparent border-2 border-border-default rounded-md px-3 py-2 focus:border-tile-correct outline-none text-text-primary font-sans text-sm transition-colors"
              />
            </div>
          </div>

          {/* Difficulty slider */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-text-secondary font-semibold font-sans">
              Difficulty — {difficultyLabel(formDifficulty)} ({formDifficulty})
            </label>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={formDifficulty}
              onChange={(e) => setFormDifficulty(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: 'var(--tile-correct)' }}
            />
            <div className="flex justify-between text-[10px] text-text-tertiary font-sans">
              <span>Very Easy</span>
              <span>Very Hard</span>
            </div>
          </div>

          {formError && (
            <p className="text-xs font-sans" style={{ color: 'var(--red)' }}>{formError}</p>
          )}
          {success && (
            <p className="text-xs font-sans" style={{ color: 'var(--tile-correct)' }}>{success}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-tile-correct text-white font-bold uppercase tracking-wider rounded-md hover:brightness-110 active:scale-[0.98] transition-[filter,transform] disabled:opacity-60 font-sans text-sm"
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

      {/* Words list card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="bg-bg-base border border-border-default rounded-card-lg overflow-hidden"
      >
        <div className="px-6 py-3 border-b border-border-default">
          <h2 className="font-sans font-semibold text-text-primary text-sm">Scheduled Words</h2>
        </div>
        {fetching ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }} />
          </div>
        ) : words.length === 0 ? (
          <div className="text-center py-12 text-text-secondary font-sans text-sm">No daily words scheduled.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b-2 border-border-default">
                  <th className="text-left px-6 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold">Date</th>
                  <th className="text-left px-6 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold">Word</th>
                  <th className="text-left px-6 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold">Difficulty</th>
                </tr>
              </thead>
              <tbody>
                {[...words]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((w) => (
                    <tr key={w.id} className="border-b border-border-subtle hover:bg-bg-elevated/50 transition-colors">
                      <td className="px-6 py-3 text-text-secondary font-mono tabular-nums">{w.date}</td>
                      <td className="px-6 py-3 text-text-primary font-mono font-semibold tracking-widest">
                        {w.word}
                      </td>
                      <td className="px-6 py-3 text-text-secondary">
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
