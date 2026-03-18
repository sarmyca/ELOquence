'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Swords, FlaskConical, Flame, Star, Lock, Share2, Check, X, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { gamesApi, dailyApi, challengesApi } from '@/lib/api';
import { getRatingTier } from '@/lib/types';
import { springs, stagger } from '@/lib/animations';
import clsx from 'clsx';

function DailyCountdown() {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    function update() {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="text-xs font-mono text-text-ghost tabular-nums">
      Next puzzle in {timeLeft}
    </span>
  );
}

interface ModeCard {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  desc: string;
  accentColor: string;
  borderColor: string;
  requiresAuth: boolean;
  tag?: string;
}

export default function PlayPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [challengeCode, setChallengeCode] = useState<string | null>(null);
  const [challengeCopied, setChallengeCopied] = useState(false);
  const [dailyAlreadyPlayed, setDailyAlreadyPlayed] = useState(false);

  const tier = user ? getRatingTier(user.elo_rating) : null;

  // Check if authenticated user already completed today's daily
  useEffect(() => {
    if (!user) return;
    dailyApi.play().then((res) => {
      // If the returned game is not in_progress, the daily was already completed
      if (res.data.status && res.data.status !== 'in_progress') {
        setDailyAlreadyPlayed(true);
      }
    }).catch(() => {
      // Ignore — treat as not yet played or unavailable
    });
  }, [user]);

  const modes: ModeCard[] = [
    {
      id: 'daily',
      icon: <Sun size={22} />,
      title: 'Daily',
      subtitle: "Today's Puzzle",
      desc: 'One word per day. Race against the community.',
      accentColor: '#6aaa64',
      borderColor: 'rgba(106,170,100,0.25)',
      requiresAuth: false,
      tag: user?.current_streak
        ? `${user.current_streak} day streak`
        : undefined,
    },
    {
      id: 'competitive',
      icon: <Swords size={22} />,
      title: 'Competitive',
      subtitle: user ? `${user.elo_rating} ELO` : 'Rated',
      desc: 'Random words from the full pool. ELO stakes.',
      accentColor: tier?.color || '#818384',
      borderColor: `${tier?.color || '#818384'}40`,
      requiresAuth: true,
      tag: user?.is_placement ? 'Placement' : undefined,
    },
    {
      id: 'practice',
      icon: <FlaskConical size={22} />,
      title: 'Practice',
      subtitle: 'Unrated',
      desc: 'Hone your skills with no ELO consequences.',
      accentColor: '#9ba1a6',
      borderColor: 'rgba(155,161,166,0.2)',
      requiresAuth: true,
    },
  ];

  const handleModeSelect = async (modeId: string) => {
    if (creating) return;
    setError('');

    if ((modeId === 'competitive' || modeId === 'practice') && !user) {
      router.push('/login');
      return;
    }

    setCreating(modeId);
    try {
      let gameId: string;

      if (modeId === 'daily') {
        const res = user
          ? await dailyApi.play()
          : await dailyApi.get();
        gameId = res.data.id || res.data.game_id;
        // If daily returns existing game, go to review; else go to game
        if (res.data.status && res.data.status !== 'in_progress') {
          router.push(`/review/${gameId}`);
          return;
        }
      } else {
        const res = await gamesApi.create({
          mode: modeId,
          word_pool: modeId === 'competitive' ? 'competitive' : 'standard',
        });
        gameId = res.data.id;
      }

      router.push(`/game/${gameId}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Could not start game. Please try again.';
      setError(msg);
      setCreating(null);
    }
  };

  const handleCreateChallenge = async () => {
    if (!user || creatingChallenge) return;
    setCreatingChallenge(true);
    setError('');
    try {
      const res = await challengesApi.create();
      setChallengeCode(res.data.code);
    } catch {
      setError('Could not create challenge. Please try again.');
    } finally {
      setCreatingChallenge(false);
    }
  };

  const handleCopyChallengeLink = async () => {
    if (!challengeCode) return;
    const url = `${window.location.origin}/challenge/${challengeCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setChallengeCopied(true);
      setTimeout(() => setChallengeCopied(false), 2000);
    } catch {
      // Fallback: do nothing
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
        <div className="w-6 h-6 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-[calc(100dvh-56px)] px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.slide}
        className="text-center mb-10"
      >
        {user ? (
          <>
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-3xl font-bold font-mono" style={{ color: tier?.color }}>
                {user.elo_rating}
              </span>
              <span
                className="text-sm px-2.5 py-1 rounded-full font-medium"
                style={{ color: tier?.color, backgroundColor: `${tier?.color}1a` }}
              >
                {tier?.name}
              </span>
            </div>
            <p className="text-text-secondary text-sm">
              {user.username} &middot; {user.games_played} games played
            </p>
            {user.current_streak > 0 && (
              <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-[#e67e22]/10 border border-[#e67e22]/20 text-[#e67e22] text-xs font-medium">
                <Flame size={12} />
                {user.current_streak} day streak
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-text-primary mb-1">Choose your mode</h1>
            <p className="text-text-secondary text-sm">Play as guest or sign in for rated games.</p>
          </>
        )}
      </motion.div>

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 text-sm text-[#e74c3c] bg-[#e74c3c]/10 border border-[#e74c3c]/20 rounded-lg px-4 py-2"
        >
          {error}
        </motion.p>
      )}

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: stagger.medium },
        }}
      >
        {modes.map((mode) => {
          const isLocked = mode.requiresAuth && !user;
          const isLoading = creating === mode.id;

          return (
            <motion.button
              key={mode.id}
              variants={{
                hidden: { opacity: 0, y: 24 },
                visible: { opacity: 1, y: 0, transition: springs.slide },
              }}
              whileHover={{ scale: isLoading || creating ? 1 : 1.02 }}
              whileTap={{ scale: isLoading || creating ? 1 : 0.97 }}
              onClick={() => handleModeSelect(mode.id)}
              disabled={!!creating}
              className={clsx(
                'relative flex flex-col gap-4 p-6 rounded-2xl border text-left transition-all duration-150 disabled:opacity-70',
                'bg-bg-secondary hover:bg-bg-tertiary'
              )}
              style={{ borderColor: mode.borderColor }}
            >
              {/* Tag */}
              {mode.tag && (
                <span
                  className="absolute top-4 right-4 text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{
                    color: mode.accentColor,
                    backgroundColor: `${mode.accentColor}22`,
                  }}
                >
                  {mode.tag}
                </span>
              )}

              {/* Icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  color: mode.accentColor,
                  backgroundColor: `${mode.accentColor}1a`,
                }}
              >
                {isLoading ? (
                  <div
                    className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: `${mode.accentColor}40`, borderTopColor: mode.accentColor }}
                  />
                ) : (
                  mode.icon
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-text-primary">{mode.title}</h2>
                  {isLocked && (
                    <Lock size={12} className="text-text-ghost" />
                  )}
                </div>
                <p className="text-xs font-mono" style={{ color: mode.accentColor }}>
                  {mode.subtitle}
                </p>
              </div>

              <p className="text-sm text-text-secondary leading-relaxed">{mode.desc}</p>

              {/* Daily already played — show countdown */}
              {mode.id === 'daily' && dailyAlreadyPlayed && (
                <DailyCountdown />
              )}

              {/* Locked overlay hint */}
              {isLocked && (
                <p className="text-xs text-text-ghost">Sign in to play rated games</p>
              )}
            </motion.button>
          );
        })}
      </motion.div>

      {/* Challenge a Friend */}
      {user && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 w-full max-w-3xl"
        >
          <button
            onClick={handleCreateChallenge}
            disabled={!user || creatingChallenge || !!creating}
            className="w-full py-3 rounded-xl bg-bg-secondary border border-white/[0.08] hover:border-white/[0.14] text-text-secondary hover:text-text-primary disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm font-medium"
          >
            {creatingChallenge ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-text-ghost/40 border-t-text-ghost animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Swords size={16} />
                Challenge a Friend
              </>
            )}
          </button>
        </motion.div>
      )}

      {/* Challenge created modal */}
      <AnimatePresence>
        {challengeCode && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setChallengeCode(null)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 16 }}
                transition={springs.modal}
                className="w-full max-w-sm bg-bg-secondary rounded-2xl border border-white/[0.1] shadow-2xl overflow-hidden"
              >
                <div className="h-1.5 w-full bg-gradient-to-r from-[#538d4e] to-[#6aaa64]" />
                <div className="p-6 flex flex-col gap-5">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#538d4e]/10 border border-[#538d4e]/20 flex items-center justify-center">
                        <Swords size={20} className="text-[#6aaa64]" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-text-primary">Challenge Created!</h2>
                        <p className="text-xs text-text-secondary mt-0.5">Share the link with a friend</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setChallengeCode(null)}
                      className="p-1.5 rounded-md text-text-ghost hover:text-text-primary hover:bg-white/[0.06] transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Share link */}
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0 py-2 px-3 rounded-lg bg-bg-tertiary border border-white/[0.08] text-xs text-text-ghost font-mono truncate">
                      {typeof window !== 'undefined'
                        ? `${window.location.origin}/challenge/${challengeCode}`
                        : `/challenge/${challengeCode}`}
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleCopyChallengeLink}
                      className="shrink-0 px-3 py-2 rounded-lg bg-bg-elevated hover:bg-white/[0.1] border border-white/[0.08] text-text-primary text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                      {challengeCopied ? (
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

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => router.push(`/challenge/${challengeCode}`)}
                      className="w-full py-2.5 rounded-xl bg-[#538d4e] hover:bg-[#6aaa64] text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <ArrowRight size={15} />
                      Play it yourself first
                    </motion.button>
                    <button
                      onClick={() => setChallengeCode(null)}
                      className="text-xs text-text-ghost hover:text-text-secondary transition-colors text-center py-1"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Rating tiers reference */}
      {user && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 flex items-center gap-3 flex-wrap justify-center"
        >
          {[
            { name: 'Novice', color: '#818384' },
            { name: 'Veteran', color: '#b59f3b' },
            { name: 'Master', color: '#6aaa64' },
            { name: 'Grandmaster', color: '#1565c0' },
          ].map((t) => (
            <div key={t.name} className="flex items-center gap-1.5">
              <Star size={10} style={{ color: t.color }} fill={t.color} />
              <span className="text-xs" style={{ color: t.color }}>
                {t.name}
              </span>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
