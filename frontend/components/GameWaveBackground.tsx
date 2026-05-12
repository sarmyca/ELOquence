'use client';
import { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { patternToTiles } from '@/lib/types';
import type { GameStatus } from '@/lib/types';

interface GameWaveBackgroundProps {
  patterns: number[];
  status: GameStatus;
  triggerKey: number;
  lastPattern: number | null;
}

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}

function lerp3(a: RGB, b: RGB, t: number): RGB {
  const s = Math.min(1, Math.max(0, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * s),
    Math.round(a[1] + (b[1] - a[1]) * s),
    Math.round(a[2] + (b[2] - a[2]) * s),
  ];
}

function rgba(c: RGB, a: number): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a.toFixed(3)})`;
}

function cssRgb(varName: string, fallback: string): RGB {
  if (typeof document === 'undefined') return hexToRgb(fallback);
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return hexToRgb(raw || fallback);
}

function blobColors(
  patterns: number[], status: GameStatus, correct: RGB, present: RGB, isDark: boolean,
): [string, string, string] {
  const charcoal: RGB = isDark ? [60, 60, 65] : [180, 180, 185];
  const lostAlpha = isDark ? 0.45 : 0.30;
  if (status === 'lost') return [rgba(charcoal, lostAlpha), rgba(charcoal, lostAlpha), rgba(charcoal, lostAlpha)];

  let green = 0, yellow = 0;
  for (const p of patterns) {
    for (const t of patternToTiles(p)) {
      if (t === 'correct') green++;
      else if (t === 'present') yellow++;
    }
  }
  const denom = Math.max(patterns.length * 5, 1);
  const g = green / denom, y = yellow / denom;
  const activity = Math.min(1, g * 2 + y);
  const alpha = isDark ? 0.35 + activity * 0.25 : 0.18 + activity * 0.22;

  if (status === 'won') return [rgba(correct, alpha), rgba(correct, alpha), rgba(correct, alpha)];

  const idleTop: RGB = isDark ? [35, 38, 45] : [225, 228, 232];
  const idleBl: RGB  = isDark ? [28, 31, 38] : [222, 226, 230];
  const idleBr: RGB  = isDark ? [30, 30, 32] : [220, 224, 228];
  const brBase = lerp3(correct, present, 0.5);
  return [
    rgba(lerp3(idleTop, correct, activity * Math.min(1, g * 2.5)), alpha),
    rgba(lerp3(idleBl,  present, activity * Math.min(1, y * 2.5)), alpha),
    rgba(lerp3(idleBr,  brBase,  activity * Math.min(1, (g + y) * 1.2)), alpha),
  ];
}

function accentColor(pattern: number, correct: RGB, present: RGB, isDark: boolean): string {
  const tiles = patternToTiles(pattern);
  const g = tiles.filter((t) => t === 'correct').length;
  const y = tiles.filter((t) => t === 'present').length;
  const tot = g + y || 1;
  const c = lerp3(present, correct, g / tot);
  return rgba(c, isDark ? 0.45 : 0.30);
}

export default function GameWaveBackground({ patterns, status, triggerKey, lastPattern }: GameWaveBackgroundProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const sync = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const correct = useMemo(() => cssRgb('--tile-correct', '#538d4e'), [patterns]);
  const present = useMemo(() => cssRgb('--tile-present', '#b59f3b'), [patterns]);
  const [topC, blC, brC] = useMemo(() => blobColors(patterns, status, correct, present, isDark), [patterns, status, correct, present, isDark]);
  const accC = useMemo(() => lastPattern !== null ? accentColor(lastPattern, correct, present, isDark) : null, [lastPattern, correct, present, isDark]);

  const tr = reducedMotion ? '0ms' : 'background 1500ms cubic-bezier(0.4, 0, 0.2, 1)';
  const blob = (bg: string) => ({ position: 'absolute' as const, inset: 0, background: bg, filter: 'blur(80px)', transition: tr });

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ mixBlendMode: isDark ? 'screen' : 'multiply' }}
      animate={status === 'won' && !reducedMotion ? { opacity: [1, 1.25, 1] } : { opacity: 1 }}
      transition={status === 'won' && !reducedMotion ? { duration: 0.7, ease: 'easeOut', times: [0, 0.4, 1] } : undefined}
    >
      <div style={blob(`radial-gradient(60% 50% at 50% -10%, ${topC}, transparent 70%)`)} />
      <div style={blob(`radial-gradient(45% 45% at 0% 115%, ${blC}, transparent 70%)`)} />
      <div style={blob(`radial-gradient(50% 50% at 105% 110%, ${brC}, transparent 70%)`)} />
      {!reducedMotion && (
        <AnimatePresence>
          {accC !== null && triggerKey > 0 && (
            <motion.div
              key={triggerKey}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 0.45, scale: 1.0 }}
              exit={{ opacity: 0, scale: 1.0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{ position: 'absolute', inset: 0, background: `radial-gradient(35% 35% at 50% 45%, ${accC}, transparent 70%)`, filter: 'blur(80px)' }}
            />
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
}
