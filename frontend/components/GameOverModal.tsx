'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  CheckCircle,
  XCircle,
  Share2,
  RotateCcw,
  BarChart2,
  Check,
  Swords,
  X,
} from 'lucide-react';
import { Game, patternToTiles } from '@/lib/types';
import { springs } from '@/lib/animations';
import { challengesApi } from '@/lib/api';
import Confetti from './Confetti';

interface GameOverModalProps {
  game: Game;
  open: boolean;
  isGuest?: boolean;
  onClose?: () => void;
  gamesPlayed?: number;
}

const TILE_EMOJI: Record<string, string> = {
  correct: '🟩',
  present: '🟨',
  absent: '⬛',
};

type CelebrationTier = 'legendary' | 'impressive' | 'solid' | 'close_call';

const WON_MESSAGES: Record<CelebrationTier, string> = {
  legendary: 'Outstanding!',
  impressive: 'Brilliant Solve!',
  solid: 'Well Played!',
  close_call: 'Survived!',
};

function getCelebrationTier(numGuesses: number): CelebrationTier {
  if (numGuesses <= 2) return 'legendary';
  if (numGuesses === 3) return 'impressive';
  if (numGuesses <= 4) return 'solid';
  return 'close_call';
}

// ---- Stat Pill ---------------------------------------------------------------

interface StatPillProps {
  label: string;
  value: string;
  valueClass?: string;
  animateIn?: boolean;
  animateDelay?: number;
}

function StatPill({
  label,
  value,
  valueClass = 'text-text-primary',
  animateIn = false,
  animateDelay = 0,
}: StatPillProps) {
  const valueEl = animateIn ? (
    <motion.span
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        delay: animateDelay,
        type: 'spring',
        damping: 14,
        stiffness: 280,
      }}
      className={`text-lg font-mono font-bold leading-none ${valueClass}`}
    >
      {value}
    </motion.span>
  ) : (
    <span className={`text-lg font-mono font-bold leading-none ${valueClass}`}>
      {value}
    </span>
  );

  return (
    <div
      className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-[10px]"
      style={{ background: 'rgba(30,30,35,0.8)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <span className="text-[9px] uppercase tracking-widest font-semibold text-text-tertiary">
        {label}
      </span>
      {valueEl}
    </div>
  );
}

// ---- Secondary button --------------------------------------------------------

interface SecondaryBtnProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  successIcon?: React.ReactNode;
  success?: boolean;
}

function SecondaryBtn({ onClick, icon, label, successIcon, success }: SecondaryBtnProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="
        flex-1 py-2.5 rounded-[10px]
        bg-bg-tertiary hover:bg-bg-elevated
        text-text-primary font-medium text-sm
        transition-colors duration-150
        flex items-center justify-center gap-1.5
        border border-white/[0.07]
        min-w-0
      "
    >
      {success && successIcon ? successIcon : icon}
      <span className="truncate">{label}</span>
    </motion.button>
  );
}

// ---- Main component ----------------------------------------------------------

