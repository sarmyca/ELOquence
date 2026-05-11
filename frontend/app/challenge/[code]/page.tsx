'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Swords,
  Trophy,
  Share2,
  Check,
  Crown,
  ExternalLink,
  Users,
  ChevronRight,
} from 'lucide-react';
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

/* ------------------------------------------------------------------ */
/*  Loading spinner                                                     */
/* ------------------------------------------------------------------ */

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin border-tile-correct" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status badge                                                        */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
  const won = status === 'won';
  return (
    <span
      className={clsx(
        'text-[10px] px-2 py-0.5 rounded-pill font-semibold uppercase tracking-wide border',
        won
          ? 'bg-tile-correct/10 text-tile-correct border-tile-correct/25'
          : 'border-border-subtle text-text-secondary bg-bg-elevated',
      )}
    >
      {won ? 'Solved' : 'Failed'}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Rank medal                                                          */
/* ------------------------------------------------------------------ */

function RankDisplay({ rank, won }: { rank: number; won: boolean }) {
  if (rank === 1 && won) {
    return <Trophy size={14} style={{ color: 'var(--gold)' }} />;
  }
  return (
    <span className="text-xs font-mono font-bold text-text-secondary tabular-nums">{rank}</span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main challenge page                                                 */
/* ------------------------------------------------------------------ */

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

  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/challenge/${code}` : '';

  if (authLoading || loading) return <LoadingSpinner />;

  if (error && !challenge) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-56px)] px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.slide}
          className="text-center"
        >
          <div className="w-16 h-16 rounded-card-lg bg-bg-elevated border border-border-subtle flex items-center justify-center mx-auto mb-5">
            <Swords size={28} className="text-text-secondary" />
          </div>
          <h1 className="font-display font-bold text-xl text-text-primary mb-2">
            Challenge not found
          </h1>
          <p className="font-sans text-text-secondary text-sm mb-6">{error}</p>
          <button
            onClick={() => router.push('/play')}
            className="px-5 py-2.5 rounded-card bg-tile-correct text-white font-bold uppercase tracking-wider text-sm hover:brightness-110 transition-[filter,transform] active:scale-[0.98]"
          >
            Play a Game
          </button>
        </motion.div>
      </div>
    );
  }

  const hasResults = results.length > 0;
  const allWordsRevealed = hasResults && results.every((r) => r.status !== 'in_progress');

  // Sort: creator first, then winners by fewest guesses, then non-winners
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
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: springs.slide },
          }}
          className="rounded-card-lg bg-bg-base border-2 border-border-default overflow-hidden shadow-card"
        >
          {/* Wordle-green top rule */}
          <div className="h-[3px] w-full bg-tile-correct" />

          <div className="p-6 flex flex-col items-center gap-5 text-center">
            {/* Icon */}
            <div className="w-14 h-14 rounded-card-lg bg-bg-elevated border border-border-subtle flex items-center justify-center">
              <Trophy size={26} style={{ color: 'var(--gold)' }} />
            </div>

            {/* Title */}
            <div>
              <p className="font-sans text-sm text-text-secondary mb-1">
                Challenge from a friend
              </p>
              <h1 className="font-display font-bold text-2xl text-text-primary">
                You&apos;ve been challenged!
              </h1>
              <p className="font-sans text-sm text-text-secondary mt-1.5">
                Can you solve this Wordle in fewer guesses?
              </p>
            </div>

            {/* Meta chips */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {challenge?.word_difficulty && (
                <span
                  className="text-xs px-2.5 py-1 rounded-pill border font-mono"
                  style={{
                    color: 'var(--yellow)',
                    backgroundColor: 'rgba(201,180,88,0.10)',
                    borderColor: 'rgba(201,180,88,0.22)',
                  }}
                >
                  Word ELO: {challenge.word_difficulty.toLocaleString()}
                </span>
              )}
              {hasResults && (
                <span className="text-xs px-2.5 py-1 rounded-pill border border-border-subtle bg-bg-elevated text-text-secondary flex items-center gap-1.5">
                  <Users size={10} />
                  {results.length} {results.length === 1 ? 'player' : 'players'}
                </span>
              )}
              {allWordsRevealed && challengeWord && (
                <span className="text-xs px-2.5 py-1 rounded-pill border border-border-subtle bg-bg-elevated text-text-secondary font-mono uppercase tracking-widest">
                  {challengeWord}
                </span>
              )}
            </div>

            {/* CTA */}
            {!challenge?.already_played ? (
              <motion.button
                whileHover={{ scale: starting ? 1 : 1.02 }}
                whileTap={{ scale: starting ? 1 : 0.98 }}
                onClick={handlePlay}
                disabled={starting}
                className="w-full py-3 rounded-card bg-tile-correct disabled:opacity-60 text-white font-bold text-base uppercase tracking-wider hover:brightness-110 transition-[filter,transform] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {starting ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <>
                    <Swords size={18} />
                    Accept Challenge
                    <ChevronRight size={16} className="ml-auto opacity-60" />
                  </>
                )}
              </motion.button>
            ) : (
              <div className="w-full flex flex-col gap-2">
                <div className="py-2.5 rounded-card bg-tile-correct/10 border border-tile-correct/25 text-tile-correct text-sm font-semibold text-center flex items-center justify-center gap-2">
                  <Check size={15} />
                  You&apos;ve completed this challenge
                </div>
                {challenge.game_id && (
                  <button
                    onClick={() => router.push(`/review/${challenge.game_id}`)}
                    className="w-full py-2.5 rounded-card bg-bg-elevated border border-border-subtle hover:border-border-default text-text-primary font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={14} />
                    View Your Game
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Inline error */}
        <AnimatePresence>
          {error && challenge && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-sm rounded-card px-4 py-2 text-center"
              style={{
                color: 'var(--red)',
                backgroundColor: 'rgba(231,76,60,0.08)',
                border: '1px solid rgba(231,76,60,0.18)',
              }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Leaderboard — only after user has played */}
        {hasResults && challenge?.already_played && (
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: springs.slide },
            }}
            className="rounded-card-lg bg-bg-base border border-border-default overflow-hidden shadow-card"
          >
            {/* Header row */}
            <div className="px-4 pt-4 pb-2.5 border-b border-border-subtle flex items-center gap-2">
              <Trophy size={13} style={{ color: 'var(--gold)' }} />
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary font-display">
                Leaderboard
              </span>
              <span className="ml-auto text-[10px] text-text-secondary tabular-nums">
                {results.length} {results.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1.5rem_1fr_5rem_4rem_5rem] gap-2 px-4 py-2 text-[10px] text-text-secondary uppercase tracking-wider border-b border-border-subtle">
              <span>#</span>
              <span>Player</span>
              <span className="text-center">Result</span>
              <span className="text-right">Guesses</span>
              <span className="text-right">Accuracy</span>
            </div>

            <div className="flex flex-col divide-y divide-border-subtle">
              {sortedResults.map((result, idx) => {
                const isMe = result.username === user?.username;
                const rank = idx + 1;

                return (
                  <motion.div
                    key={result.username}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05, ...springs.slide }}
                    className={clsx(
                      'grid grid-cols-[1.5rem_1fr_5rem_4rem_5rem] gap-2 px-4 py-3 items-center transition-colors',
                      isMe
                        ? 'bg-tile-correct/[0.05]'
                        : 'hover:bg-bg-elevated',
                    )}
                  >
                    {/* Rank */}
                    <span className="flex items-center">
                      <RankDisplay rank={rank} won={result.status === 'won'} />
                    </span>

                    {/* Username */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {result.is_creator && (
                        <Crown size={11} style={{ color: 'var(--gold)' }} className="shrink-0" />
                      )}
                      <span
                        className={clsx(
                          'text-sm font-medium truncate',
                          isMe ? 'text-text-primary' : 'text-text-secondary',
                        )}
                      >
                        {result.username}
                        {isMe && (
                          <span className="ml-1.5 text-[10px] text-text-secondary font-normal">
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
                        result.status === 'won' ? 'text-text-primary' : 'text-text-secondary',
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
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: springs.slide },
          }}
          className="rounded-card-lg bg-bg-base border border-border-subtle p-4 shadow-card"
        >
          <div className="flex items-center gap-2 mb-3">
            <Share2 size={13} className="text-text-secondary" />
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary font-display">
              Share Challenge
            </span>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 min-w-0 py-2 px-3 rounded-md bg-bg-elevated border border-border-subtle text-xs text-text-secondary font-mono truncate">
              {shareUrl}
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleCopyLink}
              className="shrink-0 px-3 py-2 rounded-md bg-bg-elevated border border-border-default hover:border-border-strong text-text-primary text-xs font-semibold transition-colors flex items-center gap-1.5"
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
