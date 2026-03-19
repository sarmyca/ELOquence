'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Timer, ArrowLeft } from 'lucide-react';
import GameBoard from '@/components/GameBoard';
import Keyboard from '@/components/Keyboard';
import GameOverModal from '@/components/GameOverModal';
import Toast from '@/components/Toast';
import AchievementToast, { ACHIEVEMENT_META } from '@/components/AchievementToast';
import GuessWaveEffect from '@/components/GuessWaveEffect';
import { gamesApi } from '@/lib/api';
import { Game, GameStatus, TileState, patternToTiles } from '@/lib/types';

// Flip animation: 5 tiles × 0.15s stagger + 0.5s each tile = ~1.25s total
const FLIP_ANIMATION_MS = 5 * 150 + 500 + 150;

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

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
    gamesApi
      .get(id)
      .then((res) => {
        const g: Game = res.data;
        setGame(g);
        if (g.moves && g.moves.length > 0) {
          const sorted = [...g.moves].sort((a, b) => a.move_number - b.move_number);
          setGuesses(sorted.map((m) => m.guess_word));
          setPatterns(sorted.map((m) => m.pattern));
          // All previous rows are already fully revealed (no flip needed)
          setRevealRow(-1);
        }
        setGameStatus(g.status);
        if (g.status !== 'in_progress') {
          setModalOpen(true);
        }
      })
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
  guesses.forEach((guess, idx) => {
    if (patterns[idx] === undefined) return;
    const tiles = patternToTiles(patterns[idx]);
    guess.split('').forEach((letter, i) => {
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
        setCurrentGuess((prev) => prev + key.toUpperCase());
      }
    },
    [gameStatus, isSubmitting, currentGuess.length]
  );

  const handleBackspace = useCallback(() => {
    if (gameStatus !== 'in_progress' || isSubmitting) return;
    setCurrentGuess((prev) => prev.slice(0, -1));
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
      const res = await gamesApi.submitGuess(id, currentGuess);
      const updatedGame: Game = res.data;

      // Extract the pattern from the latest move in the response
      const sortedMoves = [...(updatedGame.moves || [])].sort(
        (a, b) => a.move_number - b.move_number
      );
      const latestMove = sortedMoves[sortedMoves.length - 1];
      const pattern = latestMove?.pattern ?? 0;

      const rowIndex = guesses.length;

      // Add the guess + pattern immediately so the board renders the revealed colors
      setGuesses((prev) => [...prev, currentGuess]);
      setPatterns((prev) => [...prev, pattern]);
      setCurrentGuess('');

      // Start flip animation on this row
      setRevealRow(rowIndex);

      // Trigger radial wave effect
      setWavePattern(pattern);
      setWaveTrigger((prev) => prev + 1);

      // After animation completes, clear flip flag and check win/lose
      setTimeout(() => {
        setRevealRow(-1);

        const status: GameStatus = updatedGame.status;
        setGame(updatedGame);
        setGameStatus(status);

        if (status !== 'in_progress') {
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
    <div className="relative z-10 flex flex-col items-center min-h-[calc(100dvh-56px)] pt-3 pb-4 px-2 select-none">
      <Toast message={toastMsg} visible={toastVisible} />
      <AchievementToast
        achievements={unlockedAchievements}
        onDismiss={() => setUnlockedAchievements([])}
      />
      <GuessWaveEffect pattern={wavePattern} triggerKey={waveTrigger} />

      {/* Top bar */}
      <div className="w-full max-w-lg flex items-center justify-between px-2 mb-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => router.push('/play')}
          className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] transition-colors"
          aria-label="Back to mode selection"
        >
          <ArrowLeft size={18} />
        </motion.button>

        <div className="flex flex-col items-center">
          {game && (
            <span className="text-xs text-text-tertiary capitalize font-medium">
              {game.mode}
              {game.is_placement && (
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

      {/* Game board — takes the majority of the screen */}
      <div className="flex-1 flex items-center justify-center w-full py-2">
        <GameBoard
          guesses={guesses}
          patterns={patterns}
          currentGuess={currentGuess}
          shakeRow={shakeRow}
          revealRow={revealRow}
        />
      </div>

      {/* Virtual keyboard */}
      <div className="w-full px-2 mt-2 flex justify-center">
        <Keyboard
          onKey={handleKey}
          onEnter={handleEnter}
          onBackspace={handleBackspace}
          letterStates={letterStates}
        />
      </div>

      {/* Game over modal */}
      {game && <GameOverModal game={game} open={modalOpen} />}
    </div>
  );
}
