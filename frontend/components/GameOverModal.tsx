'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Share2, RotateCcw, BarChart2, Check, Swords } from 'lucide-react';
import { Game, patternToTiles } from '@/lib/types';
import { springs } from '@/lib/animations';
import { challengesApi } from '@/lib/api';
import Confetti from './Confetti';

interface GameOverModalProps {
  game: Game;
  open: boolean;
  isGuest?: boolean;
  onClose?: () => void;
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

export default function GameOverModal({ game, open, isGuest = false, onClose }: GameOverModalProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [challengeCopied, setChallengeCopied] = useState(false);

  const won = game.status === 'won';
  const eloDelta = game.elo_delta;
  const showElo = eloDelta !== null && game.rated;
  const celebrationTier = won ? getCelebrationTier(game.num_guesses) : null;

  const buildShareText = () => {
    const header = `ELOquence ${won ? game.num_guesses : 'X'}/6${won && game.num_guesses <= 3 ? ' ⭐' : ''}`;
    const wordElo = game.word_difficulty
      ? `Word ELO: ${game.word_difficulty.toLocaleString()}`
      : '';

    const grid = game.moves
      .map((move) => {
        const tiles = patternToTiles(move.pattern);
        return tiles.map((t) => TILE_EMOJI[t] || '⬛').join('');
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
      // Fallback
    }
  };

  return (
    <>
      <Confetti
        active={open && (celebrationTier === 'legendary' || celebrationTier === 'impressive')}
      />
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={springs.modal}
              className="w-full max-w-sm bg-bg-secondary rounded-2xl border border-white/[0.1] shadow-2xl overflow-hidden"
            >
              {/* Header stripe */}
              <div
                className={`h-1.5 w-full ${won ? 'bg-tile-correct' : 'bg-[#e74c3c]'}`}
              />

              <div className="p-6 flex flex-col gap-5">
                {/* Result */}
                <div className="flex flex-col items-center gap-2 text-center">
                  {won ? (
                    <CheckCircle size={36} className="text-tile-correct" />
                  ) : (
                    <XCircle size={36} className="text-[#e74c3c]" />
                  )}
                  <h2 className="text-xl font-bold text-text-primary">
                    {won ? (celebrationTier ? WON_MESSAGES[celebrationTier] : 'Solved!') : 'Not this time'}
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
                      <span className="text-text-primary font-semibold uppercase">
                        {game.target_word}
                      </span>
                    </p>
                  )}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Guesses */}
                  <div className="flex flex-col items-center gap-0.5 p-2.5 rounded-lg bg-bg-tertiary">
                    <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium">
                      Guesses
                    </span>
                    <span className="text-lg font-mono font-bold text-text-primary">
                      {won ? `${game.num_guesses}/6` : 'X/6'}
                    </span>
                  </div>

                  {/* ELO delta */}
                  {showElo && (
                    <div className="flex flex-col items-center gap-0.5 p-2.5 rounded-lg bg-bg-tertiary">
                      <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium">
                        Rating
                      </span>
                      <motion.span
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.4, type: 'spring', damping: 15, stiffness: 300 }}
                        className={`text-lg font-mono font-bold ${
                          (eloDelta ?? 0) >= 0 ? 'text-tile-correct' : 'text-[#e74c3c]'
                        }`}
                      >
                        {(eloDelta ?? 0) >= 0 ? '+' : ''}
                        {Math.round(eloDelta ?? 0)}
                      </motion.span>
                    </div>
                  )}

                  {/* Word difficulty */}
                  {game.word_difficulty && (
                    <div className="flex flex-col items-center gap-0.5 p-2.5 rounded-lg bg-bg-tertiary">
                      <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium">
                        Word ELO
                      </span>
                      <span className="text-lg font-mono font-bold text-text-primary">
                        {Math.round(game.word_difficulty).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Community benchmark hint */}
                {!isGuest && (
                  <p className="text-[10px] text-text-ghost text-center">
                    Challenge a friend to beat your score
                  </p>
                )}

                {/* Placement badge */}
                {!isGuest && game.is_placement && (
                  <div className="text-center px-3 py-2 rounded-lg bg-[#b59f3b]/10 border border-[#b59f3b]/20">
                    <span className="text-xs text-[#b59f3b] font-medium">
                      Placement match — results count toward your initial rating
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  {isGuest ? (
                    <>
                      {/* Dismiss modal to admire the board */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onClose?.()}
                        className="w-full py-3 rounded-xl bg-[#538d4e] hover:bg-[#6aaa64] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        Admire Puzzle
                      </motion.button>
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={handleShare}
                          className="flex-1 py-2.5 rounded-xl bg-bg-tertiary hover:bg-bg-elevated text-text-primary font-medium text-sm transition-colors flex items-center justify-center gap-2 border border-white/[0.08]"
                        >
                          {copied ? <Check size={15} className="text-tile-correct" /> : <Share2 size={15} />}
                          {copied ? 'Copied!' : 'Share'}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => router.push('/play')}
                          className="flex-1 py-2.5 rounded-xl bg-bg-tertiary hover:bg-bg-elevated text-text-primary font-medium text-sm transition-colors flex items-center justify-center gap-2 border border-white/[0.08]"
                        >
                          <RotateCcw size={15} />
                          Play Again
                        </motion.button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Primary: Review Game */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => router.push(`/review/${game.id}`)}
                        className="w-full py-3 rounded-xl bg-[#538d4e] hover:bg-[#6aaa64] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        <BarChart2 size={16} />
                        Review Game
                      </motion.button>

                      <div className="flex gap-2">
                        {/* Share */}
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={handleShare}
                          className="flex-1 py-2.5 rounded-xl bg-bg-tertiary hover:bg-bg-elevated text-text-primary font-medium text-sm transition-colors flex items-center justify-center gap-2 border border-white/[0.08]"
                        >
                          {copied ? <Check size={15} className="text-tile-correct" /> : <Share2 size={15} />}
                          {copied ? 'Copied!' : 'Share'}
                        </motion.button>

                        {/* Challenge */}
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={async () => {
                            try {
                              const res = await challengesApi.create();
                              const url = `${window.location.origin}/challenge/${res.data.code}`;
                              await navigator.clipboard.writeText(url);
                              setChallengeCopied(true);
                              setTimeout(() => setChallengeCopied(false), 2000);
                            } catch {
                              // Fallback: do nothing
                            }
                          }}
                          className="flex-1 py-2.5 rounded-xl bg-bg-tertiary hover:bg-bg-elevated text-text-primary font-medium text-sm transition-colors flex items-center justify-center gap-2 border border-white/[0.08]"
                        >
                          {challengeCopied ? (
                            <Check size={15} className="text-tile-correct" />
                          ) : (
                            <Swords size={15} />
                          )}
                          {challengeCopied ? 'Copied!' : 'Challenge'}
                        </motion.button>

                        {/* Play Again */}
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => router.push('/play')}
                          className="flex-1 py-2.5 rounded-xl bg-bg-tertiary hover:bg-bg-elevated text-text-primary font-medium text-sm transition-colors flex items-center justify-center gap-2 border border-white/[0.08]"
                        >
                          <RotateCcw size={15} />
                          Play Again
                        </motion.button>
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
