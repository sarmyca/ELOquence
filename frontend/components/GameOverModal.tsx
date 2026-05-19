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
  ArrowLeft,
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

const pillItemVariants = {
  hidden: { scale: 0.7, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring' as const, damping: 14, stiffness: 280 },
  },
};

interface StatPillProps {
  label: string;
  value: string;
  highlight?: 'win' | 'loss' | 'neutral';
}

function StatPill({ label, value, highlight = 'neutral' }: StatPillProps) {
  const valueColor =
    highlight === 'win'
      ? 'var(--green)'
      : highlight === 'loss'
      ? 'var(--red)'
      : 'var(--text-primary)';

  return (
    <motion.div
      variants={pillItemVariants}
      className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-[10px]"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <span
        className="text-[9px] uppercase tracking-widest font-semibold"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </span>
      <span
        className="text-lg font-mono font-bold leading-none"
        style={{ color: valueColor }}
      >
        {value}
      </span>
    </motion.div>
  );
}

const pillContainerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.12 },
  },
};

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
      className="flex-1 py-2.5 rounded-[10px] font-medium text-sm transition-colors duration-150 flex items-center justify-center gap-1.5 min-w-0"
      style={{
        background: 'var(--bg-muted)',
        border: '1px solid var(--border-default)',
        color: 'var(--text-primary)',
      }}
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

  const stripeColor = won ? 'var(--green)' : 'var(--red)';

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
            {/* Backdrop — light: translucent white blur; dark: dark blur */}
            <motion.div
              key="game-over-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 backdrop-blur-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}
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
                className="w-full max-w-sm rounded-card-lg overflow-hidden"
                style={{
                  backgroundColor: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Top colour stripe */}
                <div className="h-[2px] w-full" style={{ background: stripeColor }} />

                <div className="relative p-6 flex flex-col gap-5">
                  {/* Close */}
                  <button
                    onClick={() => onClose?.()}
                    aria-label="Close"
                    className="absolute top-3 right-3 p-1.5 rounded-md transition-colors duration-150"
                    style={{ color: 'var(--text-tertiary)' }}
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
                        <CheckCircle size={38} style={{ color: 'var(--green)' }} strokeWidth={1.8} />
                      ) : (
                        <XCircle size={38} style={{ color: 'var(--red)' }} strokeWidth={1.8} />
                      )}
                    </motion.div>

                    <h2
                      className="text-xl font-bold leading-none"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {won
                        ? (celebrationTier ? WON_MESSAGES[celebrationTier] : 'Solved!')
                        : 'Not this time'}
                    </h2>

                    {won ? (
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Solved in{' '}
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {game.num_guesses}/6
                        </span>{' '}
                        {game.num_guesses === 1 ? 'guess' : 'guesses'}
                      </p>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        The word was{' '}
                        <span className="font-semibold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                          {game.target_word}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Stats pills */}
                  <motion.div
                    variants={pillContainerVariants}
                    initial="hidden"
                    animate="visible"
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
                        highlight={(eloDelta ?? 0) >= 0 ? 'win' : 'loss'}
                      />
                    )}

                    {game.word_difficulty && (
                      <StatPill
                        label="Word ELO"
                        value={Math.round(game.word_difficulty).toLocaleString()}
                      />
                    )}
                  </motion.div>

                  {/* Hint text */}
                  {!isGuest && (
                    <p
                      className="text-[10px] text-center -mt-1"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      Challenge a friend to beat your score
                    </p>
                  )}

                  {/* Placement badge */}
                  {!isGuest && game.is_placement && (
                    <div
                      className="text-center px-3 py-2 rounded-[10px]"
                      style={{
                        background: 'rgba(201,180,88,0.08)',
                        border: '1px solid rgba(201,180,88,0.25)',
                      }}
                    >
                      <span className="text-xs font-medium" style={{ color: 'var(--yellow)' }}>
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
                          className="w-full py-3 rounded-[10px] text-white font-semibold text-sm transition-colors duration-150 flex items-center justify-center gap-2"
                          style={{ backgroundColor: 'var(--tile-correct)' }}
                        >
                          Admire Puzzle
                        </motion.button>

                        {/* Secondary row */}
                        <div className="flex gap-2">
                          <SecondaryBtn
                            onClick={handleShare}
                            icon={<Share2 size={14} />}
                            label={copied ? 'Copied!' : 'Share'}
                            successIcon={<Check size={14} style={{ color: 'var(--green)' }} />}
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
                          className="w-full py-3 rounded-[10px] text-white font-semibold text-sm transition-colors duration-150 flex items-center justify-center gap-2"
                          style={{ backgroundColor: 'var(--tile-correct)' }}
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
                            successIcon={<Check size={14} style={{ color: 'var(--green)' }} />}
                            success={copied}
                          />
                          <SecondaryBtn
                            onClick={handleChallenge}
                            icon={<Swords size={14} />}
                            label={challengeCopied ? 'Copied!' : 'Challenge'}
                            successIcon={<Check size={14} style={{ color: 'var(--green)' }} />}
                            success={challengeCopied}
                          />
                          <SecondaryBtn
                            onClick={() => router.push('/play')}
                            icon={<ArrowLeft size={14} />}
                            label="Back"
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
