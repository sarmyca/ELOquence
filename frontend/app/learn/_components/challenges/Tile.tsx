'use client';

import { motion } from 'framer-motion';
import { TileState } from '../TileRow';

/* A single animated tile used inside challenges. Slightly larger + with
 * flip animation when state transitions, since challenges are the focal
 * point of the page (unlike review-page TileRow, where they're a side
 * indicator).
 */

const COLOUR: Record<TileState, string> = {
  correct: 'var(--tile-correct)',
  present: 'var(--tile-present)',
  absent: 'var(--tile-absent)',
  empty: 'transparent',
};

export default function GameTile({
  letter,
  state,
  size = 56,
  onClick,
  highlight = false,
}: {
  letter: string;
  state: TileState;
  size?: number;
  onClick?: () => void;
  highlight?: boolean;
}) {
  const filled = state !== 'empty';
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={onClick ? { scale: 1.05 } : undefined}
      whileTap={onClick ? { scale: 0.95 } : undefined}
      animate={{
        backgroundColor: filled ? COLOUR[state] : 'transparent',
        rotateX: filled ? 0 : 0,
      }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        border: highlight
          ? '2.5px solid var(--cls-blue, #3b82f6)'
          : filled
            ? 'none'
            : '2px solid var(--border-default)',
        color: filled ? '#fff' : 'var(--text-primary)',
        fontSize: size * 0.42,
        fontWeight: 800,
        fontFamily: 'var(--font-sans)',
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        padding: 0,
        userSelect: 'none',
        boxShadow: highlight ? '0 0 0 4px color-mix(in srgb, var(--cls-blue, #3b82f6) 18%, transparent)' : 'none',
        transition: 'box-shadow 200ms ease, border-color 200ms ease',
      }}
    >
      {letter}
    </motion.button>
  );
}
