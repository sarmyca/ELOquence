'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  active: boolean;
  count?: number;
  duration?: number;
  colors?: string[];
}

const DEFAULT_COLORS = ['#538d4e', '#6aaa64', '#b59f3b', '#1565c0', '#c9a227', '#e74c3c'];

interface Particle {
  id: number;
  x: number;
  color: string;
  delay: number;
  rotation: number;
  size: number;
  fallDuration: number;
}

export default function Confetti({
  active,
  count = 50,
  duration = 2500,
  colors = DEFAULT_COLORS,
}: Props) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }

    const p: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.5,
      rotation: Math.random() * 720 - 360,
      size: 4 + Math.random() * 6,
      fallDuration: 1.5 + Math.random(),
    }));

    setParticles(p);
    const t = setTimeout(() => setParticles([]), duration);
    return () => clearTimeout(t);
  }, [active, count, duration, colors]);

  return (
    <AnimatePresence>
      {particles.length > 0 && (
        <div
          className="fixed inset-0 z-[100] pointer-events-none overflow-hidden"
          aria-hidden="true"
        >
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0, scale: 1 }}
              animate={{ y: '110vh', opacity: 0, rotate: p.rotation, scale: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: p.fallDuration, delay: p.delay, ease: 'easeIn' }}
              style={{
                position: 'absolute',
                width: p.size,
                height: p.size * 0.6,
                backgroundColor: p.color,
                borderRadius: 1,
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
