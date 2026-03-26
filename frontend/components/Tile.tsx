'use client';
import { useState, useEffect } from 'react';
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
  empty:   'bg-[#1d1d21] border-2 border-white/[0.10]',
  tbd:     'bg-[#1d1d21] border-2 border-white/[0.25]',
  correct: 'bg-[#538d4e] border-2 border-[#538d4e]',
  present: 'bg-[#b59f3b] border-2 border-[#b59f3b]',
  absent:  'bg-[#3a3a3c] border-2 border-[#3a3a3c]',
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

  const popKey = `${letter}-${state}`;

  const ariaLabel = letter
    ? `${letter}, ${
        state === 'correct'
          ? 'correct'
          : state === 'present'
          ? 'present'
          : state === 'absent'
          ? 'absent'
          : 'empty'
      }, position ${position + 1}`
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
      {/* Pop scale when a letter is typed */}
      <motion.div
        key={popKey}
        initial={isTbd ? { scale: 1.08 } : { scale: 1 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 700, mass: 0.35 }}
        className="w-full h-full"
      >
        {isFlipping && isRevealed ? (
          <FlipTile letter={letter} state={state} flipDelay={flipDelay} />
        ) : (
          <div
            className={clsx(
              'w-full h-full flex items-center justify-center rounded-[4px]',
              STATE_STYLES[state]
            )}
          >
            <span
              className="font-bold uppercase select-none text-white"
              style={{ fontSize: 'clamp(1.1rem, 3.5vw, 1.5rem)' }}
            >
              {letter}
            </span>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/**
 * Two-phase flip: rotates to 90deg (edge-on), swaps face color at midpoint,
 * then rotates back to 0. Avoids flash of wrong color.
 */
function FlipTile({
  letter,
  state,
  flipDelay,
}: {
  letter: string;
  state: TileState;
  flipDelay: number;
}) {
  const [showRevealed, setShowRevealed] = useState(false);

  const halfDuration = 0.25;
  useEffect(() => {
    const timer = setTimeout(
      () => setShowRevealed(true),
      (flipDelay + halfDuration) * 1000
    );
    return () => clearTimeout(timer);
  }, [flipDelay]);

  const faceStyle = showRevealed ? STATE_STYLES[state] : STATE_STYLES.tbd;

  return (
    <motion.div
      className={clsx(
        'w-full h-full flex items-center justify-center rounded-[4px]',
        faceStyle
      )}
      initial={{ rotateX: 0 }}
      animate={{ rotateX: [0, 90, 0] }}
      transition={{
        duration: 0.5,
        delay: flipDelay,
        times: [0, 0.5, 1],
        ease: 'easeInOut',
      }}
    >
      <span
        className="font-bold uppercase select-none text-white"
        style={{ fontSize: 'clamp(1.1rem, 3.5vw, 1.5rem)' }}
      >
        {letter}
      </span>
    </motion.div>
  );
}