export default function GameOverModal({
  game,
  open,
  isGuest = false,
  onClose,
  gamesPlayed,
}: GameOverModalProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [challengeCopied, setChallengeCopied] = useState(false);

  const won = game.status === 'won';
  const eloDelta = game.elo_delta;
  const showElo = eloDelta !== null && game.rated;
  const celebrationTier = won ? getCelebrationTier(game.num_guesses) : null;

  const buildShareText = () => {
    const header = `ELOquence ${won ? game.num_guesses : 'X'}/6${
      won && game.num_guesses <= 3 ? ' ⭐' : ''
    }`;
    const wordElo = game.word_difficulty
      ? `Word ELO: ${game.word_difficulty.toLocaleString()}`
      : '';
    const grid = game.moves
      .map((move) => {
        const tiles = patternToTiles(move.pattern);
        return tiles.map((t) => TILE_EMOJI[t] ?? '⬛').join('');
      })
      .join('\n');
    return [header, wordElo, '', grid, '', 'eloquence.app']
      .filter((l) => l !== undefined)
      .join('\n')
      .trim();
  };

  const handleShare = async () => {
    const text = buildShareText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  const handleChallenge = async () => {
    try {
      const res = await challengesApi.create();
      const url = `${window.location.origin}/challenge/${res.data.code}`;
      await navigator.clipboard.writeText(url);
      setChallengeCopied(true);
      setTimeout(() => setChallengeCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  const stripeColor = won ? '#538d4e' : '#e74c3c';

  return (
    <>
      <Confetti
        active={
          open &&
          (celebrationTier === 'legendary' || celebrationTier === 'impressive')
        }
      />

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="game-over-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
            />

            {/* Modal centring layer */}
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label={won ? 'Game won' : 'Game over'}
            >
              <motion.div
                key="game-over-card"
                initial={{ opacity: 0, scale: 0.88, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 16 }}
                transition={springs.modal}
                className="
                  w-full max-w-sm
                  bg-[#1d1d21]
                  rounded-[16px]
                  border border-white/[0.08]
                  shadow-modal
                  overflow-hidden
                "
                onClick={(e) => e.stopPropagation()}
              >
                {/* Top colour stripe */}
                <div
                  className="h-[2px] w-full"
                  style={{ background: stripeColor }}
                />

                <div className="relative p-6 flex flex-col gap-5">
                  {/* Close */}
                  <button
                    onClick={() => onClose?.()}
                    aria-label="Close"
                    className="
                      absolute top-3 right-3
                      p-1.5 rounded-md
                      text-text-ghost hover:text-text-secondary
                      hover:bg-white/[0.06]
                      transition-colors duration-150
                    "
                  >
                    <X size={15} />
                  </button>

                  {/* Result hero */}
                  <div className="flex flex-col items-center gap-2 text-center">
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        delay: 0.1,
                        type: 'spring',
                        damping: 12,
                        stiffness: 220,
                      }}
                    >
                      {won ? (
                        <CheckCircle size={38} color="#538d4e" strokeWidth={1.8} />
                      ) : (
                        <XCircle size={38} color="#e74c3c" strokeWidth={1.8} />
                      )}
                    </motion.div>

                    <h2 className="text-xl font-bold text-text-primary leading-none">
                      {won
                        ? (celebrationTier ? WON_MESSAGES[celebrationTier] : 'Solved!')
                        : 'Not this time'}
                    </h2>

                    {won ? (
                      <p className="text-sm text-text-secondary">
                        Solved in{' '}
                        <span className="text-text-primary font-semibold">
                          {game.num_guesses}/6
                        </span>{' '}
                        {game.num_guesses === 1 ? 'guess' : 'guesses'}
                      </p>
                    ) : (
                      <p className="text-sm text-text-secondary">
                        The word was{' '}
                        <span className="text-text-primary font-semibold uppercase tracking-wider">
                          {game.target_word}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Stats pills */}
                  <div
                    className={`grid gap-2 ${
                      showElo && game.word_difficulty
                        ? 'grid-cols-3'
                        : showElo || game.word_difficulty
                        ? 'grid-cols-2'
                        : 'grid-cols-1'
                    }`}
                  >
                    <StatPill
                      label="Guesses"
                      value={won ? `${game.num_guesses}/6` : 'X/6'}
                    />

                    {showElo && (
                      <StatPill
                        label="Rating"
                        value={`${(eloDelta ?? 0) >= 0 ? '+' : ''}${Math.round(eloDelta ?? 0)}`}
                        valueClass={
                          (eloDelta ?? 0) >= 0 ? 'text-tile-correct' : 'text-[#e74c3c]'
                        }
                        animateIn
                        animateDelay={0.38}
                      />
                    )}

                    {game.word_difficulty && (
                      <StatPill
                        label="Word ELO"
                        value={Math.round(game.word_difficulty).toLocaleString()}
                      />
                    )}
                  </div>

                  {/* Hint text */}
                  {!isGuest && (
                    <p className="text-[10px] text-text-ghost text-center -mt-1">
                      Challenge a friend to beat your score
                    </p>
                  )}

                  {/* Placement badge */}
                  {!isGuest && game.is_placement && (
                    <div
                      className="text-center px-3 py-2 rounded-[10px]"
                      style={{
                        background: 'rgba(181,159,59,0.08)',
                        border: '1px solid rgba(181,159,59,0.2)',
                      }}
                    >
                      <span className="text-xs font-medium" style={{ color: '#b59f3b' }}>
                        Placement match
                        {gamesPlayed != null ? ` ${gamesPlayed}/5` : ''} — results
                        count toward your initial rating
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    {isGuest ? (
                      <>
                        {/* Primary */}
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => onClose?.()}
                          className="
                            w-full py-3 rounded-[10px]
                            bg-[#538d4e] hover:bg-[#6aaa64]
                            text-white font-semibold text-sm
                            transition-colors duration-150
                            flex items-center justify-center gap-2
                          "
                        >
                          Admire Puzzle
                        </motion.button>

                        {/* Secondary row */}
                        <div className="flex gap-2">
                          <SecondaryBtn
                            onClick={handleShare}
                            icon={<Share2 size={14} />}
                            label={copied ? 'Copied!' : 'Share'}
                            successIcon={<Check size={14} className="text-tile-correct" />}
                            success={copied}
                          />
                          <SecondaryBtn
                            onClick={() => router.push('/play')}
                            icon={<RotateCcw size={14} />}
                            label="Play Again"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Primary: Review */}
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => router.push(`/review/${game.id}`)}
                          className="
                            w-full py-3 rounded-[10px]
                            bg-[#538d4e] hover:bg-[#6aaa64]
                            text-white font-semibold text-sm
                            transition-colors duration-150
                            flex items-center justify-center gap-2
                          "
                        >
                          <BarChart2 size={15} />
                          Review Game
                        </motion.button>

                        {/* Secondary row */}
                        <div className="flex gap-2">
                          <SecondaryBtn
                            onClick={handleShare}
                            icon={<Share2 size={14} />}
                            label={copied ? 'Copied!' : 'Share'}
                            successIcon={<Check size={14} className="text-tile-correct" />}
                            success={copied}
                          />
                          <SecondaryBtn
                            onClick={handleChallenge}
                            icon={<Swords size={14} />}
                            label={challengeCopied ? 'Copied!' : 'Challenge'}
                            successIcon={<Check size={14} className="text-tile-correct" />}
                            success={challengeCopied}
                          />
                          <SecondaryBtn
                            onClick={() => router.push('/play')}
                            icon={<RotateCcw size={14} />}
                            label="Again"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
