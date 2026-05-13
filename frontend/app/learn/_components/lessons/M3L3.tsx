'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TileRow, TileState } from '../TileRow';

const TRAP_WORDS = ['WATCH', 'BATCH', 'CATCH', 'MATCH', 'HATCH', 'LATCH', 'PATCH'];
const OPENER_PATTERN: TileState[] = ['absent', 'present', 'correct', 'absent', 'correct'];
const PROBE_PATTERN: TileState[] = ['present', 'absent', 'absent', 'absent', 'present'];

const OPTIONS = [
  {
    id: 'A',
    label: 'Cycle through one at a time',
    description: 'Guess WATCH, if wrong try BATCH, if wrong try CATCH…',
    isCorrect: false,
  },
  {
    id: 'B',
    label: 'Play a probe like BUMPY or SPILT',
    description: 'Tests letters W, B, C, H, L, M, P in two guesses. Identifies the correct answer without burning guesses on wrong candidates.',
    isCorrect: true,
  },
];

export default function M3L3() {
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        After your opener, you've deduced the answer is one of these seven words. They all end in <strong style={{ color: 'var(--text-primary)' }}>-ATCH</strong>. What do you do?
      </p>

      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          padding: '14px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {TRAP_WORDS.map((w) => (
          <span
            key={w}
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-secondary)',
              background: 'var(--bg-muted)',
              borderRadius: 6,
              padding: '4px 8px',
            }}
          >
            {w}
          </span>
        ))}
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.55 }}>
        If you cycle through them one at a time and guess wrong each time, you could use up 6 guesses and still not have solved it. This is the -ATCH trap.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {OPTIONS.map((opt) => {
          const isSelected = chosen === opt.id;
          const showReveal = chosen !== null;
          let border = 'var(--border-subtle)';
          if (showReveal && opt.isCorrect) border = 'var(--tile-correct)';
          else if (showReveal && isSelected && !opt.isCorrect) border = 'var(--cls-red)';

          return (
            <button
              key={opt.id}
              onClick={() => !chosen && setChosen(opt.id)}
              disabled={!!chosen}
              style={{
                background: 'var(--bg-elevated)',
                border: `2px solid ${border}`,
                borderRadius: 10,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                cursor: chosen ? 'default' : 'pointer',
                textAlign: 'left',
                transition: 'border-color 250ms ease',
              }}
            >
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {opt.label}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {opt.description}
              </p>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {chosen && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                padding: '14px 16px',
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                {chosen === 'B' ? 'Correct — the probe approach.' : 'Cycling is the trap.'}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                A word like <strong>BUMPY</strong> contains B, M, P — three of the unique first letters. Play it and the pattern immediately rules out most candidates. Follow with <strong>CLASH</strong> or <strong>WHELK</strong> and you cover W, C, H, L. Two probes identify the answer among all seven.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-ghost)', margin: 0 }}>
                Probe example — BUMPY
              </p>
              <TileRow word="BUMPY" pattern={PROBE_PATTERN} size="sm" />
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                B present, M absent, P present — rules out BATCH, MATCH, LATCH, leaving PATCH, WATCH, CATCH, HATCH. One more probe and you're done.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
