'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Swords, FlaskConical, Flame, Star, Lock, Share2, Check, X, ArrowRight, LogIn } from 'lucide-react';
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

// Decorative mini wordle tile row used in the guest hero card
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
  const { user, loading } = useAuth();
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

  // Schedule a midnight (UTC) refresh even when the countdown isn't visible
  useEffect(() => {
    const timer = setTimeout(handleMidnight, msUntilMidnight());
    return () => clearTimeout(timer);
  }, [handleMidnight, dailyRefreshKey]);

  // Check if daily was already completed (as guest via localStorage, or as user via API)
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);

    if (user) {
      // Authenticated user: check daily status via GET (read-only, doesn't create a game)
      dailyApi.get().then((res) => {
        if (res.data.already_played) {
          setDailyAlreadyPlayed(true);
          if (res.data.existing_game_id) {
            setDailyGameId(res.data.existing_game_id);
          }
        } else {
          setDailyAlreadyPlayed(false);
          setDailyGameId(null);
          setDailyPatterns(null);
        }
        // Load patterns from localStorage if they exist for this session
        const savedPatterns = localStorage.getItem(`eloquence_daily_patterns_${today}`);
        if (savedPatterns && res.data.already_played) {
          try {
            const nums: number[] = JSON.parse(savedPatterns);
            setDailyPatterns(nums.map((p) => patternToTiles(p)));
          } catch { /* ignore */ }
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
        <div className="w-6 h-6 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Shared challenge modal (used by both views) ──────────────────────────────
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
  );

  // ── GUEST VIEW ───────────────────────────────────────────────────────────────
  if (!user) {
    const dailyMode = modes[0];
    const lockedModes = modes.slice(1);
    const isDailyLoading = creating === 'daily';

    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-56px)] px-4 py-10">
        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 text-sm text-[#e74c3c] bg-[#e74c3c]/10 border border-[#e74c3c]/20 rounded-lg px-4 py-2"
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
          className="w-full max-w-md flex flex-col items-center gap-6"
        >
          {/* ── Hero daily card ── */}
          <motion.button
            variants={{
              hidden: { opacity: 0, y: 28 },
              visible: { opacity: 1, y: 0, transition: springs.slide },
            }}
            whileHover={{ scale: isDailyLoading || !!creating ? 1 : 1.02 }}
            whileTap={{ scale: isDailyLoading || !!creating ? 1 : 0.97 }}
            onClick={() => handleModeSelect('daily')}
            disabled={!!creating}
            className={clsx(
              'relative w-full flex flex-col gap-5 p-7 rounded-2xl border text-left transition-all duration-150',
              'bg-bg-secondary hover:bg-bg-tertiary cursor-pointer'
            )}
            style={{ borderColor: 'rgba(106,170,100,0.35)' }}
          >
            {/* Green accent bar along the top */}
            <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-[#538d4e] to-[#6aaa64]" />

            {/* Top row: icon + title */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ color: '#6aaa64', backgroundColor: 'rgba(106,170,100,0.12)' }}
                >
                  {isDailyLoading ? (
                    <div
                      className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: 'rgba(106,170,100,0.3)', borderTopColor: '#6aaa64' }}
                    />
                  ) : (
                    <Sun size={26} />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-primary leading-tight">Daily Puzzle</h2>
                  <p className="text-xs font-mono" style={{ color: '#6aaa64' }}>
                    Today&apos;s Word
                  </p>
                </div>
              </div>

              {/* Free badge */}
              {!dailyAlreadyPlayed && (
                <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold tracking-wide uppercase"
                  style={{ color: '#6aaa64', backgroundColor: 'rgba(106,170,100,0.12)', border: '1px solid rgba(106,170,100,0.25)' }}>
                  Free
                </span>
              )}
            </div>

            {/* Tile rows — real results if played, decorative placeholder otherwise */}
            {dailyPatterns && (
              <div className="flex flex-col gap-1.5 py-1">
                {dailyPatterns.map((row, i) => (
                  <MiniTileRow key={i} pattern={row} />
                ))}
              </div>
            )}

            {/* Description */}
            <p className="text-sm text-text-secondary leading-relaxed">
              One word per day, shared across the community. No account needed.
            </p>

            {/* CTA / already played state */}
            {dailyAlreadyPlayed ? (
              <div className="flex items-center justify-between">
                <DailyCountdown onMidnight={handleMidnight} />
                <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: '#6aaa64' }}>
                  View your game
                  <ArrowRight size={13} />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#6aaa64' }}>
                {dailyPatterns ? 'Continue' : 'Play now'}
                <ArrowRight size={15} />
              </div>
            )}
          </motion.button>

          {/* ── Locked secondary cards ── */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: springs.slide },
            }}
            className="w-full grid grid-cols-2 gap-3"
          >
            {lockedModes.map((mode) => (
              <motion.button
                key={mode.id}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => router.push('/login')}
                className={clsx(
                  'relative flex flex-col gap-3 p-4 rounded-xl border text-left transition-all duration-150',
                  'bg-bg-secondary hover:bg-bg-tertiary cursor-pointer'
                )}
                style={{ borderColor: mode.borderColor }}
              >
                {/* Dimmed overlay to convey locked state */}
                <div className="absolute inset-0 rounded-xl bg-bg-base/30 pointer-events-none" />

                {/* Icon + lock */}
                <div className="flex items-center justify-between">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center opacity-60"
                    style={{ color: mode.accentColor, backgroundColor: `${mode.accentColor}18` }}
                  >
                    {mode.icon}
                  </div>
                  <Lock size={12} className="text-text-ghost opacity-70" />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-text-primary opacity-60">{mode.title}</h3>
                  <p className="text-[11px] font-mono opacity-50" style={{ color: mode.accentColor }}>
                    {mode.subtitle}
                  </p>
                </div>

                <p className="text-xs text-text-ghost leading-relaxed opacity-60">{mode.desc}</p>
              </motion.button>
            ))}
          </motion.div>

          {/* ── Sign-up nudge ── */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 12 },
              visible: { opacity: 1, y: 0, transition: springs.slide },
            }}
            className="w-full flex flex-col items-center gap-3 pt-1"
          >
            <p className="text-xs text-text-ghost text-center">
              Sign in to unlock all modes and track your ELO rating
            </p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push('/login')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#538d4e] hover:bg-[#6aaa64] text-white text-sm font-medium transition-colors"
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

  // ── AUTHENTICATED VIEW ──────────────────────────────────────────────────────
  const dailyMode = modes[0];
  const otherModes = modes.slice(1);
  const isDailyLoading = creating === 'daily';

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-56px)] px-4 py-10">
      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-6 text-sm text-[#e74c3c] bg-[#e74c3c]/10 border border-[#e74c3c]/20 rounded-lg px-4 py-2"
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
        className="w-full max-w-md flex flex-col items-center gap-6"
      >
        {/* User stats bar */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            visible: { opacity: 1, y: 0, transition: springs.slide },
          }}
          className="flex items-center gap-3"
        >
          <span className="text-2xl font-bold font-mono" style={{ color: tier?.color }}>
            {Math.round(user.elo_rating)}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ color: tier?.color, backgroundColor: `${tier?.color}1a` }}
          >
            {tier?.name}
          </span>
          <span className="text-xs text-text-ghost">{user.username}</span>
          {user.current_streak > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-[#e67e22] font-medium">
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
          whileHover={{ scale: isDailyLoading || !!creating ? 1 : 1.02 }}
          whileTap={{ scale: isDailyLoading || !!creating ? 1 : 0.97 }}
          onClick={() => handleModeSelect('daily')}
          disabled={!!creating}
          className="relative w-full flex flex-col gap-5 p-7 rounded-2xl border text-left transition-all duration-150 bg-bg-secondary hover:bg-bg-tertiary cursor-pointer"
          style={{ borderColor: 'rgba(106,170,100,0.35)' }}
        >
          <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-[#538d4e] to-[#6aaa64]" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ color: '#6aaa64', backgroundColor: 'rgba(106,170,100,0.12)' }}
              >
                {isDailyLoading ? (
                  <div
                    className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: 'rgba(106,170,100,0.3)', borderTopColor: '#6aaa64' }}
                  />
                ) : (
                  <Sun size={26} />
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary leading-tight">Daily Puzzle</h2>
                <p className="text-xs font-mono" style={{ color: '#6aaa64' }}>
                  Today&apos;s Word
                </p>
              </div>
            </div>

            {dailyMode.tag && (
              <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold tracking-wide"
                style={{ color: '#e67e22', backgroundColor: 'rgba(230,126,34,0.12)', border: '1px solid rgba(230,126,34,0.25)' }}>
                {dailyMode.tag}
              </span>
            )}
          </div>

          {/* Tile rows — only shown when the user has actually played */}
          {dailyPatterns && (
            <div className="flex flex-col gap-1.5 py-1">
              {dailyPatterns.map((row, i) => (
                <MiniTileRow key={i} pattern={row} />
              ))}
            </div>
          )}

          <p className="text-sm text-text-secondary leading-relaxed">
            One word per day. Race against the community.
          </p>

          {/* Rated toggle — only after placements are done */}
          {!dailyAlreadyPlayed && user && !user.is_placement && (
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                role="switch"
                aria-checked={dailyRated}
                onClick={(e) => { e.stopPropagation(); setDailyRated(!dailyRated); }}
                className={clsx(
                  'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
                  dailyRated ? 'bg-[#538d4e]' : 'bg-white/[0.12]'
                )}
              >
                <span
                  className={clsx(
                    'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
                    dailyRated ? 'translate-x-4' : 'translate-x-0'
                  )}
                />
              </button>
              <span className="text-xs text-text-secondary">
                {dailyRated ? 'Rated — ELO at stake' : 'Unrated'}
              </span>
            </div>
          )}

          {dailyAlreadyPlayed ? (
            <div className="flex items-center justify-between">
              <DailyCountdown onMidnight={handleMidnight} />
              <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: '#6aaa64' }}>
                View your game
                <ArrowRight size={13} />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#6aaa64' }}>
              Play now
              <ArrowRight size={15} />
            </div>
          )}
        </motion.button>

        {/* ── Competitive & Practice cards ── */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: springs.slide },
          }}
          className="w-full grid grid-cols-2 gap-3"
        >
          {otherModes.map((mode) => {
            const isLoading = creating === mode.id;
            return (
              <motion.button
                key={mode.id}
                whileHover={{ scale: isLoading || !!creating ? 1 : 1.02 }}
                whileTap={{ scale: isLoading || !!creating ? 1 : 0.97 }}
                onClick={() => handleModeSelect(mode.id)}
                disabled={!!creating}
                className="relative flex flex-col gap-3 p-5 rounded-xl border text-left transition-all duration-150 bg-bg-secondary hover:bg-bg-tertiary cursor-pointer disabled:opacity-70"
                style={{ borderColor: mode.borderColor }}
              >
                {mode.tag && (
                  <span
                    className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ color: mode.accentColor, backgroundColor: `${mode.accentColor}22` }}
                  >
                    {mode.tag}
                  </span>
                )}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ color: mode.accentColor, backgroundColor: `${mode.accentColor}18` }}
                >
                  {isLoading ? (
                    <div
                      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: `${mode.accentColor}40`, borderTopColor: mode.accentColor }}
                    />
                  ) : (
                    mode.icon
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{mode.title}</h3>
                  <p className="text-[11px] font-mono" style={{ color: mode.accentColor }}>{mode.subtitle}</p>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">{mode.desc}</p>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Challenge a Friend */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0, transition: springs.slide },
          }}
          className="w-full"
        >
          <button
            onClick={handleCreateChallenge}
            disabled={creatingChallenge || !!creating}
            className="w-full py-2.5 rounded-xl bg-bg-secondary border border-white/[0.08] hover:border-white/[0.14] text-text-secondary hover:text-text-primary disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm font-medium"
          >
            {creatingChallenge ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-text-ghost/40 border-t-text-ghost animate-spin" />
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

      {/* Rating tiers reference */}
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
