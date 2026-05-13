'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TileRow, TileState } from '../TileRow';

const OPENER: TileState[] = ['absent', 'absent', 'present', 'present', 'absent'];

const OPTIONS = [
  {
    id: 'A',
    word: 'SHIRT',
    label: 'A — Probe',
    description: 'Not an answer candidate (no A or N), but tests S, H, I, T — completely fresh letters not yet constrained by CRANE. Information-dense probe.',
    bits: '~4.2 new bits',
    inPool: false,
    isCorrect: true,
    why: 'When 47 words remain, a probe that tests fresh, unconstrained letters will cut the remaining pool far more effectively than guessing a candidate. Sacrificing a small chance to solve now buys a much higher probability of solving on guess 3.',
  },
  {
    id: 'B',
    word: 'STAIR',
    label: 'B — Candidate',
    description: 'A candidate from the remaining 47 words — might be correct. But only tests S and I as truly new information (A and N are already known).',
    bits: '~2.1 new bits',
    inPool: true,
    isCorrect: false,
    why: '',
  },
];

export default function M3L1() {
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        After <strong style={{ color: 'var(--text-primary)' }}>CRANE</strong> returned this pattern, <strong style={{ color: 'var(--tile-present)' }}>47 words</strong> remain. Which should be guess 2?
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <TileRow word="CRANE" pattern={OPENER} size="sm" />
        <span style={{ fontSize: 13, color: 'var(--text-ghost)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>47 left</span>
      </div>

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
                gap: 10,
                cursor: chosen ? 'default' : 'pointer',
                textAlign: 'left',
                transition: 'border-color 250ms ease',
              }}
            >
              <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-ghost)', margin: 0 }}>
                {opt.label}
              </p>
              <TileRow word={opt.word} pattern={Array(5).fill('empty') as TileState[]} size="sm" />
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {opt.description}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: opt.isCorrect ? 'var(--tile-correct)' : 'var(--text-tertiary)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {opt.bits}
                </span>
                {opt.inPool && (
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--tile-present)',
                      background: 'color-mix(in srgb, var(--tile-present) 14%, transparent)',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    In pool
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {chosen && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              padding: '14px 16px',
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
              {chosen === 'A' ? 'Correct — probe wins here.' : 'Not quite — the probe wins here.'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {OPTIONS[0].why}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
