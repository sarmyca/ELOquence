'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  active: boolean;
  count?: number;
  duration?: number;
  colors?: string[];
}

const WORDLE_COLORS = [
  '#538d4e',
  '#6aaa64',
  '#b59f3b',
  '#c9b458',
  '#e74c3c',
  '#1565c0',
];

type Shape = 'square' | 'ribbon';

interface Particle {
  id: number;
  x: number;
  color: string;
  delay: number;
  rotation: number;
  rotationEnd: number;
  size: number;
  fallDuration: number;
  drift: number;
  shape: Shape;
}

function buildParticles(count: number, colors: string[]): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const shape: Shape = Math.random() < 0.55 ? 'square' : 'ribbon';
    const baseSize = shape === 'square' ? 5 + Math.random() * 5 : 3 + Math.random() * 3;
    return {
      id: i,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.65,
      rotation: Math.random() * 360,
      rotationEnd: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
      size: baseSize,
      fallDuration: 1.6 + Math.random() * 1.2,
      drift: (Math.random() - 0.5) * 60,
      shape,
    };
  });
}

export default function Confetti({
  active,
  count = 60,
  duration = 2800,
  colors = WORDLE_COLORS,
}: Props) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setParticles([]);
      return;
    }

    setParticles(buildParticles(count, colors));
    timerRef.current = setTimeout(() => setParticles([]), duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, count, duration, colors]);

  return (
    <AnimatePresence>
      {particles.length > 0 && (
        <div
          className="fixed inset-0 z-[100] pointer-events-none overflow-hidden"
          aria-hidden="true"
        >
          {particles.map((p) => {
            const isRibbon = p.shape === 'ribbon';
            return (
              <motion.div
                key={p.id}
                initial={{
                  top: -12,
                  left: `${p.x}vw`,
                  opacity: 1,
                  rotate: p.rotation,
                  scale: 1,
                  x: 0,
                }}
                animate={{
                  top: '108vh',
                  opacity: [1, 1, 0.7, 0],
                  rotate: p.rotationEnd,
                  scale: isRibbon ? [1, 0.9, 1, 0.8] : [1, 0.85, 0.7],
                  x: p.drift,
                }}
                transition={{
                  duration: p.fallDuration,
                  delay: p.delay,
                  ease: [0.2, 0, 0.8, 1],
                  opacity: { times: [0, 0.5, 0.8, 1] },
                  scale: isRibbon
                    ? { times: [0, 0.3, 0.6, 1], repeat: Infinity, duration: 0.4 }
                    : undefined,
                }}
                style={{
                  position: 'absolute',
                  width: isRibbon ? p.size * 0.5 : p.size,
                  height: isRibbon ? p.size * 3.2 : p.size,
                  backgroundColor: p.color,
                  borderRadius: isRibbon ? 1 : 2,
                }}
              />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}
