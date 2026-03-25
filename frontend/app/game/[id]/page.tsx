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
import GuessWaveEffect from '@/components/GuessWaveEffect';
import { gamesApi, dailyApi } from '@/lib/api';
import { useAuth } from '@/lib/hooks/useAuth';
import { Game, GameStatus, TileState, patternToTiles } from '@/lib/types';
import { springs } from '@/lib/animations';

// Flip animation: 5 tiles × 0.15s stagger + 0.5s each tile = ~1.25s total
const FLIP_ANIMATION_MS = 5 * 150 + 500 + 150;

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [game, setGame] = useState<Game | null>(null);
  const [currentGuess, setCurrentGuess] = useState('');
  const [guesses, setGuesses] = useState<string[]>([]);
  const [patterns, setPatterns] = useState<number[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>('in_progress');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // shakeRow: index of row to shake (-1 = none)
  const [shakeRow, setShakeRow] = useState(-1);
  // revealRow: index of row currently doing flip animation (-1 = none)
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
      ? gamesApi.get(id).catch(() => dailyApi.guestGame(id))  // fallback to guest game
      : dailyApi.guestGame(id);

    fetchGame
      .then((res: { data: Game }) => loadGame(res.data))
      .catch(() => router.push('/play'))
      .finally(() => setLoadingGame(false));
  }, [id, router]);

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
      // Priority: correct > present > absent
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

    setIsSubmitting(true);

    try {
      const res = user
        ? await gamesApi.submitGuess(id, currentGuess)
        : await dailyApi.guestGuess(id, currentGuess);
      const updatedGame: Game = res.data;

      // Extract the pattern from the latest move in the response
      const sortedMoves = [...(updatedGame.moves || [])].sort(
        (a, b) => a.move_number - b.move_number
      );
      const latestMove = sortedMoves[sortedMoves.length - 1];
      const pattern = latestMove?.pattern ?? 0;

      const rowIndex = guesses.length;

      // Add the guess + pattern immediately so the board renders the revealed colors
      setGuesses((prev: string[]) => [...prev, currentGuess]);
      setPatterns((prev: number[]) => [...prev, pattern]);
      setCurrentGuess('');

      // Save daily progress after every guess
      if (updatedGame.mode === 'daily') {
        const today = new Date().toISOString().slice(0, 10);
        const allPatterns = [...patterns, pattern];
        localStorage.setItem(`eloquence_daily_patterns_${today}`, JSON.stringify(allPatterns));
        localStorage.setItem(`eloquence_daily_game_id_${today}`, id);
      }

      // Start flip animation on this row
      setRevealRow(rowIndex);

      // Trigger radial wave effect
      setWavePattern(pattern);
      setWaveTrigger((prev: number) => prev + 1);

      // After animation completes, clear flip flag and check win/lose
      setTimeout(() => {
        setRevealRow(-1);

        const status: GameStatus = updatedGame.status;
        setGame(updatedGame);
        setGameStatus(status);

        if (status !== 'in_progress') {
          // Mark daily as completed
          if (updatedGame.mode === 'daily') {
            const today = new Date().toISOString().slice(0, 10);
            localStorage.setItem(`eloquence_daily_played_${today}`, 'true');
          }

          setTimeout(() => setModalOpen(true), 250);

          // Show achievement toasts for newly unlocked achievements
          const newlyUnlocked: string[] = (updatedGame as Game & { newly_unlocked?: string[] }).newly_unlocked || [];
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
    guesses.length,
    id,
    showToast,
  ]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loadingGame) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
        <div className="w-6 h-6 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative z-10 flex flex-col items-center h-[calc(100dvh-56px)] pt-1 pb-2 px-2 select-none justify-between">
      <Toast message={toastMsg} visible={toastVisible} />
      <AchievementToast
        achievements={unlockedAchievements}
        onDismiss={() => setUnlockedAchievements([])}
      />
      <GuessWaveEffect pattern={wavePattern} triggerKey={waveTrigger} />

      {/* Top bar */}
      <div className="w-full max-w-lg flex items-center justify-between px-2 mb-1">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (game?.rated && gameStatus === 'in_progress') {
              setShowAbandonConfirm(true);
            } else {
              router.push('/play');
            }
          }}
          className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] transition-colors"
          aria-label="Back to mode selection"
        >
          <ArrowLeft size={18} />
        </motion.button>

        <div className="flex flex-col items-center">
          {game && (
            <span className="text-xs text-text-tertiary capitalize font-medium">
              {game.mode}
              {game.is_placement && game.mode === 'competitive' && (
                <span className="ml-1 text-[#b59f3b]">· Placement</span>
              )}
            </span>
          )}
        </div>

        {game?.mode === 'competitive' && (
          <div className="flex items-center gap-1 text-text-secondary text-sm font-mono">
            <Timer size={14} />
            <span>{formatTime(elapsed)}</span>
          </div>
        )}
      </div>

      {/* Game board */}
      <div className="flex items-start justify-center w-full pt-8">
        <GameBoard
          guesses={guesses}
          patterns={patterns}
          currentGuess={currentGuess}
          shakeRow={shakeRow}
          revealRow={revealRow}
        />
      </div>

      {/* Guess progress + hints bar */}
      <div className="flex-1 flex items-center justify-center w-full max-w-lg px-4">
        <div className="flex items-center gap-4">
          {/* Guess counter dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => {
              const isUsed = i < guesses.length;
              const isCurrent = i === guesses.length && gameStatus === 'in_progress';
              let dotColor = 'bg-white/[0.08]';
              if (isUsed && patterns[i] !== undefined) {
                const tiles = patternToTiles(patterns[i]);
                const greens = tiles.filter(t => t === 'correct').length;
                if (greens === 5) dotColor = 'bg-tile-correct';
                else if (greens > 0) dotColor = 'bg-tile-correct/60';
                else if (tiles.some(t => t === 'present')) dotColor = 'bg-tile-present/60';
                else dotColor = 'bg-tile-absent';
              }
              return (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-300 ${dotColor} ${
                    isCurrent ? 'w-2.5 h-2.5 ring-1 ring-white/20' : 'w-2 h-2'
                  }`}
                />
              );
            })}
          </div>
          {gameStatus === 'in_progress' && guesses.length > 0 && (
            <span className="text-[11px] text-text-ghost font-mono tabular-nums">
              {guesses.length}/6
            </span>
          )}
        </div>
      </div>

      {/* Virtual keyboard */}
      <div className="w-full px-1 pb-6 flex justify-center">
        <Keyboard
          onKey={handleKey}
          onEnter={handleEnter}
          onBackspace={handleBackspace}
          letterStates={letterStates}
        />
      </div>

      {/* Abandon confirmation modal */}
      <AnimatePresence>
        {showAbandonConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => !abandoning && setShowAbandonConfirm(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 16 }}
                transition={springs.modal}
                className="w-full max-w-xs bg-bg-secondary rounded-2xl border border-white/[0.1] shadow-2xl overflow-hidden"
              >
                <div className="h-1.5 w-full bg-[#e74c3c]" />
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <AlertTriangle size={28} className="text-[#e74c3c]" />
                    <h3 className="text-base font-bold text-text-primary">Abandon game?</h3>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      This will count as a <span className="text-[#e74c3c] font-semibold">loss</span> and you will lose ELO.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAbandonConfirm(false)}
                      disabled={abandoning}
                      className="flex-1 py-2.5 rounded-xl bg-bg-tertiary hover:bg-bg-elevated text-text-primary font-medium text-sm transition-colors border border-white/[0.08]"
                    >
                      Continue playing
                    </button>
                    <button
                      onClick={async () => {
                        setAbandoning(true);
                        try {
                          await gamesApi.delete(id);
                        } catch { /* ignore */ }
                        router.push('/play');
                      }}
                      disabled={abandoning}
                      className="flex-1 py-2.5 rounded-xl bg-[#e74c3c] hover:bg-[#c0392b] text-white font-medium text-sm transition-colors"
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

      {/* Game over modal */}
      {game && <GameOverModal game={game} open={modalOpen} isGuest={!user} onClose={() => setModalOpen(false)} gamesPlayed={user?.games_played} />}
    </div>
  );
}
