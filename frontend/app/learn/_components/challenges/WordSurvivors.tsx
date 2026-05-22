'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import type { WordSurvivorsChallenge } from './types';

/* Constraint-filter mini-game. The user reads the constraint chips, then
 * taps which candidate words pass. Each candidate is a small chip; tapping
 * toggles a "this survives" mark. On submit we compare to the canonical
 * `survives: boolean` per candidate.
 *
 * Pedagogical hit: trains the player to literally apply constraint sets
 * against word lists, which is the core skill behind guess 2-3.
 */

export default function WordSurvivors({
  challenge,
  onResolve,
}: {
  challenge: WordSurvivorsChallenge;
  onResolve: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  function toggle(i: number) {
    if (submitted) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function submit() {
    setSubmitted(true);
    const allCorrect = challenge.candidates.every((c, i) => c.survives === selected.has(i));
    setTimeout(() => onResolve(allCorrect), allCorrect ? 1100 : 1700);
  }

  function reset() {
    setSelected(new Set());
    setSubmitted(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '8px 0' }}>
      <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', margin: 0, textAlign: 'center', lineHeight: 1.4 }}>
        {challenge.prompt}
      </p>

      {/* Constraint chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 520 }}>
        {challenge.constraints.map((c, i) => (
          <span
            key={i}
            style={{
              padding: '5px 10px',
              borderRadius: 999,
              background: 'color-mix(in srgb, var(--tile-correct) 12%, transparent)',
              color: 'var(--tile-correct)',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {c}
          </span>
        ))}
      </div>

      {/* Word grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 8,
          width: '100%',
          maxWidth: 480,
        }}
      >
        {challenge.candidates.map((c, i) => {
          const picked = selected.has(i);
          const correctAfter = submitted && c.survives === picked;
          const wrongAfter = submitted && c.survives !== picked;
          return (
            <motion.button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              whileHover={!submitted ? { y: -2 } : undefined}
              whileTap={!submitted ? { scale: 0.95 } : undefined}
              animate={wrongAfter ? { x: [0, -3, 3, -3, 3, 0] } : { x: 0 }}
              transition={{ duration: 0.35 }}
              style={{
                padding: '12px 6px',
                borderRadius: 10,
                border: `2px solid ${
                  submitted
                    ? c.survives
                      ? 'var(--tile-correct)'
                      : wrongAfter
                        ? 'var(--cls-red)'
                        : 'var(--border-subtle)'
                    : picked
                      ? 'var(--cls-blue, #3b82f6)'
                      : 'var(--border-subtle)'
                }`,
                background:
                  submitted && c.survives
                    ? 'color-mix(in srgb, var(--tile-correct) 14%, transparent)'
                    : picked
                      ? 'color-mix(in srgb, var(--cls-blue, #3b82f6) 12%, transparent)'
                      : 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontWeight: 800,
                fontSize: 15,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: submitted ? 'default' : 'pointer',
                transition: 'all 200ms ease',
                position: 'relative',
              }}
            >
              {c.word}
              {submitted && (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: correctAfter ? 'var(--tile-correct)' : 'var(--cls-red)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {correctAfter ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-ghost)', margin: 0 }}>
        Tap each word that still fits the constraints. {selected.size} selected.
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        {submitted && (
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '8px 16px',
              borderRadius: 999,
              border: '1px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        )}
        {!submitted && (
          <button
            type="button"
            onClick={submit}
            disabled={selected.size === 0}
            style={{
              padding: '8px 22px',
              borderRadius: 999,
              border: 'none',
              background: selected.size === 0 ? 'var(--bg-muted)' : 'var(--tile-correct)',
              color: selected.size === 0 ? 'var(--text-ghost)' : '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 200ms ease',
            }}
          >
            Submit
          </button>
        )}
      </div>

      <AnimatePresence>
        {submitted && challenge.successNote && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              maxWidth: 520,
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            {challenge.successNote}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
