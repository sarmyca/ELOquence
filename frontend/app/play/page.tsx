'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun,
  Swords,
  FlaskConical,
  Flame,
  Star,
  Lock,
  Share2,
  Check,
  X,
  ArrowRight,
  LogIn,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { gamesApi, dailyApi, challengesApi } from '@/lib/api';
import { getRatingTier, patternToTiles, TileState } from '@/lib/types';
import { springs, stagger } from '@/lib/animations';
import clsx from 'clsx';

/** Returns ms until local midnight (server TZ matches client TZ). */
function msUntilMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime() - now.getTime();
}

function DailyCountdown({ onMidnight }: { onMidnight?: () => void }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    function update() {
      const diff = msUntilMidnight();
      if (diff <= 0) {
        onMidnight?.();
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [onMidnight]);

  return (
    <span className="text-xs font-mono tabular-nums" style={{ color: '#5c5c66' }}>
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

// Decorative mini wordle tile row used in the daily card
function MiniTileRow({ pattern }: { pattern: ('correct' | 'present' | 'absent')[] }) {
  const colorMap = {
    correct: '#538d4e',
    present: '#b59f3b',
    absent: '#3a3a3c',
  };
  return (
    <div className="flex gap-1">
      {pattern.map((state, i) => (
        <div
          key={i}
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ backgroundColor: colorMap[state] }}
        />
      ))}
    </div>
  );
}

export default function PlayPage() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [challengeCode, setChallengeCode] = useState<string | null>(null);
  const [challengeCopied, setChallengeCopied] = useState(false);
  const [dailyAlreadyPlayed, setDailyAlreadyPlayed] = useState(false);
  const [dailyGameId, setDailyGameId] = useState<string | null>(null);
  const [dailyPatterns, setDailyPatterns] = useState<TileState[][] | null>(null);
  const [dailyRated, setDailyRated] = useState(false);
  const [dailyRefreshKey, setDailyRefreshKey] = useState(0);

  const tier = user ? getRatingTier(user.elo_rating) : null;

  // Reset daily state at midnight so a new puzzle appears automatically
  const handleMidnight = useCallback(() => {
    setDailyAlreadyPlayed(false);
    setDailyGameId(null);
    setDailyPatterns(null);
    setDailyRated(false);
    // Bump key to re-run the daily status check effect
    setDailyRefreshKey((k) => k + 1);
  }, []);

  // Schedule a midnight refresh even when the countdown isn't visible
  useEffect(() => {
    const timer = setTimeout(handleMidnight, msUntilMidnight());
    return () => clearTimeout(timer);
  }, [handleMidnight, dailyRefreshKey]);

  // Refresh user data on mount so stats (games_played, ELO, etc.) are current
  useEffect(() => {
    refreshUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch user + daily status when the tab/page becomes visible again
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshUser();
        setDailyRefreshKey((k) => k + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshUser]);

  // Check if daily was already completed (as guest via localStorage, or as user via API)
  useEffect(() => {
    // Use local date string to match server TZ (Europe/Zagreb)
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (user) {
      // Authenticated user: check daily status via GET (read-only, doesn't create a game)
      dailyApi.get().then(async (res) => {
        if (res.data.already_played) {
          setDailyAlreadyPlayed(true);
          const gameId = res.data.existing_game_id;
          if (gameId) {
            setDailyGameId(gameId);
          }

          // Try localStorage first, then fall back to fetching the game
          const savedPatterns = localStorage.getItem(`eloquence_daily_patterns_${today}`);
          if (savedPatterns) {
            try {
              const nums: number[] = JSON.parse(savedPatterns);
              setDailyPatterns(nums.map((p) => patternToTiles(p)));
              return;
            } catch { /* ignore, fall through to API */ }
          }

          // No localStorage patterns — fetch from API
          if (gameId) {
            try {
              const gameRes = await gamesApi.get(gameId);
              const moves = gameRes.data.moves || [];
              if (moves.length > 0) {
                const sorted = [...moves].sort((a: { move_number: number }, b: { move_number: number }) => a.move_number - b.move_number);
                const pats = sorted.map((m: { pattern: number }) => patternToTiles(m.pattern));
                setDailyPatterns(pats);
                // Cache for next visit
                localStorage.setItem(`eloquence_daily_patterns_${today}`, JSON.stringify(sorted.map((m: { pattern: number }) => m.pattern)));
              }
            } catch { /* ignore */ }
          }
        } else {
          setDailyAlreadyPlayed(false);
          setDailyGameId(null);
          setDailyPatterns(null);
        }
      }).catch(() => {
        // Ignore
      });
    } else {
      // Guest: use localStorage only
      const guestPlayed = localStorage.getItem(`eloquence_daily_played_${today}`) === 'true';
      const savedPatterns = localStorage.getItem(`eloquence_daily_patterns_${today}`);
      const savedGameId = localStorage.getItem(`eloquence_daily_game_id_${today}`);

      if (savedPatterns) {
        try {
          const nums: number[] = JSON.parse(savedPatterns);
          setDailyPatterns(nums.map((p) => patternToTiles(p)));
        } catch { /* ignore */ }
      }
      if (savedGameId) {
        setDailyGameId(savedGameId);
      }
      if (guestPlayed) {
        setDailyAlreadyPlayed(true);
      }
    }
  }, [user, dailyRefreshKey]);

  const modes: ModeCard[] = [
    {
      id: 'daily',
      icon: <Sun size={22} />,
      title: 'Daily',
      subtitle: "Today's Puzzle",
      desc: 'One word per day. Play against the community.',
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
      subtitle: user ? `${Math.round(user.elo_rating)} ELO` : 'Rated',
      desc: 'Random words from the full pool. ELO stakes.',
      accentColor: tier?.color || '#818384',
      borderColor: `${tier?.color || '#818384'}40`,
      requiresAuth: true,
      tag: user?.is_placement ? `Placement ${user.games_played + 1}/5` : undefined,
    },
    {
      id: 'practice',
      icon: <FlaskConical size={22} />,
      title: 'Practice',
      subtitle: 'Unrated',
      desc: 'Hone your skills with no ELO consequences.',
      accentColor: '#9898a0',
      borderColor: 'rgba(152,152,160,0.2)',
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

    // If daily already played or in-progress, navigate to the saved game
    if (modeId === 'daily' && (dailyAlreadyPlayed || dailyGameId)) {
      if (user) {
        // For authenticated users, call play() which returns the existing game
        setCreating(modeId);
        try {
          const res = await dailyApi.play();
          const gid = res.data.id || res.data.game_id;
          if (gid) router.push(`/game/${gid}`);
        } catch { /* ignore */ }
        setCreating(null);
        return;
      } else if (dailyGameId) {
        router.push(`/game/${dailyGameId}`);
        return;
      }
    }

    setCreating(modeId);
    try {
      let gameId: string;

      if (modeId === 'daily') {
        const res = user
          ? await dailyApi.play(dailyRated && !user.is_placement)
          : await dailyApi.guest();
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
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(83,141,78,0.3)', borderTopColor: '#538d4e' }}
        />
      </div>
    );
  }

  // ── Shared challenge modal ────────────────────────────────────────────────────
  const challengeModal = (
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
              className="w-full max-w-sm rounded-2xl border border-white/[0.10] shadow-2xl overflow-hidden"
              style={{ backgroundColor: '#1d1d21' }}
            >
              <div className="h-1.5 w-full bg-gradient-to-r from-[#538d4e] to-[#6aaa64]" />
              <div className="p-6 flex flex-col gap-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl border flex items-center justify-center"
                      style={{
                        backgroundColor: 'rgba(83,141,78,0.10)',
                        borderColor: 'rgba(83,141,78,0.20)',
                      }}
                    >
                      <Swords size={20} style={{ color: '#6aaa64' }} />
                    </div>
                    <div>
                      <h2 className="text-base font-bold" style={{ color: '#ededf0' }}>
                        Challenge Created!
                      </h2>
                      <p className="text-xs mt-0.5" style={{ color: '#9898a0' }}>
                        Share the link with a friend
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setChallengeCode(null)}
                    className="p-1.5 rounded-md transition-colors"
                    style={{ color: '#5c5c66' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = '#ededf0';
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = '#5c5c66';
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                    }}
                    aria-label="Close challenge modal"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Share link */}
                <div className="flex gap-2">
                  <div
                    className="flex-1 min-w-0 py-2 px-3 rounded-lg border text-xs font-mono truncate"
                    style={{
                      backgroundColor: '#25252a',
                      borderColor: 'rgba(255,255,255,0.08)',
                      color: '#5c5c66',
                    }}
                  >
                    {typeof window !== 'undefined'
                      ? `${window.location.origin}/challenge/${challengeCode}`
                      : `/challenge/${challengeCode}`}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopyChallengeLink}
                    className="shrink-0 px-3 py-2 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5"
                    style={{
                      backgroundColor: '#25252a',
                      borderColor: 'rgba(255,255,255,0.08)',
                      color: '#ededf0',
                    }}
                  >
                    {challengeCopied ? (
                      <>
                        <Check size={13} style={{ color: '#6aaa64' }} />
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
                    className="w-full py-2.5 rounded-xl text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#538d4e' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#6aaa64';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#538d4e';
                    }}
                  >
                    <ArrowRight size={15} />
                    Play it yourself first
                  </motion.button>
                  <button
                    onClick={() => setChallengeCode(null)}
                    className="text-xs text-center py-1 transition-colors"
                    style={{ color: '#5c5c66' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = '#9898a0';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = '#5c5c66';
                    }}
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
  );

  // ── GUEST VIEW ────────────────────────────────────────────────────────────────
  if (!user) {
    const dailyMode = modes[0];
    const lockedModes = modes.slice(1);
    const isDailyLoading = creating === 'daily';

    return (
      <div
        className="flex flex-col items-center justify-center min-h-[calc(100dvh-56px)] px-4"
        style={{ paddingTop: '2.5rem', paddingBottom: '5rem' }}
      >
        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 text-sm rounded-lg px-4 py-2"
              style={{
                color: '#e74c3c',
                backgroundColor: 'rgba(231,76,60,0.10)',
                border: '1px solid rgba(231,76,60,0.20)',
              }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: stagger.medium },
          }}
          className="w-full max-w-md flex flex-col gap-4"
        >
          {/* ── Hero daily card ── */}
          <motion.button
            variants={{
              hidden: { opacity: 0, y: 28 },
              visible: { opacity: 1, y: 0, transition: springs.slide },
            }}
            whileHover={isDailyLoading || !!creating ? {} : { scale: 1.01 }}
            whileTap={isDailyLoading || !!creating ? {} : { scale: 0.98 }}
            onClick={() => handleModeSelect('daily')}
            disabled={!!creating}
            className="group relative w-full flex flex-col gap-4 text-left rounded-[12px] border transition-all duration-200 cursor-pointer"
            style={{
              backgroundColor: '#171719',
              borderColor: 'rgba(255,255,255,0.06)',
              padding: '1.25rem',
            }}
            onMouseEnter={(e) => {
              if (!creating) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.09)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 24px rgba(83,141,78,0.08)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.06)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
            }}
          >
            {/* Top row: icon + title + free badge */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Icon container */}
                <div
                  className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor: 'rgba(83,141,78,0.10)',
                    color: '#6aaa64',
                  }}
                >
                  {isDailyLoading ? (
                    <div
                      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                      style={{
                        borderColor: 'rgba(106,170,100,0.30)',
                        borderTopColor: '#6aaa64',
                      }}
                    />
                  ) : (
                    <Sun size={20} />
                  )}
                </div>
                {/* Title block */}
                <div>
                  <h2
                    className="text-lg font-bold leading-tight"
                    style={{ color: '#ededf0' }}
                  >
                    Daily Puzzle
                  </h2>
                  <p className="text-xs font-mono" style={{ color: '#6aaa64' }}>
                    Today&apos;s Word
                  </p>
                </div>
              </div>

              {/* Free badge — only when not yet played */}
              {!dailyAlreadyPlayed && (
                <span
                  className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide border"
                  style={{
                    color: '#6aaa64',
                    backgroundColor: 'rgba(83,141,78,0.10)',
                    borderColor: 'rgba(83,141,78,0.20)',
                  }}
                >
                  Free
                </span>
              )}
            </div>

            {/* Mini tile patterns — only shown when the user has already played */}
            {dailyPatterns && (
              <div className="flex flex-col gap-1.5 py-0.5">
                {dailyPatterns.map((row, i) => (
                  <MiniTileRow key={i} pattern={row as ('correct' | 'present' | 'absent')[]} />
                ))}
              </div>
            )}

            {/* Description */}
            <p className="text-sm leading-relaxed" style={{ color: '#9898a0' }}>
              One word per day, shared across the community. No account needed.
            </p>

            {/* CTA row */}
            {dailyAlreadyPlayed ? (
              <div className="flex items-center justify-between">
                <DailyCountdown onMidnight={handleMidnight} />
                <div
                  className="flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: '#6aaa64' }}
                >
                  View your game
                  <ArrowRight size={13} />
                </div>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 text-sm font-semibold"
                style={{ color: '#6aaa64' }}
              >
                {dailyPatterns ? 'Continue' : 'Play now'}
                <ArrowRight size={14} />
              </div>
            )}
          </motion.button>

          {/* ── Locked secondary cards ── */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: springs.slide },
            }}
            className="grid grid-cols-2 gap-3"
          >
            {lockedModes.map((mode) => (
              <motion.button
                key={mode.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push('/login')}
                className="relative flex flex-col gap-3 p-4 rounded-[12px] border text-left transition-all duration-200 cursor-pointer"
                style={{
                  backgroundColor: '#171719',
                  borderColor: 'rgba(255,255,255,0.06)',
                  opacity: 0.55,
                }}
              >
                {/* Icon row + lock indicator */}
                <div className="flex items-center justify-between">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{
                      color: mode.accentColor,
                      backgroundColor: `${mode.accentColor}18`,
                    }}
                  >
                    {mode.icon}
                  </div>
                  <Lock size={12} style={{ color: '#5c5c66' }} />
                </div>

                <div>
                  <h3 className="text-sm font-bold" style={{ color: '#ededf0' }}>
                    {mode.title}
                  </h3>
                  <p
                    className="text-[11px] font-mono mt-0.5"
                    style={{ color: mode.accentColor }}
                  >
                    {mode.subtitle}
                  </p>
                </div>

                <p className="text-xs leading-relaxed" style={{ color: '#5c5c66' }}>
                  {mode.desc}
                </p>
              </motion.button>
            ))}
          </motion.div>

          {/* ── Sign-in nudge ── */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 12 },
              visible: { opacity: 1, y: 0, transition: springs.slide },
            }}
            className="flex flex-col items-center gap-3 pt-1"
          >
            <p className="text-xs text-center" style={{ color: '#5c5c66' }}>
              Sign in to unlock all modes and track your ELO rating
            </p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push('/login')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-colors"
              style={{ backgroundColor: '#538d4e' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#6aaa64';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#538d4e';
              }}
            >
              <LogIn size={14} />
              Sign in
            </motion.button>
          </motion.div>
        </motion.div>

        {challengeModal}
      </div>
    );
  }

  // ── AUTHENTICATED VIEW ────────────────────────────────────────────────────────
  const dailyMode = modes[0];
  const otherModes = modes.slice(1);
  const isDailyLoading = creating === 'daily';

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[calc(100dvh-56px)] px-4"
      style={{ paddingTop: '2.5rem', paddingBottom: '5rem' }}
    >
      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-6 text-sm rounded-lg px-4 py-2"
            style={{
              color: '#e74c3c',
              backgroundColor: 'rgba(231,76,60,0.10)',
              border: '1px solid rgba(231,76,60,0.20)',
            }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: stagger.medium },
        }}
        className="w-full max-w-md flex flex-col gap-4"
      >
        {/* ── User stats bar ── */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            visible: { opacity: 1, y: 0, transition: springs.slide },
          }}
          className="flex items-center gap-3 justify-center"
        >
          <span
            className="text-2xl font-bold font-mono tabular-nums"
            style={{ color: tier?.color }}
          >
            {Math.round(user.elo_rating)}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              color: tier?.color,
              backgroundColor: `${tier?.color}1a`,
            }}
          >
            {tier?.name}
          </span>
          <span className="text-xs" style={{ color: '#5c5c66' }}>
            {user.username}
          </span>
          {user.current_streak > 0 && (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium"
              style={{ color: '#e67e22' }}
            >
              <Flame size={11} />
              {user.current_streak}
            </span>
          )}
        </motion.div>

        {/* ── Hero daily card ── */}
        <motion.button
          variants={{
            hidden: { opacity: 0, y: 28 },
            visible: { opacity: 1, y: 0, transition: springs.slide },
          }}
          whileHover={isDailyLoading || !!creating ? {} : { scale: 1.01 }}
          whileTap={isDailyLoading || !!creating ? {} : { scale: 0.98 }}
          onClick={() => handleModeSelect('daily')}
          disabled={!!creating}
          className="group relative w-full flex flex-col gap-4 text-left rounded-[12px] border transition-all duration-200 cursor-pointer"
          style={{
            backgroundColor: '#171719',
            borderColor: 'rgba(255,255,255,0.06)',
            padding: '1.25rem',
          }}
          onMouseEnter={(e) => {
            if (!creating) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.09)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 24px rgba(83,141,78,0.08)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.06)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
          }}
        >
          {/* Top row: icon + title + streak tag */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Icon container */}
              <div
                className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor: 'rgba(83,141,78,0.10)',
                  color: '#6aaa64',
                }}
              >
                {isDailyLoading ? (
                  <div
                    className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{
                      borderColor: 'rgba(106,170,100,0.30)',
                      borderTopColor: '#6aaa64',
                    }}
                  />
                ) : (
                  <Sun size={20} />
                )}
              </div>
              {/* Title block */}
              <div>
                <h2
                  className="text-lg font-bold leading-tight"
                  style={{ color: '#ededf0' }}
                >
                  Daily Puzzle
                </h2>
                <p className="text-xs font-mono" style={{ color: '#6aaa64' }}>
                  Today&apos;s Word
                </p>
              </div>
            </div>

            {/* Streak tag — shown when the user has a streak */}
            {dailyMode.tag && (
              <span
                className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold border"
                style={{
                  color: '#e67e22',
                  backgroundColor: 'rgba(230,126,34,0.10)',
                  borderColor: 'rgba(230,126,34,0.20)',
                }}
              >
                {dailyMode.tag}
              </span>
            )}

            {/* Free badge when no streak tag and not played */}
            {!dailyMode.tag && !dailyAlreadyPlayed && (
              <span
                className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold border"
                style={{
                  color: '#6aaa64',
                  backgroundColor: 'rgba(83,141,78,0.10)',
                  borderColor: 'rgba(83,141,78,0.20)',
                }}
              >
                Free
              </span>
            )}
          </div>

          {/* Mini tile patterns — only shown when the user has actually played */}
          {dailyPatterns && (
            <div className="flex flex-col gap-1.5 py-0.5">
              {dailyPatterns.map((row, i) => (
                <MiniTileRow key={i} pattern={row as ('correct' | 'present' | 'absent')[]} />
              ))}
            </div>
          )}

          {/* Description */}
          <p className="text-sm leading-relaxed" style={{ color: '#9898a0' }}>
            One word per day. Play against the community.
          </p>

          {/* Rated toggle — only visible after placements are done */}
          {!dailyAlreadyPlayed && user && !user.is_placement && (
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                role="switch"
                aria-checked={dailyRated}
                onClick={(e) => {
                  e.stopPropagation();
                  setDailyRated(!dailyRated);
                }}
                className={clsx(
                  'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
                  dailyRated ? 'bg-[#538d4e]' : 'bg-white/[0.12]'
                )}
              >
                <span
                  className={clsx(
                    'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200',
                    dailyRated ? 'translate-x-4' : 'translate-x-0'
                  )}
                />
              </button>
              <span className="text-xs" style={{ color: '#9898a0' }}>
                {dailyRated ? 'Rated — ELO at stake' : 'Unrated'}
              </span>
            </div>
          )}

          {/* CTA row */}
          {dailyAlreadyPlayed ? (
            <div className="flex items-center justify-between">
              <DailyCountdown onMidnight={handleMidnight} />
              <div
                className="flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: '#6aaa64' }}
              >
                View your game
                <ArrowRight size={13} />
              </div>
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: '#6aaa64' }}
            >
              Play now
              <ArrowRight size={14} />
            </div>
          )}
        </motion.button>

        {/* ── Competitive & Practice cards ── */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: springs.slide },
          }}
          className="grid grid-cols-2 gap-3"
        >
          {otherModes.map((mode) => {
            const isLoading = creating === mode.id;
            return (
              <motion.button
                key={mode.id}
                whileHover={isLoading || !!creating ? {} : { scale: 1.01 }}
                whileTap={isLoading || !!creating ? {} : { scale: 0.98 }}
                onClick={() => handleModeSelect(mode.id)}
                disabled={!!creating}
                className="relative flex flex-col gap-3 p-4 rounded-[12px] border text-left transition-all duration-200 cursor-pointer disabled:opacity-70"
                style={{
                  backgroundColor: '#171719',
                  borderColor: 'rgba(255,255,255,0.06)',
                }}
                onMouseEnter={(e) => {
                  if (!creating) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.09)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.06)';
                }}
              >
                {/* Placement / mode tag */}
                {mode.tag && (
                  <span
                    className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full font-medium"
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
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{
                    color: mode.accentColor,
                    backgroundColor: `${mode.accentColor}18`,
                  }}
                >
                  {isLoading ? (
                    <div
                      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                      style={{
                        borderColor: `${mode.accentColor}40`,
                        borderTopColor: mode.accentColor,
                      }}
                    />
                  ) : (
                    mode.icon
                  )}
                </div>

                {/* Title + subtitle */}
                <div>
                  <h3 className="text-sm font-bold" style={{ color: '#ededf0' }}>
                    {mode.title}
                  </h3>
                  <p
                    className="text-[11px] font-mono mt-0.5"
                    style={{ color: mode.accentColor }}
                  >
                    {mode.subtitle}
                  </p>
                </div>

                {/* Description */}
                <p className="text-xs leading-relaxed" style={{ color: '#9898a0' }}>
                  {mode.desc}
                </p>
              </motion.button>
            );
          })}
        </motion.div>

        {/* ── Challenge a Friend ── */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0, transition: springs.slide },
          }}
        >
          <button
            onClick={handleCreateChallenge}
            disabled={creatingChallenge || !!creating}
            className="w-full py-2.5 rounded-[12px] border text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              backgroundColor: '#171719',
              borderColor: 'rgba(255,255,255,0.06)',
              color: '#9898a0',
            }}
            onMouseEnter={(e) => {
              if (!creatingChallenge && !creating) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.10)';
                (e.currentTarget as HTMLButtonElement).style.color = '#ededf0';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.06)';
              (e.currentTarget as HTMLButtonElement).style.color = '#9898a0';
            }}
          >
            {creatingChallenge ? (
              <>
                <div
                  className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                  style={{
                    borderColor: 'rgba(152,152,160,0.30)',
                    borderTopColor: '#9898a0',
                  }}
                />
                Creating...
              </>
            ) : (
              <>
                <Swords size={15} />
                Challenge a Friend
              </>
            )}
          </button>
        </motion.div>
      </motion.div>

      {challengeModal}

      {/* ── Rating tiers reference ── */}
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
    </div>
  );
}
