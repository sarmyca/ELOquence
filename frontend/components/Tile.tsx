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

/**
 * OG Wordle tile rules:
 *  empty   — no background, 2px border at --tile-empty-border
 *  tbd     — no background, 2px border at --tile-tbd-border (thicker-looking; same px, darker shade)
 *  revealed — saturated fill color, no border, white text
 */
const STATE_STYLES: Record<TileState, string> = {
  empty:   '',   // handled inline via CSS vars
  tbd:     '',   // handled inline via CSS vars
  correct: 'border-2',
  present: 'border-2',
  absent:  'border-2',
};

const REVEALED_SHADOW = 'inset 0 -2px 0 rgba(0,0,0,0.18)';

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

  // Inline styles for empty/tbd states (CSS vars, theme-aware)
  function getInlineStyle(): React.CSSProperties {
    if (state === 'empty') {
      return {
        backgroundColor: 'var(--tile-empty-bg)',
        border: '2px solid var(--tile-empty-border)',
      };
    }
    if (state === 'tbd') {
      return {
        backgroundColor: 'var(--tile-empty-bg)',
        border: '2px solid var(--tile-tbd-border)',
      };
    }
    if (state === 'correct') {
      return {
        backgroundColor: 'var(--tile-correct)',
        borderColor: 'var(--tile-correct)',
        boxShadow: REVEALED_SHADOW,
      };
    }
    if (state === 'present') {
      return {
        backgroundColor: 'var(--tile-present)',
        borderColor: 'var(--tile-present)',
        boxShadow: REVEALED_SHADOW,
      };
    }
    // absent
    return {
      backgroundColor: 'var(--tile-absent)',
      borderColor: 'var(--tile-absent)',
      boxShadow: REVEALED_SHADOW,
    };
  }

  // Text color: white for revealed tiles; theme-primary for empty/tbd
  const textColor = isRevealed
    ? '#ffffff'
    : 'var(--text-primary)';

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
        transition={{ type: 'spring', damping: 20, stiffness: 800, mass: 0.25 }}
        className="w-full h-full"
      >
        {isFlipping && isRevealed ? (
          <FlipTile letter={letter} state={state} flipDelay={flipDelay} />
        ) : (
          <div
            className={clsx(
              'w-full h-full flex items-center justify-center rounded-tile',
              STATE_STYLES[state]
            )}
            style={getInlineStyle()}
          >
            <span
              className="font-bold uppercase select-none font-sans"
              style={{
                fontSize: 'clamp(1.1rem, 3.5vw, 1.5rem)',
                color: textColor,
              }}
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

  function getFaceStyle(): React.CSSProperties {
    if (!showRevealed) {
      return {
        backgroundColor: 'var(--tile-empty-bg)',
        border: '2px solid var(--tile-tbd-border)',
      };
    }
    if (state === 'correct') return { backgroundColor: 'var(--tile-correct)', borderColor: 'var(--tile-correct)', border: '2px solid var(--tile-correct)', boxShadow: REVEALED_SHADOW };
    if (state === 'present') return { backgroundColor: 'var(--tile-present)', borderColor: 'var(--tile-present)', border: '2px solid var(--tile-present)', boxShadow: REVEALED_SHADOW };
    return { backgroundColor: 'var(--tile-absent)', borderColor: 'var(--tile-absent)', border: '2px solid var(--tile-absent)', boxShadow: REVEALED_SHADOW };
  }

  const textColor = showRevealed ? '#ffffff' : 'var(--text-primary)';

  return (
    <motion.div
      className="w-full h-full flex items-center justify-center rounded-tile"
      style={getFaceStyle()}
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
        className="font-bold uppercase select-none font-sans"
        style={{
          fontSize: 'clamp(1.1rem, 3.5vw, 1.5rem)',
          color: textColor,
        }}
      >
        {letter}
      </span>
    </motion.div>
  );
}
