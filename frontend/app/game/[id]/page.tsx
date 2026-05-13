'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, ArrowLeft, AlertTriangle } from 'lucide-react';
import GameBoard from '@/components/GameBoard';
import Keyboard from '@/components/Keyboard';
import GameOverModal from '@/components/GameOverModal';
import Toast from '@/components/Toast';
import AchievementToast, { ACHIEVEMENT_META } from '@/components/AchievementToast';
import GameWaveBackground from '@/components/GameWaveBackground';
import { gamesApi, dailyApi } from '@/lib/api';
import { useAuth } from '@/lib/hooks/useAuth';
import { Game, GameStatus, TileState, patternToTiles } from '@/lib/types';
import { springs } from '@/lib/animations';
import { useSettings } from '@/lib/useSettings';

/** Local date string (YYYY-MM-DD) matching the server's TZ. */
function localDateStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

// Flip animation: 5 tiles × 0.15s stagger + 0.5s each tile = ~1.25s total
const FLIP_ANIMATION_MS = 5 * 150 + 500 + 150;

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [settings] = useSettings();

  const [game, setGame] = useState<Game | null>(null);
  const [currentGuess, setCurrentGuess] = useState('');
  const [guesses, setGuesses] = useState<string[]>([]);
  const [patterns, setPatterns] = useState<number[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>('in_progress');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shakeRow, setShakeRow] = useState(-1);
  const [revealRow, setRevealRow] = useState(-1);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingGame, setLoadingGame] = useState(true);
  const [unlockedAchievements, setUnlockedAchievements] = useState<
    Array<{ type: string; name: string; icon: string }>
  >([]);
  const [wavePattern, setWavePattern] = useState<number | null>(null);
  const [waveTrigger, setWaveTrigger] = useState(0);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [abandoning, setAbandoning] = useState(false);

  // Timer
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((msg: string, duration = 2000) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), duration);
  }, []);

  // Load existing game state on mount
  useEffect(() => {
    if (!id) return;
    if (authLoading) return;

    const loadGame = (g: Game) => {
      setGame(g);
      if (g.moves && g.moves.length > 0) {
        const sorted = [...g.moves].sort((a, b) => a.move_number - b.move_number);
        setGuesses(sorted.map((m) => m.guess_word));
        setPatterns(sorted.map((m) => m.pattern));
        setRevealRow(-1);
      }
      setGameStatus(g.status);
      if (g.status !== 'in_progress') {
        setModalOpen(true);
      }
    };

    const fetchGame = user
      ? gamesApi.get(id).catch(() => dailyApi.guestGame(id))
      : dailyApi.guestGame(id);

    fetchGame
      .then((res: { data: Game }) => loadGame(res.data))
      .catch(() => router.push('/play'))
      .finally(() => setLoadingGame(false));
  }, [id, router, user, authLoading]);

  // Timer — runs while game is in progress
  useEffect(() => {
    if (gameStatus !== 'in_progress') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStatus]);

  // Build keyboard letter states from all submitted guesses
  const letterStates: Record<string, TileState> = {};
  guesses.forEach((guess: string, idx: number) => {
    if (patterns[idx] === undefined) return;
    const tiles = patternToTiles(patterns[idx]);
    guess.split('').forEach((letter: string, i: number) => {
      const current = letterStates[letter];
      const next = tiles[i];
      if (current === 'correct') return;
      if (current === 'present' && next === 'absent') return;
      letterStates[letter] = next;
    });
  });

  const handleKey = useCallback(
    (key: string) => {
      if (gameStatus !== 'in_progress' || isSubmitting) return;
      if (currentGuess.length < 5) {
        setCurrentGuess((prev: string) => prev + key.toUpperCase());
      }
    },
    [gameStatus, isSubmitting, currentGuess.length]
  );

  const handleBackspace = useCallback(() => {
    if (gameStatus !== 'in_progress' || isSubmitting) return;
    setCurrentGuess((prev: string) => prev.slice(0, -1));
  }, [gameStatus, isSubmitting]);

  const handleEnter = useCallback(async () => {
    if (gameStatus !== 'in_progress' || isSubmitting) return;

    if (currentGuess.length < 5) {
      setShakeRow(guesses.length);
      setTimeout(() => setShakeRow(-1), 500);
      showToast('Not enough letters');
      return;
    }

    // Hard mode: validate revealed hints are reused
    if (settings.hardMode && guesses.length > 0) {
      for (let gi = 0; gi < guesses.length; gi++) {
        const prevGuess = guesses[gi];
        const tiles = patternToTiles(patterns[gi]);
        // Check greens: same letter must appear at same position
        for (let pos = 0; pos < 5; pos++) {
          if (tiles[pos] === 'correct' && currentGuess[pos] !== prevGuess[pos]) {
            setShakeRow(guesses.length);
            setTimeout(() => setShakeRow(-1), 500);
            showToast(`Hard mode: must reuse ${prevGuess[pos]}`);
            return;
          }
        }
        // Check yellows: letter must appear somewhere in guess
        for (let pos = 0; pos < 5; pos++) {
          if (tiles[pos] === 'present' && !currentGuess.includes(prevGuess[pos])) {
            setShakeRow(guesses.length);
            setTimeout(() => setShakeRow(-1), 500);
            showToast(`Hard mode: must reuse ${prevGuess[pos]}`);
            return;
          }
        }
      }
    }

    setIsSubmitting(true);

    try {
      const res = user
        ? await gamesApi.submitGuess(id, currentGuess)
        : await dailyApi.guestGuess(id, currentGuess);
      const updatedGame: Game = res.data;

      const sortedMoves = [...(updatedGame.moves || [])].sort(
        (a, b) => a.move_number - b.move_number
      );
      const latestMove = sortedMoves[sortedMoves.length - 1];
      const pattern = latestMove?.pattern ?? 0;

      const rowIndex = guesses.length;

      setGuesses((prev: string[]) => [...prev, currentGuess]);
      setPatterns((prev: number[]) => [...prev, pattern]);
      setCurrentGuess('');

      if (updatedGame.mode === 'daily') {
        const today = localDateStr();
        const allPatterns = [...patterns, pattern];
        localStorage.setItem(`eloquence_daily_patterns_${today}`, JSON.stringify(allPatterns));
        localStorage.setItem(`eloquence_daily_game_id_${today}`, id);
      }

      setRevealRow(rowIndex);
      setWavePattern(pattern);
      setWaveTrigger((prev: number) => prev + 1);

      setTimeout(() => {
        setRevealRow(-1);

        const status: GameStatus = updatedGame.status;
        setGame(updatedGame);
        setGameStatus(status);

        if (status !== 'in_progress') {
          if (updatedGame.mode === 'daily') {
            const today = localDateStr();
            localStorage.setItem(`eloquence_daily_played_${today}`, 'true');
          }

          setTimeout(() => setModalOpen(true), 250);

          const newlyUnlocked: string[] =
            (updatedGame as Game & { newly_unlocked?: string[] }).newly_unlocked || [];
          if (newlyUnlocked.length > 0) {
            const toastAchievements = newlyUnlocked.map((type) => {
              const meta = ACHIEVEMENT_META[type];
              return {
                type,
                name: meta?.name ?? type,
                icon: meta?.icon ?? '🏆',
              };
            });
            setUnlockedAchievements(toastAchievements);
            setTimeout(() => setUnlockedAchievements([]), 5000);
          }
        }

        setIsSubmitting(false);
      }, FLIP_ANIMATION_MS);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      const msg = detail || 'Something went wrong.';

      if (
        msg.toLowerCase().includes('not in word list') ||
        msg.toLowerCase().includes('invalid word') ||
        msg.toLowerCase().includes('not a valid')
      ) {
        setShakeRow(guesses.length);
        setTimeout(() => setShakeRow(-1), 500);
      } else {
        showToast(msg);
      }
      setIsSubmitting(false);
    }
  }, [
    gameStatus,
    isSubmitting,
    currentGuess,
    guesses,
    patterns,
    id,
    showToast,
    settings.hardMode,
  ]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Derive mode label for the pill badge
  const modeLabel = game
    ? game.mode === 'competitive'
      ? game.is_placement
        ? 'Placement'
        : 'Competitive'
      : game.mode.charAt(0).toUpperCase() + game.mode.slice(1)
    : null;

  if (loadingGame) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
        <div className="w-5 h-5 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative z-10 flex flex-col items-center h-[calc(100dvh-56px)] pt-2 pb-2 px-2 select-none">
      <Toast message={toastMsg} visible={toastVisible} />
      <AchievementToast
        achievements={unlockedAchievements}
        onDismiss={() => setUnlockedAchievements([])}
      />
      <GameWaveBackground patterns={patterns} status={gameStatus} triggerKey={waveTrigger} lastPattern={wavePattern} />

      {/* ── Top bar ── */}
      <div className="w-full max-w-lg flex items-center justify-between px-1 mb-2 shrink-0">
        {/* Back button */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            if (game?.rated && gameStatus === 'in_progress') {
              setShowAbandonConfirm(true);
            } else {
              router.push('/play');
            }
          }}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#9898a0] hover:text-[#ededf0] hover:bg-white/[0.06] transition-colors"
          aria-label="Back to mode selection"
        >
          <ArrowLeft size={17} />
        </motion.button>

        {/* Mode pill badge */}
        {modeLabel && (
          <span className="rounded-full bg-white/[0.06] text-[#9898a0] text-xs px-3 py-1 font-medium tracking-wide">
            {modeLabel}
          </span>
        )}

        {/* Timer (competitive only) */}
        {game?.mode === 'competitive' ? (
          <div className="flex items-center gap-1.5 text-[#9898a0] text-xs font-mono tabular-nums min-w-[44px] justify-end">
            <Timer size={13} strokeWidth={1.8} />
            <span>{formatTime(elapsed)}</span>
          </div>
        ) : (
          /* Spacer to keep pill centered when no timer */
          <div className="w-8" />
        )}
      </div>

      {/* ── Board — flex-1 so it takes available space between header and keyboard ── */}
      <div className="flex-1 flex items-center justify-center w-full">
        <GameBoard
          guesses={guesses}
          patterns={patterns}
          currentGuess={currentGuess}
          shakeRow={shakeRow}
          revealRow={revealRow}
        />
      </div>

      {/* ── Progress dots — all 6 always visible, fill as you play ── */}
      <div className="flex items-center justify-center gap-1.5 mb-3 shrink-0" aria-label="Guess progress">
        {Array.from({ length: 6 }).map((_, i) => {
          const isUsed = i < guesses.length;
          const isCurrent = i === guesses.length && gameStatus === 'in_progress';

          // Default for unused slots: a faint but clearly visible outlined dot
          // using the border token so it reads in both light and dark themes.
          let inlineStyle: React.CSSProperties = {
            backgroundColor: 'transparent',
            border: '1.5px solid var(--border-default)',
          };

          if (isUsed && patterns[i] !== undefined) {
            const tiles = patternToTiles(patterns[i]);
            const greens = tiles.filter((t) => t === 'correct').length;
            const yellows = tiles.filter((t) => t === 'present').length;
            let bg = 'var(--tile-absent)';
            if (greens === 5) bg = 'var(--tile-correct)';
            else if (greens > 0)
              bg = `color-mix(in srgb, var(--tile-correct) ${Math.min(100, 40 + greens * 12)}%, var(--tile-absent))`;
            else if (yellows > 0)
              bg = `color-mix(in srgb, var(--tile-present) ${Math.min(100, 35 + yellows * 12)}%, var(--tile-absent))`;
            inlineStyle = { backgroundColor: bg, border: 'none' };
          }

          return (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                isCurrent ? 'w-2 h-2' : 'w-1.5 h-1.5'
              }`}
              style={{
                ...inlineStyle,
                ...(isCurrent
                  ? { boxShadow: '0 0 0 2px color-mix(in srgb, var(--tile-correct) 35%, transparent)' }
                  : {}),
              }}
            />
          );
        })}
      </div>

      {/* ── Virtual keyboard ── */}
      <div className="w-full flex justify-center shrink-0 pb-safe">
        <Keyboard
          onKey={handleKey}
          onEnter={handleEnter}
          onBackspace={handleBackspace}
          letterStates={letterStates}
          disablePhysicalKeyboard={settings.keyboardOnly}
        />
      </div>

      {/* ── Abandon confirmation modal ── */}
      <AnimatePresence>
        {showAbandonConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => !abandoning && setShowAbandonConfirm(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 12 }}
                transition={springs.modal}
                className="w-full max-w-xs bg-[#1d1d21] rounded-2xl border border-white/[0.10] shadow-modal overflow-hidden pointer-events-auto"
              >
                {/* Danger stripe */}
                <div className="h-1 w-full bg-[#e74c3c]" />

                <div className="p-5 flex flex-col gap-4">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="w-10 h-10 rounded-full bg-[#e74c3c]/[0.12] flex items-center justify-center">
                      <AlertTriangle size={20} className="text-[#e74c3c]" />
                    </div>
                    <h3 className="text-sm font-bold text-[#ededf0]">Abandon game?</h3>
                    <p className="text-xs text-[#9898a0] leading-relaxed">
                      This counts as a{' '}
                      <span className="text-[#e74c3c] font-semibold">loss</span> and you will
                      lose ELO.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAbandonConfirm(false)}
                      disabled={abandoning}
                      className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.09] text-[#ededf0] font-medium text-xs transition-colors border border-white/[0.08] disabled:opacity-50"
                    >
                      Keep playing
                    </button>
                    <button
                      onClick={async () => {
                        setAbandoning(true);
                        try {
                          await gamesApi.delete(id);
                        } catch {
                          /* ignore */
                        }
                        router.push('/play');
                      }}
                      disabled={abandoning}
                      className="flex-1 py-2.5 rounded-xl bg-[#e74c3c] hover:bg-[#c0392b] text-white font-medium text-xs transition-colors disabled:opacity-60"
                    >
                      {abandoning ? 'Leaving...' : 'Abandon'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── Game over modal ── */}
      {game && (
        <GameOverModal
          game={game}
          open={modalOpen}
          isGuest={!user}
          onClose={() => setModalOpen(false)}
          gamesPlayed={user?.games_played}
        />
      )}
    </div>
  );
}
