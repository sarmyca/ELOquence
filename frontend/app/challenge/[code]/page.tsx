'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Trophy, ArrowRight, Share2, Check, Crown, User, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { challengesApi } from '@/lib/api';
import { springs, stagger } from '@/lib/animations';
import clsx from 'clsx';

interface ChallengeInfo {
  code: string;
  creator_id: string;
  word_difficulty: number | null;
  already_played: boolean;
  game_id: string | null;
}

interface ChallengeResult {
  username: string;
  status: string;
  num_guesses: number;
  accuracy_score: number | null;
  is_creator: boolean;
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
      <div className="w-6 h-6 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const won = status === 'won';
  return (
    <span
      className={clsx(
        'text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide',
        won
          ? 'bg-tile-correct/10 text-tile-correct border border-tile-correct/20'
          : 'bg-[#e74c3c]/10 text-[#e74c3c] border border-[#e74c3c]/20'
      )}
    >
      {won ? 'Solved' : 'Failed'}
    </span>
  );
}

export default function ChallengePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [challenge, setChallenge] = useState<ChallengeInfo | null>(null);
  const [results, setResults] = useState<ChallengeResult[]>([]);
  const [challengeWord, setChallengeWord] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code || authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    Promise.all([
      challengesApi.get(code).then((res) => {
        setChallenge(res.data);
        return res.data;
      }),
      challengesApi
        .results(code)
        .then((res) => {
          setResults(res.data.results || []);
          setChallengeWord(res.data.word ?? null);
        })
        .catch(() => {}),
    ])
      .catch(() => setError('Challenge not found'))
      .finally(() => setLoading(false));
  }, [code, user, authLoading, router]);

  const handlePlay = async () => {
    if (!code || starting) return;
    setStarting(true);
    setError('');
    try {
      const res = await challengesApi.play(code);
      router.push(`/game/${res.data.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Could not start challenge';
      setError(msg);
      setStarting(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/challenge/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: do nothing
    }
  };

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/challenge/${code}` : '';

  if (authLoading || loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-56px)] px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.slide}
          className="text-center"
        >
          <Swords size={40} className="text-text-ghost mx-auto mb-4" />
          <h1 className="text-xl font-bold text-text-primary mb-2">Challenge not found</h1>
          <p className="text-text-secondary text-sm mb-6">{error}</p>
          <button
            onClick={() => router.push('/play')}
            className="px-4 py-2 rounded-xl bg-[#538d4e] hover:bg-[#6aaa64] text-white font-medium text-sm transition-colors"
          >
            Play a Game
          </button>
        </motion.div>
      </div>
    );
  }

  const hasResults = results.length > 0;
  const myResult = results.find((r) => r.username === user?.username);
  const allWordsRevealed = hasResults && results.every((r) => r.status !== 'in_progress');

  // Sort: creator first, then by guesses (solved first, then fewest guesses)
  const sortedResults = [...results].sort((a, b) => {
    if (a.is_creator && !b.is_creator) return -1;
    if (!a.is_creator && b.is_creator) return 1;
    if (a.status === 'won' && b.status !== 'won') return -1;
    if (a.status !== 'won' && b.status === 'won') return 1;
    return (a.num_guesses ?? 99) - (b.num_guesses ?? 99);
  });

  return (
    <div className="flex flex-col items-center min-h-[calc(100dvh-56px)] px-4 py-10">
      <motion.div
        className="w-full max-w-md flex flex-col gap-4"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: stagger.medium },
        }}
      >
        {/* Hero card */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 24 },
            visible: { opacity: 1, y: 0, transition: springs.slide },
          }}
          className="rounded-2xl bg-bg-secondary border border-white/[0.08] overflow-hidden"
        >
          {/* Top accent stripe */}
          <div className="h-1 w-full bg-gradient-to-r from-[#538d4e] to-[#6aaa64]" />

          <div className="p-6 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#538d4e]/10 border border-[#538d4e]/20 flex items-center justify-center">
              <Swords size={26} className="text-[#6aaa64]" />
            </div>

            <div>
              <h1 className="text-xl font-bold text-text-primary">You've been challenged!</h1>
              <p className="text-text-secondary text-sm mt-1">
                Can you solve this Wordle in fewer guesses?
              </p>
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-3 flex-wrap justify-center">
              {challenge?.word_difficulty && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-[#c9a227]/10 border border-[#c9a227]/20 text-[#c9a227] font-mono">
                  Word ELO: {challenge.word_difficulty.toLocaleString()}
                </span>
              )}
              {hasResults && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-text-secondary">
                  {results.length} {results.length === 1 ? 'player' : 'players'}
                </span>
              )}
              {allWordsRevealed && challengeWord && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-text-secondary font-mono uppercase">
                  {challengeWord}
                </span>
              )}
            </div>

            {/* CTA */}
            {!challenge?.already_played ? (
              <motion.button
                whileHover={{ scale: starting ? 1 : 1.02 }}
                whileTap={{ scale: starting ? 1 : 0.97 }}
                onClick={handlePlay}
                disabled={starting}
                className="w-full py-3.5 rounded-xl bg-[#538d4e] hover:bg-[#6aaa64] disabled:opacity-60 text-white font-semibold text-base transition-colors flex items-center justify-center gap-2"
              >
                {starting ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <>
                    <Swords size={18} />
                    Accept Challenge
                  </>
                )}
              </motion.button>
            ) : (
              <div className="w-full flex flex-col gap-2">
                <div className="py-2.5 rounded-xl bg-[#538d4e]/10 border border-[#538d4e]/20 text-[#6aaa64] text-sm font-medium text-center">
                  You've completed this challenge
                </div>
                {challenge.game_id && (
                  <button
                    onClick={() => router.push(`/review/${challenge.game_id}`)}
                    className="w-full py-2.5 rounded-xl bg-bg-tertiary hover:bg-bg-elevated text-text-primary font-medium text-sm transition-colors flex items-center justify-center gap-2 border border-white/[0.08]"
                  >
                    <ExternalLink size={14} />
                    View Your Game
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-sm text-[#e74c3c] bg-[#e74c3c]/10 border border-[#e74c3c]/20 rounded-lg px-4 py-2 text-center"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Results leaderboard — shown only after user has played */}
        {hasResults && challenge?.already_played && (
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 24 },
              visible: { opacity: 1, y: 0, transition: springs.slide },
            }}
            className="rounded-2xl bg-bg-secondary border border-white/[0.08] overflow-hidden"
          >
            <div className="px-4 pt-4 pb-2 border-b border-white/[0.06] flex items-center gap-2">
              <Trophy size={13} className="text-[#c9a227]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Leaderboard
              </span>
            </div>

            {/* Header */}
            <div className="grid grid-cols-[1.5rem_1fr_5rem_4rem_5rem] gap-2 px-4 py-2 text-[10px] text-text-ghost uppercase tracking-wider border-b border-white/[0.04]">
              <span>#</span>
              <span>Player</span>
              <span className="text-center">Result</span>
              <span className="text-right">Guesses</span>
              <span className="text-right">Accuracy</span>
            </div>

            <div className="flex flex-col divide-y divide-white/[0.04]">
              {sortedResults.map((result, idx) => {
                const isMe = result.username === user?.username;
                const rank = idx + 1;

                return (
                  <motion.div
                    key={result.username}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.06, ...springs.slide }}
                    className={clsx(
                      'grid grid-cols-[1.5rem_1fr_5rem_4rem_5rem] gap-2 px-4 py-3 items-center',
                      isMe ? 'bg-[#538d4e]/08' : 'hover:bg-white/[0.02]'
                    )}
                  >
                    {/* Rank */}
                    <span className="text-xs font-mono font-bold text-text-ghost">
                      {rank === 1 && result.status === 'won' ? (
                        <Trophy size={12} className="text-[#c9a227]" />
                      ) : (
                        rank
                      )}
                    </span>

                    {/* Username */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {result.is_creator && (
                        <Crown size={11} className="text-[#c9a227] shrink-0" />
                      )}
                      <span
                        className={clsx(
                          'text-sm font-medium truncate',
                          isMe ? 'text-text-primary' : 'text-text-secondary'
                        )}
                      >
                        {result.username}
                        {isMe && (
                          <span className="ml-1.5 text-[10px] text-text-ghost font-normal">
                            (you)
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="flex justify-center">
                      <StatusBadge status={result.status} />
                    </div>

                    {/* Guesses */}
                    <span
                      className={clsx(
                        'text-sm font-mono font-bold tabular-nums text-right',
                        result.status === 'won' ? 'text-text-primary' : 'text-text-ghost'
                      )}
                    >
                      {result.status === 'won' ? `${result.num_guesses}/6` : 'X/6'}
                    </span>

                    {/* Accuracy */}
                    <span className="text-xs font-mono tabular-nums text-text-secondary text-right">
                      {result.accuracy_score !== null && result.accuracy_score !== undefined
                        ? `${Math.round(result.accuracy_score)}%`
                        : '—'}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Share section */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 24 },
            visible: { opacity: 1, y: 0, transition: springs.slide },
          }}
          className="rounded-2xl bg-bg-secondary border border-white/[0.08] p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Share2 size={13} className="text-text-ghost" />
            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Share Challenge
            </span>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 min-w-0 py-2 px-3 rounded-lg bg-bg-tertiary border border-white/[0.08] text-xs text-text-ghost font-mono truncate">
              {shareUrl}
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleCopyLink}
              className="shrink-0 px-3 py-2 rounded-lg bg-bg-elevated hover:bg-white/[0.1] border border-white/[0.08] text-text-primary text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check size={13} className="text-tile-correct" />
                  Copied!
                </>
              ) : (
                <>
                  <Share2 size={13} />
                  Copy
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
