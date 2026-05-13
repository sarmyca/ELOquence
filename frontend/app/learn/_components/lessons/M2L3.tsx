'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TileRow, TileState } from '../TileRow';

type Rating = 'a-lot' | 'some' | 'little';

const DRILL: Array<{
  guess: string;
  pattern: TileState[];
  remaining: number;
  correct: Rating;
  explanation: string;
}> = [
  {
    guess: 'CRANE',
    pattern: ['absent', 'absent', 'absent', 'absent', 'absent'],
    remaining: 263,
    correct: 'a-lot',
    explanation: 'All gray means none of C, R, A, N, E appear. That eliminates an enormous swath. ~263 of 2309 remain — a lot of narrowing.',
  },
  {
    guess: 'SLATE',
    pattern: ['absent', 'present', 'correct', 'present', 'absent'],
    remaining: 2,
    correct: 'a-lot',
    explanation: 'This specific pattern (L/T as yellows, A locked green) is highly constraining — each constraint stacks precisely. Only ~2 answers fit all the positional constraints: TRAIL and TRAWL.',
  },
  {
    guess: 'LUCKY',
    pattern: ['absent', 'absent', 'absent', 'absent', 'absent'],
    remaining: 748,
    correct: 'little',
    explanation: 'All gray again, but L, U, C, K, Y are lower-frequency letters. Fewer words were eliminated. ~748 candidates remain — nearly a third of the pool.',
  },
  {
    guess: 'AROSE',
    pattern: ['correct', 'absent', 'absent', 'absent', 'absent'],
    remaining: 30,
    correct: 'a-lot',
    explanation: 'One green (A at position 1) plus four grays that eliminate R, O, S, E. Aggressive narrowing to just ~30 words — four grays do a lot of work.',
  },
  {
    guess: 'ABCDE',
    pattern: ['absent', 'absent', 'absent', 'absent', 'absent'],
    remaining: 1312,
    correct: 'little',
    explanation: 'B, C, D are very rare in answers. This hypothetical word would barely eliminate anything. Over half the candidate pool remains.',
  },
];

const LABELS: Record<Rating, { label: string; color: string; bg: string }> = {
  'a-lot': { label: 'Narrows a lot', color: 'var(--tile-correct)', bg: 'color-mix(in srgb, var(--tile-correct) 14%, transparent)' },
  'some':  { label: 'Narrows some', color: 'var(--tile-present)', bg: 'color-mix(in srgb, var(--tile-present) 14%, transparent)' },
  'little': { label: 'Narrows little', color: 'var(--cls-red)',    bg: 'color-mix(in srgb, var(--cls-red) 14%, transparent)' },
};

export default function M2L3() {
  const [drillIndex, setDrillIndex] = useState(0);
  const [picked, setPicked] = useState<Rating | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const current = DRILL[drillIndex];

  function handlePick(r: Rating) {
    if (picked) return;
    setPicked(r);
    if (r === current.correct) setScore((s) => s + 1);
  }

  function handleNext() {
    if (drillIndex + 1 >= DRILL.length) {
      setDone(true);
    } else {
      setDrillIndex((i) => i + 1);
      setPicked(null);
    }
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4"
      >
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Drill complete.
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '16px 20px',
          }}
        >
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, color: score >= 4 ? 'var(--tile-correct)' : score >= 3 ? 'var(--tile-present)' : 'var(--cls-orange)' }}>
            {score}/{DRILL.length}
          </span>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            {score === 5 && 'Perfect score. You can read patterns intuitively now.'}
            {score === 4 && 'Strong result. One pattern tripped you up — review the explanations.'}
            {score <= 3 && 'Keep at it — pattern reading gets faster with practice.'}
          </p>
        </div>
        <button
          onClick={() => { setDrillIndex(0); setPicked(null); setScore(0); setDone(false); }}
          style={{
            padding: '7px 16px',
            borderRadius: 8,
            background: 'var(--bg-muted)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-secondary)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Restart drill
        </button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          Pattern <strong style={{ color: 'var(--text-primary)' }}>{drillIndex + 1}</strong> of {DRILL.length} — how much does this narrow the field?
        </p>
        <span style={{ fontSize: 12, color: 'var(--text-ghost)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          {score}/{drillIndex + (picked ? 1 : 0)} correct
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={drillIndex}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.18 }}
          className="space-y-4"
        >
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <TileRow word={current.guess} pattern={current.pattern} size="md" />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {(Object.entries(LABELS) as [Rating, { label: string; color: string; bg: string }][]).map(([key, val]) => {
              const isCorrect = key === current.correct;
              const isPicked = picked === key;
              let border = 'var(--border-subtle)';
              if (picked !== null) {
                if (isCorrect) border = val.color;
                else if (isPicked) border = 'var(--cls-red)';
              }
              return (
                <button
                  key={key}
                  onClick={() => handlePick(key)}
                  disabled={!!picked}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: `2px solid ${border}`,
                    background: picked && isCorrect ? val.bg : 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: picked ? 'default' : 'pointer',
                    transition: 'border-color 200ms ease, background 200ms ease',
                    textAlign: 'center',
                    lineHeight: 1.3,
                  }}
                >
                  {val.label}
                </button>
              );
            })}
          </div>

          {picked && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-ghost)' }}>Candidates left</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>~{current.remaining}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                {current.explanation}
              </p>
            </motion.div>
          )}

          {picked && (
            <button
              onClick={handleNext}
              style={{
                padding: '7px 18px',
                borderRadius: 8,
                background: 'var(--tile-correct)',
                border: 'none',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {drillIndex + 1 >= DRILL.length ? 'See score' : 'Next pattern'}
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
