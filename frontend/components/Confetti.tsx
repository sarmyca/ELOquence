'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  active: boolean;
  count?: number;
  duration?: number;
  colors?: string[];
}

function getCSSVarColors(): string[] {
  if (typeof window === 'undefined') {
    return ['#538d4e', '#6aaa64', '#b59f3b', '#c9b458', '#e74c3c', '#1565c0'];
  }
  const style = getComputedStyle(document.documentElement);
  const correct = style.getPropertyValue('--tile-correct').trim() || '#6aaa64';
  const present = style.getPropertyValue('--tile-present').trim() || '#c9b458';
  const red = style.getPropertyValue('--red').trim() || '#e74c3c';
  const green = style.getPropertyValue('--green').trim() || '#6aaa64';
  const yellow = style.getPropertyValue('--yellow').trim() || '#c9b458';
  return [correct, green, present, yellow, red, '#1565c0'];
}

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
  fallDistance: number;
}

function buildParticles(count: number, colors: string[]): Particle[] {
  const fallDistance =
    typeof window !== 'undefined' ? window.innerHeight + 60 : 900;
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
      fallDistance,
    };
  });
}

export default function Confetti({
  active,
  count = 60,
  duration = 2800,
  colors,
}: Props) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!active || reducedMotion) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setParticles([]);
      return;
    }

    const resolvedColors = colors ?? getCSSVarColors();
    setParticles(buildParticles(count, resolvedColors));
    timerRef.current = setTimeout(() => setParticles([]), duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, count, duration, colors, reducedMotion]);

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
                  x: `${p.x}vw`,
                  y: 0,
                  opacity: 1,
                  rotate: p.rotation,
                  scale: 1,
                }}
                animate={{
                  y: p.fallDistance,
                  x: [`${p.x}vw`, `calc(${p.x}vw + ${p.drift}px)`],
                  opacity: [1, 1, 0.7, 0],
                  rotate: p.rotationEnd,
                  scale: isRibbon ? [1, 0.9, 1, 0.8] : [1, 0.85, 0.7],
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
                  top: -12,
                  left: 0,
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
