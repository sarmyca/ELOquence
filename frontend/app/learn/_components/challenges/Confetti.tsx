'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

/* Tiny particle burst for correct-answer feedback. No external dep — just
 * 14 absolutely-positioned divs animating outward + fading. Rendered as a
 * one-shot when a challenge resolves correctly.
 */

const COLORS = [
  'var(--tile-correct)',
  'var(--tile-present)',
  'var(--cls-blue, #3b82f6)',
  '#ffffff',
];

export default function Confetti({ trigger }: { trigger: number }) {
  // `trigger` is just a counter — bumping it remounts the burst.
  const pieces = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.3;
      const dist = 70 + Math.random() * 60;
      return {
        id: i,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        rot: (Math.random() - 0.5) * 360,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 0.05,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return (
    <div
      key={trigger}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
      }}
      aria-hidden="true"
    >
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{
            x: p.x,
            y: p.y,
            opacity: 0,
            rotate: p.rot,
            scale: 0.6,
          }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: p.delay }}
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            background: p.color,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}
