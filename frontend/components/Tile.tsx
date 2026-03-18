'use client';
import { motion } from 'framer-motion';
import { TileState } from '@/lib/types';
import clsx from 'clsx';

interface TileProps {
  letter?: string;
  state: TileState;
  position?: number;
  /** When true this tile is animating its flip reveal right now */
  isFlipping?: boolean;
  /** Seconds to delay before starting the flip */
  flipDelay?: number;
}

const STATE_STYLES: Record<TileState, string> = {
  empty: 'border border-white/[0.15] bg-[#1e1f23]',
  tbd: 'border border-white/[0.3] bg-[#1e1f23]',
  correct: 'bg-tile-correct border border-tile-correct',
  present: 'bg-tile-present border border-tile-present',
  absent: 'bg-tile-absent border border-tile-absent',
};

const STATE_TEXT: Record<TileState, string> = {
  empty: 'text-text-primary',
  tbd: 'text-text-primary',
  correct: 'text-white',
  present: 'text-white',
  absent: 'text-white',
};

export default function Tile({
  letter = '',
  state,
  position = 0,
  isFlipping = false,
  flipDelay = 0,
}: TileProps) {
  const isRevealed = state === 'correct' || state === 'present' || state === 'absent';
  const isTbd = state === 'tbd' && letter !== '';

  // When a letter is typed (tbd state with letter), pop animation runs once
  const popKey = `${letter}-${state}`;

  const ariaLabel = letter
    ? `${letter}, ${state === 'correct' ? 'correct' : state === 'present' ? 'present' : state === 'absent' ? 'absent' : 'empty'}, position ${position + 1}`
    : `empty, position ${position + 1}`;

  return (
    <div
      className="relative"
      aria-label={ariaLabel}
      style={{
        width: 'var(--tile-size)',
        height: 'var(--tile-size)',
        perspective: '300px',
      }}
    >
      {/* Pop scale animation when a letter is typed */}
      <motion.div
        key={popKey}
        initial={isTbd ? { scale: 1.1 } : { scale: 1 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 600, mass: 0.4 }}
        className="w-full h-full"
      >
        {isFlipping && isRevealed ? (
          /* ---- Flip reveal animation ---- */
          <motion.div
            className="w-full h-full relative"
            style={{ transformStyle: 'preserve-3d' }}
            initial={{ rotateX: 0 }}
            animate={{ rotateX: [0, -90, -90, 0] }}
            transition={{
              duration: 0.5,
              delay: flipDelay,
              times: [0, 0.4, 0.6, 1],
              ease: 'easeInOut',
            }}
          >
            {/* Front face — tbd style shown until mid-flip */}
            <div
              className={clsx(
                'absolute inset-0 flex items-center justify-center rounded-sm',
                STATE_STYLES.tbd
              )}
              style={{ backfaceVisibility: 'hidden' }}
            >
              <span className="text-2xl font-bold uppercase text-text-primary select-none">
                {letter}
              </span>
            </div>

            {/* Back face — revealed color */}
            <div
              className={clsx(
                'absolute inset-0 flex items-center justify-center rounded-sm',
                STATE_STYLES[state]
              )}
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateX(180deg)',
              }}
            >
              <span
                className={clsx(
                  'text-2xl font-bold uppercase select-none',
                  STATE_TEXT[state]
                )}
              >
                {letter}
              </span>
            </div>
          </motion.div>
        ) : (
          /* ---- Static tile ---- */
          <div
            className={clsx(
              'w-full h-full flex items-center justify-center rounded-sm',
              STATE_STYLES[state]
            )}
          >
            <span
              className={clsx(
                'text-2xl font-bold uppercase select-none',
                STATE_TEXT[state]
              )}
            >
              {letter}
            </span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
