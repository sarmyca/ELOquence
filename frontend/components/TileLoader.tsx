'use client';

import { motion } from 'framer-motion';

/* Three small ELOquence tiles that flip in sequence through the Wordle
 * colour cycle (gray → yellow → green). Replaces the generic spinning
 * circle for full-page loading states so the wait still feels on-brand.
 *
 * Reach for the plain spinner inside buttons or other compact CTAs —
 * this loader is centre-of-screen scale and would look out of place
 * inline.
 */

const COLORS = [
  'var(--tile-absent)',
  'var(--tile-present)',
  'var(--tile-correct)',
  'var(--tile-absent)',
];

interface TileLoaderProps {
  /** Edge length of each tile in pixels. Defaults to 18px. */
  size?: number;
  /** Accessible label announced to screen readers. */
  label?: string;
  /** Extra classes for the wrapping flex container. */
  className?: string;
}

export default function TileLoader({
  size = 18,
  label = 'Loading',
  className = '',
}: TileLoaderProps) {
  const gap = Math.max(3, Math.round(size / 5));
  return (
    <div
      className={`flex items-center ${className}`}
      style={{ gap, perspective: 200 }}
      role="status"
      aria-label={label}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          style={{
            width: size,
            height: size,
            borderRadius: Math.max(2, Math.round(size / 5)),
            display: 'inline-block',
            transformStyle: 'preserve-3d',
            backgroundColor: 'var(--tile-absent)',
          }}
          animate={{
            rotateY: [0, 180, 360, 360],
            backgroundColor: COLORS,
          }}
          transition={{
            duration: 1.4,
            ease: 'easeInOut',
            repeat: Infinity,
            delay: i * 0.16,
            times: [0, 0.35, 0.7, 1],
          }}
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
