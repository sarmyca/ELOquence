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
    <span className="text-xs font-mono tabular-nums text-text-secondary">
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
  requiresAuth: boolean;
  tag?: string;
}

// Decorative mini wordle tile row — uses CSS vars via inline style
function MiniTileRow({ pattern }: { pattern: ('correct' | 'present' | 'absent')[] }) {
  return (
    <div className="flex gap-1">
      {pattern.map((state, i) => (
        <div
          key={i}
          className="w-6 h-6 rounded-sm"
          style={{
            backgroundColor:
              state === 'correct'
                ? 'var(--tile-correct)'
                : state === 'present'
                ? 'var(--tile-present)'
                : 'var(--tile-absent)',
          }}
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
  // Daily is always unrated — only competitive affects ELO
  const [dailyGameId, setDailyGameId] = useState<string | null>(null);
  const [dailyPatterns, setDailyPatterns] = useState<TileState[][] | null>(null);
  const [dailyRefreshKey, setDailyRefreshKey] = useState(0);

  const tier = user ? getRatingTier(user.elo_rating) : null;

  // Reset daily state at midnight so a new puzzle appears automatically
  const handleMidnight = useCallback(() => {
    setDailyAlreadyPlayed(false);
    setDailyGameId(null);
    setDailyPatterns(null);
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
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (user) {
      // Paint from cache immediately to avoid a flash, then always refresh
      // from the API so the card reflects the latest move count (e.g.,
      // after a 6th guess submitted from the game page).
      const savedPatterns = localStorage.getItem(`eloquence_daily_patterns_${today}`);
      if (savedPatterns) {
        try {
          const nums: number[] = JSON.parse(savedPatterns);
          setDailyPatterns(nums.map((p) => patternToTiles(p)));
        } catch { /* ignore, API will populate */ }
      }

      dailyApi.get().then(async (res) => {
        if (res.data.already_played) {
          setDailyAlreadyPlayed(true);
          const gameId = res.data.existing_game_id;
          if (gameId) {
            setDailyGameId(gameId);
            try {
              const gameRes = await gamesApi.get(gameId);
              const moves = gameRes.data.moves || [];
              if (moves.length > 0) {
                const sorted = [...moves].sort((a: { move_number: number }, b: { move_number: number }) => a.move_number - b.move_number);
                const pats = sorted.map((m: { pattern: number }) => patternToTiles(m.pattern));
                setDailyPatterns(pats);
                localStorage.setItem(
                  `eloquence_daily_patterns_${today}`,
                  JSON.stringify(sorted.map((m: { pattern: number }) => m.pattern)),
                );
              } else {
                setDailyPatterns(null);
                localStorage.removeItem(`eloquence_daily_patterns_${today}`);
              }
            } catch { /* ignore — keep cached paint */ }
          }
        } else {
          setDailyAlreadyPlayed(false);
          setDailyGameId(null);
          setDailyPatterns(null);
          // Clear any stale per-date cache so old patterns don't bleed through
          localStorage.removeItem(`eloquence_daily_patterns_${today}`);
        }
      }).catch(() => {
        // Ignore
      });
    } else {
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
      icon: <Sun size={20} />,
      title: 'Daily',
      subtitle: "Today's Puzzle",
      desc: 'One word per day. Play against the community.',
      accentColor: 'var(--tile-correct)',
      requiresAuth: false,
      tag: user?.current_streak
        ? `${user.current_streak} day streak`
        : undefined,
    },
    {
      id: 'competitive',
      icon: <Swords size={20} />,
      title: 'Competitive',
      subtitle: user ? `${Math.round(user.elo_rating)} ELO` : 'Rated',
      desc: 'Random words from the full pool. ELO stakes.',
      accentColor: tier?.color || 'var(--text-secondary)',
      requiresAuth: true,
      tag: user?.is_placement ? `Placement ${user.games_played}/5` : undefined,
    },
    {
      id: 'practice',
      icon: <FlaskConical size={20} />,
      title: 'Practice',
      subtitle: 'Unrated',
      desc: 'Hone your skills with no ELO consequences.',
      accentColor: 'var(--text-secondary)',
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

    if (modeId === 'daily' && (dailyAlreadyPlayed || dailyGameId)) {
      if (user) {
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
          ? await dailyApi.play()
          : await dailyApi.guest();
        gameId = res.data.id || res.data.game_id;
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
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin border-tile-correct" />
      </div>
    );
  }

  // ── Challenge modal ───────────────────────────────────────────────────────────
  const challengeModal = (
    <AnimatePresence>
      {challengeCode && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setChallengeCode(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={springs.modal}
              className="w-full max-w-sm rounded-card-lg border border-border-default bg-bg-base shadow-modal overflow-hidden"
            >
              {/* Wordle-green top rule */}
              <div className="h-[3px] w-full bg-tile-correct" />
              <div className="p-6 flex flex-col gap-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-card border border-border-subtle bg-bg-elevated flex items-center justify-center">
                      <Swords size={18} className="text-tile-correct" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold font-display text-text-primary">
                        Challenge Created!
                      </h2>
                      <p className="text-xs mt-0.5 text-text-secondary">
                        Share the link with a friend
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setChallengeCode(null)}
                    className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-muted transition-colors"
                    aria-label="Close challenge modal"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Share link */}
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0 py-2 px-3 rounded-md border border-border-subtle bg-bg-elevated text-xs font-mono text-text-secondary truncate">
                    {typeof window !== 'undefined'
                      ? `${window.location.origin}/challenge/${challengeCode}`
                      : `/challenge/${challengeCode}`}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopyChallengeLink}
                    className="shrink-0 px-3 py-2 rounded-md border border-border-default bg-bg-elevated text-xs font-medium text-text-primary hover:border-border-strong transition-colors flex items-center gap-1.5"
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
                    className="w-full py-2.5 rounded-card bg-tile-correct text-white font-semibold text-sm uppercase tracking-wider hover:brightness-110 transition-[filter,transform] active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <ArrowRight size={15} />
                    Play it yourself first
                  </motion.button>
                  <button
                    onClick={() => setChallengeCode(null)}
                    className="text-xs text-center py-1 text-text-secondary hover:text-text-primary transition-colors"
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
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-md mb-8"
        >
          <h1 className="font-display font-black text-4xl tracking-tight text-text-primary">
            Play
          </h1>
          <p className="font-sans text-base text-text-secondary mt-2">
            One word per day — or practice anytime.
          </p>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 text-sm rounded-card px-4 py-2 w-full max-w-md"
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
              hidden: { opacity: 0, y: 24 },
              visible: { opacity: 1, y: 0, transition: springs.slide },
            }}
            whileHover={isDailyLoading || !!creating ? {} : { y: -1.5 }}
            whileTap={isDailyLoading || !!creating ? {} : { scale: 0.99 }}
            onClick={() => handleModeSelect('daily')}
            disabled={!!creating}
            className="group relative w-full flex flex-col gap-4 text-left rounded-card-lg border-2 border-border-default bg-bg-base p-6 hover:border-tile-correct transition-colors shadow-card hover:shadow-card-hover cursor-pointer"
          >
            {/* Top row: icon + title + free badge */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-card border border-border-subtle bg-bg-elevated flex items-center justify-center text-tile-correct">
                  {isDailyLoading ? (
                    <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin border-tile-correct" />
                  ) : (
                    <Sun size={20} />
                  )}
                </div>
                <div>
                  <h2 className="font-display font-bold text-xl text-text-primary leading-tight">
                    Daily Puzzle
                  </h2>
                  <p className="font-sans text-sm text-tile-correct">
                    Today&apos;s Word
                  </p>
                </div>
              </div>

              {!dailyAlreadyPlayed && (
                <span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-pill font-semibold tracking-wide border border-tile-correct/30 text-tile-correct bg-tile-correct/8">
                  Free
                </span>
              )}
            </div>

            {/* Mini tile patterns */}
            {dailyPatterns && (
              <div className="flex flex-col gap-1.5 py-0.5">
                {dailyPatterns.map((row, i) => (
                  <MiniTileRow key={i} pattern={row as ('correct' | 'present' | 'absent')[]} />
                ))}
              </div>
            )}

            {/* Description */}
            <p className="font-sans text-sm leading-relaxed text-text-secondary">
              One word per day, shared across the community. No account needed.
            </p>

            {/* CTA row */}
            {dailyAlreadyPlayed ? (
              <div className="flex items-center justify-between">
                <DailyCountdown onMidnight={handleMidnight} />
                <div className="flex items-center gap-1.5 text-xs font-semibold text-tile-correct">
                  View your game
                  <ArrowRight size={13} />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-sm font-semibold text-tile-correct">
                {dailyPatterns ? 'Continue' : 'Play now'}
                <ArrowRight size={14} />
              </div>
            )}
          </motion.button>

          {/* ── Locked secondary cards ── */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0, transition: springs.slide },
            }}
            className="grid grid-cols-2 gap-3"
          >
            {lockedModes.map((mode) => (
              <motion.button
                key={mode.id}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => router.push('/login')}
                className="relative flex flex-col gap-3 p-4 rounded-card-lg border border-border-subtle bg-bg-base text-left transition-colors opacity-50 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div
                    className="w-9 h-9 rounded-card border border-border-subtle bg-bg-elevated flex items-center justify-center"
                    style={{ color: mode.accentColor }}
                  >
                    {mode.icon}
                  </div>
                  <Lock size={12} className="text-text-secondary" />
                </div>

                <div>
                  <h3 className="font-display font-bold text-sm text-text-primary">
                    {mode.title}
                  </h3>
                  <p className="font-mono text-[11px] mt-0.5" style={{ color: mode.accentColor }}>
                    {mode.subtitle}
                  </p>
                </div>

                <p className="font-sans text-xs leading-relaxed text-text-secondary">
                  {mode.desc}
                </p>
              </motion.button>
            ))}
          </motion.div>

          {/* ── Sign-in nudge ── */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 10 },
              visible: { opacity: 1, y: 0, transition: springs.slide },
            }}
            className="flex flex-col items-center gap-3 pt-1"
          >
            <p className="text-xs text-center text-text-secondary">
              Sign in to unlock all modes and track your ELO rating
            </p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push('/login')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-card bg-tile-correct text-white text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-[filter,transform] active:scale-[0.98]"
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
            className="mb-6 text-sm rounded-card px-4 py-2 w-full max-w-md"
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

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: stagger.medium },
        }}
        className="w-full max-w-md flex flex-col gap-4"
      >
        {/* ── Page header + user stats ── */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0, transition: springs.slide },
          }}
        >
          <h1 className="font-display font-black text-4xl tracking-tight text-text-primary">
            Play
          </h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span
              className="font-display font-bold text-2xl tabular-nums"
              style={{ color: tier?.color }}
            >
              {Math.round(user.elo_rating)}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-pill font-semibold border"
              style={{
                color: tier?.color,
                backgroundColor: `${tier?.color}18`,
                borderColor: `${tier?.color}30`,
              }}
            >
              {tier?.name}
            </span>
            <span className="text-xs text-text-secondary font-sans">
              {user.username}
            </span>
            {user.current_streak > 0 && (
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold"
                style={{ color: 'var(--yellow)' }}
              >
                <Flame size={11} />
                {user.current_streak}
              </span>
            )}
          </div>
        </motion.div>

        {/* ── Hero daily card ── */}
        <motion.button
          variants={{
            hidden: { opacity: 0, y: 24 },
            visible: { opacity: 1, y: 0, transition: springs.slide },
          }}
          whileHover={isDailyLoading || !!creating ? {} : { y: -1.5 }}
          whileTap={isDailyLoading || !!creating ? {} : { scale: 0.99 }}
          onClick={() => handleModeSelect('daily')}
          disabled={!!creating}
          className="group relative w-full flex flex-col gap-4 text-left rounded-card-lg border-2 border-border-default bg-bg-base p-6 hover:border-tile-correct transition-colors shadow-card hover:shadow-card-hover cursor-pointer"
        >
          {/* Top row: icon + title + streak/free tag */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-card border border-border-subtle bg-bg-elevated flex items-center justify-center text-tile-correct">
                {isDailyLoading ? (
                  <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin border-tile-correct" />
                ) : (
                  <Sun size={20} />
                )}
              </div>
              <div>
                <h2 className="font-display font-bold text-xl text-text-primary leading-tight">
                  Daily Puzzle
                </h2>
                <p className="font-sans text-sm text-tile-correct">
                  Today&apos;s Word
                </p>
              </div>
            </div>

            {dailyMode.tag && (
              <span
                className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-pill font-semibold border"
                style={{
                  color: 'var(--yellow)',
                  backgroundColor: 'rgba(201,180,88,0.12)',
                  borderColor: 'rgba(201,180,88,0.25)',
                }}
              >
                {dailyMode.tag}
              </span>
            )}

            {!dailyMode.tag && !dailyAlreadyPlayed && (
              <span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-pill font-semibold border border-tile-correct/30 text-tile-correct">
                Free
              </span>
            )}
          </div>

          {/* Mini tile patterns */}
          {dailyPatterns && (
            <div className="flex flex-col gap-1.5 py-0.5">
              {dailyPatterns.map((row, i) => (
                <MiniTileRow key={i} pattern={row as ('correct' | 'present' | 'absent')[]} />
              ))}
            </div>
          )}

          {/* Description */}
          <p className="font-sans text-sm leading-relaxed text-text-secondary">
            One word per day. Play against the community.
          </p>

          {/* CTA row */}
          {dailyAlreadyPlayed ? (
            <div className="flex items-center justify-between">
              <DailyCountdown onMidnight={handleMidnight} />
              <div className="flex items-center gap-1.5 text-xs font-semibold text-tile-correct">
                View your game
                <ArrowRight size={13} />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-sm font-semibold text-tile-correct">
              Play now
              <ArrowRight size={14} />
            </div>
          )}
        </motion.button>

        {/* ── Competitive & Practice cards ── */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            visible: { opacity: 1, y: 0, transition: springs.slide },
          }}
          className="grid grid-cols-2 gap-3"
        >
          {otherModes.map((mode) => {
            const isLoading = creating === mode.id;
            return (
              <motion.button
                key={mode.id}
                whileHover={isLoading || !!creating ? {} : { y: -1 }}
                whileTap={isLoading || !!creating ? {} : { scale: 0.99 }}
                onClick={() => handleModeSelect(mode.id)}
                disabled={!!creating}
                className="relative flex flex-col gap-3 p-4 rounded-card-lg border border-border-subtle bg-bg-base text-left transition-colors hover:border-border-default hover:shadow-card cursor-pointer disabled:opacity-60"
              >
                {/* Mode tag */}
                {mode.tag && (
                  <span
                    className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-pill font-semibold border"
                    style={{
                      color: mode.accentColor,
                      backgroundColor: `${mode.accentColor}18`,
                      borderColor: `${mode.accentColor}30`,
                    }}
                  >
                    {mode.tag}
                  </span>
                )}

                {/* Icon */}
                <div
                  className="w-9 h-9 rounded-card border border-border-subtle bg-bg-elevated flex items-center justify-center"
                  style={{ color: mode.accentColor }}
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

                <div>
                  <h3 className="font-display font-bold text-sm text-text-primary">
                    {mode.title}
                  </h3>
                  <p className="font-mono text-[11px] mt-0.5" style={{ color: mode.accentColor }}>
                    {mode.subtitle}
                  </p>
                </div>

                <p className="font-sans text-xs leading-relaxed text-text-secondary">
                  {mode.desc}
                </p>
              </motion.button>
            );
          })}
        </motion.div>

        {/* ── Challenge a Friend ── */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 10 },
            visible: { opacity: 1, y: 0, transition: springs.slide },
          }}
        >
          <button
            onClick={handleCreateChallenge}
            disabled={creatingChallenge || !!creating}
            className="w-full py-2.5 rounded-card-lg border border-border-subtle bg-bg-base text-sm font-semibold text-text-secondary hover:border-border-default hover:text-text-primary transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {creatingChallenge ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin border-text-secondary" />
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
        transition={{ delay: 0.5 }}
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
