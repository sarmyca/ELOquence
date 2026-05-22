'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import type { PoolShrinkChallenge } from './types';

/* Visualisation challenge. Animates a dot pool shrinking step-by-step as
 * constraints are applied. The user clicks Advance to walk through the
 * steps; the final tap resolves the challenge. Designed to make "bits =
 * halving the field" tangible.
 *
 * Each dot represents one candidate from the starting pool. Dots that get
 * eliminated by a step fade + scale down. Final state shows just a few
 * green dots glowing.
 */

const COLS = 20; // dots per row in the grid

export default function PoolShrink({
  challenge,
  onResolve,
}: {
  challenge: PoolShrinkChallenge;
  onResolve: (correct: boolean) => void;
}) {
  const [stepIdx, setStepIdx] = useState(-1); // -1 = nothing applied yet
  const total = challenge.startCount;

  // Pre-compute which dot indices stay alive at each step. We just take the
  // first `remaining` of the previous live set so the visual is stable
  // (always trims from the right/bottom edge).
  const liveByStep = useMemo<number[][]>(() => {
    const all = Array.from({ length: total }, (_, i) => i);
    const stages: number[][] = [all];
    let current = all;
    for (const s of challenge.steps) {
      current = current.slice(0, Math.max(0, Math.min(current.length, s.remaining)));
      stages.push(current);
    }
    return stages;
  }, [total, challenge.steps]);

  const currentLive: Set<number> = useMemo(() => {
    return new Set(liveByStep[Math.max(0, stepIdx + 1)]);
  }, [liveByStep, stepIdx]);

  const finalStep = stepIdx >= challenge.steps.length - 1;

  function advance() {
    if (stepIdx < challenge.steps.length - 1) {
      setStepIdx((s) => s + 1);
    } else {
      onResolve(true);
    }
  }

  const activeStep = stepIdx >= 0 ? challenge.steps[stepIdx] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0' }}>
      <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', margin: 0, textAlign: 'center', lineHeight: 1.4 }}>
        {challenge.prompt}
      </p>

      {/* Dot grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, 14px)`,
          gap: 4,
          padding: 14,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          maxWidth: 'fit-content',
        }}
      >
        {Array.from({ length: total }).map((_, i) => {
          const alive = currentLive.has(i);
          const isFinal = finalStep && alive;
          return (
            <motion.span
              key={i}
              animate={{
                opacity: alive ? 1 : 0.12,
                scale: alive ? 1 : 0.5,
              }}
              transition={{ duration: 0.4, delay: alive ? 0 : (i % 20) * 0.005 }}
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: isFinal
                  ? 'var(--tile-correct)'
                  : alive
                    ? 'var(--cls-blue, #3b82f6)'
                    : 'var(--border-default)',
              }}
            />
          );
        })}
      </div>

      {/* Step counter + label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          padding: '6px 12px',
          borderRadius: 999,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
          {currentLive.size}
        </span>
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-ghost)' }}>
          remaining
        </span>
      </div>

      <AnimatePresence mode="wait">
        {activeStep && (
          <motion.div
            key={stepIdx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            style={{
              textAlign: 'center',
              maxWidth: 480,
              padding: '8px 14px',
              borderRadius: 10,
              background: 'color-mix(in srgb, var(--cls-blue, #3b82f6) 12%, transparent)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
              {activeStep.label}
            </div>
            {activeStep.note && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {activeStep.note}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={advance}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 22px',
          borderRadius: 999,
          border: 'none',
          background: 'var(--tile-correct)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {finalStep ? (
          <>
            Got it <Check size={16} />
          </>
        ) : stepIdx < 0 ? (
          <>
            Apply first constraint <ArrowRight size={16} />
          </>
        ) : (
          <>
            Next constraint <ArrowRight size={16} />
          </>
        )}
      </motion.button>
    </div>
  );
}
