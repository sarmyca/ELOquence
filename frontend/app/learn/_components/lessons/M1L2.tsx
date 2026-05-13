'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TileRow, TileState } from '../TileRow';

const CHOICES = [
  {
    word: 'TARES',
    pattern: ['present', 'correct', 'present', 'correct', 'present'] as TileState[],
    bits: '5.8',
    isCorrect: true,
    why: 'TARES covers T, A, R, E, S — all unique, all extremely common. ~5.8 bits on average.',
  },
  {
    word: 'FAFFY',
    pattern: ['absent', 'correct', 'absent', 'absent', 'absent'] as TileState[],
    bits: '2.7',
    isCorrect: false,
    why: 'FAFFY only uses three unique letters (F, A, Y) across five slots. Repeated F wastes two positions.',
  },
  {
    word: 'AUDIO',
    pattern: ['correct', 'absent', 'absent', 'present', 'absent'] as TileState[],
    bits: '4.6',
    isCorrect: false,
    why: 'AUDIO has all vowels — good coverage of vowels, but misses common consonants that narrow things faster.',
  },
  {
    word: 'CRANE',
    pattern: ['correct', 'present', 'correct', 'absent', 'correct'] as TileState[],
    bits: '5.7',
    isCorrect: false,
    why: 'CRANE is strong (5.7 bits) but TARES edges it slightly in average info gain.',
  },
];

export default function M1L2() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Which of these four words is the strongest opener? Click your pick.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {CHOICES.map((c) => {
          const isSelected = selected === c.word;
          const showReveal = selected !== null;
          let borderColor = 'var(--border-subtle)';
          if (showReveal && c.isCorrect) borderColor = 'var(--tile-correct)';
          else if (showReveal && isSelected && !c.isCorrect) borderColor = 'var(--cls-red)';

          return (
            <button
              key={c.word}
              onClick={() => !selected && setSelected(c.word)}
              disabled={!!selected}
              style={{
                background: 'var(--bg-elevated)',
                border: `2px solid ${borderColor}`,
                borderRadius: 10,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                cursor: selected ? 'default' : 'pointer',
                textAlign: 'left',
                transition: 'border-color 250ms ease',
              }}
            >
              <TileRow word={c.word} pattern={c.pattern} size="sm" />
              <AnimatePresence>
                {showReveal && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 18,
                          fontWeight: 700,
                          color: c.isCorrect ? 'var(--tile-correct)' : 'var(--text-secondary)',
                        }}
                      >
                        {c.bits} bits
                      </span>
                      {c.isCorrect && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: 'var(--tile-correct)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            background: 'color-mix(in srgb, var(--tile-correct) 14%, transparent)',
                            borderRadius: 4,
                            padding: '2px 6px',
                          }}
                        >
                          Best
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                      {c.why}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>
      {selected && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.55 }}
        >
          {CHOICES.find((c) => c.word === selected)?.isCorrect
            ? 'Correct. TARES is a top-tier opener — unique letters, high-frequency positions.'
            : 'Not quite — TARES is the strongest here. See why each word scored above.'}
        </motion.p>
      )}
    </div>
  );
}
