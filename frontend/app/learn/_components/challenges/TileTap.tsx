'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import GameTile from './Tile';
import { scoreGuess } from './score';
import type { TileTapChallenge } from './types';
import type { TileState } from '../TileRow';

/* "Click the tile that should be GREEN" — given a guess + target. The
 * board renders with all tiles starting blank-revealable; user clicks
 * one, we check vs the canonical pattern + correctIdx. Wrong tap → shake.
 * Right tap → flip + glow.
 */

export default function TileTap({
  challenge,
  onResolve,
}: {
  challenge: TileTapChallenge;
  onResolve: (correct: boolean) => void;
}) {
  const [tapped, setTapped] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<'correct' | 'wrong' | null>(null);
  const truth = scoreGuess(challenge.guess, challenge.target);

  function handleTap(i: number) {
    if (outcome === 'correct') return;
    setTapped(i);
    const ok = i === challenge.correctIdx;
    setOutcome(ok ? 'correct' : 'wrong');
    setTimeout(() => onResolve(ok), ok ? 900 : 700);
  }

  const initial = challenge.initialReveal;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '8px 0' }}>
      <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', margin: 0, textAlign: 'center', lineHeight: 1.4 }}>
        {challenge.prompt}
      </p>

      <motion.div
        style={{ display: 'flex', gap: 8 }}
        animate={outcome === 'wrong' ? { x: [0, -6, 6, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
      >
        {challenge.guess.split('').map((letter, i) => {
          const isTapped = tapped === i;
          // The tile reveals its true colour once tapped (correct or wrong),
          // OR if it was in the initial reveal set
          const revealedState: TileState =
            isTapped && outcome === 'correct'
              ? challenge.correctState
              : isTapped && outcome === 'wrong'
                ? truth[i]
                : initial?.[i] === 'empty'
                  ? 'empty'
                  : initial?.[i] ?? 'empty';

          return (
            <GameTile
              key={i}
              letter={letter}
              state={revealedState}
              onClick={() => handleTap(i)}
              size={62}
            />
          );
        })}
      </motion.div>

      <div style={{ fontSize: 12, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Target: {challenge.target}
      </div>

      <AnimatePresence>
        {outcome && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 999,
              background:
                outcome === 'correct'
                  ? 'color-mix(in srgb, var(--tile-correct) 18%, transparent)'
                  : 'color-mix(in srgb, var(--cls-red) 18%, transparent)',
              color: outcome === 'correct' ? 'var(--tile-correct)' : 'var(--cls-red)',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {outcome === 'correct' ? <Check size={16} /> : <X size={16} />}
            {outcome === 'correct'
              ? challenge.successNote || 'Correct'
              : `Not quite — try a different tile`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
