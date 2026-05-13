'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { Tile, TileState } from '../TileRow';

const WORD = 'CRANE';
const PATTERN: TileState[] = ['absent', 'absent', 'present', 'absent', 'correct'];

const STEPS = [
  {
    index: 0,
    letter: 'C',
    state: 'absent' as TileState,
    insight: 'Gray C — the answer contains no C at all. Cross out every word with C.',
    remaining: '~1,860 of 2309',
  },
  {
    index: 1,
    letter: 'R',
    state: 'absent' as TileState,
    insight: 'Gray R — no R anywhere. Combined with no C, you have eliminated many common words.',
    remaining: '~1,170 of 2309',
  },
  {
    index: 2,
    letter: 'A',
    state: 'present' as TileState,
    insight: 'Yellow A — the answer has A, but NOT in position 3. Strong constraint: keeps words with A but rules out all with A at position 3.',
    remaining: '~330 of 2309',
  },
  {
    index: 3,
    letter: 'N',
    state: 'absent' as TileState,
    insight: 'Gray N — no N anywhere. That one tile just eliminated a huge cluster of -ANE, -ANT, -AND words.',
    remaining: '~230 of 2309',
  },
  {
    index: 4,
    letter: 'E',
    state: 'correct' as TileState,
    insight: 'Green E — E is locked in at position 5. Every remaining answer must end in E.',
    remaining: '~49 of 2309',
  },
];

export default function M2L1() {
  const [step, setStep] = useState(-1);

  const revealed = step + 1;

  return (
    <div className="space-y-5">
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        We guessed <strong style={{ color: 'var(--text-primary)' }}>CRANE</strong>. Reveal each tile to see exactly what information it gives you.
      </p>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {WORD.split('').map((ch, i) => (
          <Tile
            key={i}
            letter={ch}
            state={i < revealed ? PATTERN[i] : 'empty'}
            revealed={i < revealed}
            size="lg"
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {STEPS.map((s, i) => {
          const done = i < revealed;
          const active = i === revealed;
          return (
            <button
              key={s.letter}
              onClick={() => setStep(i)}
              disabled={done && !active}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: `1px solid ${done ? 'transparent' : active ? 'var(--border-default)' : 'var(--border-subtle)'}`,
                background: done
                  ? s.state === 'correct'
                    ? 'var(--tile-correct)'
                    : s.state === 'present'
                    ? 'var(--tile-present)'
                    : 'var(--tile-absent)'
                  : active
                  ? 'var(--bg-muted)'
                  : 'var(--bg-elevated)',
                color: done ? '#fff' : 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 700,
                cursor: done ? 'default' : 'pointer',
                fontFamily: 'var(--font-sans)',
                textTransform: 'uppercase',
                transition: 'all 200ms ease',
              }}
            >
              {s.letter}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {step >= 0 && (
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              padding: '14px 16px',
            }}
          >
            <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.55, margin: '0 0 8px 0', fontWeight: 500 }}>
              {STEPS[step].insight}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
              Answers remaining: <strong style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>{STEPS[step].remaining}</strong>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {step === -1 && (
        <p style={{ fontSize: 13, color: 'var(--text-ghost)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ChevronRight size={13} />
          Click each letter button to reveal its meaning.
        </p>
      )}

      {step === 4 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}
        >
          Final result: from 2309 possible answers, CRANE with this pattern leaves approximately <strong style={{ color: 'var(--tile-correct)' }}>49 candidates</strong>. Each tile is a constraint; all five together are a powerful filter.
        </motion.p>
      )}
    </div>
  );
}
