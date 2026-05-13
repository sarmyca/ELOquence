'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TileRow, TileState } from '../TileRow';

const CANDIDATES = ['BATCH', 'CATCH'];
const PROBE = 'MIGHT';
const PROBE_PROBE: TileState[] = ['absent', 'absent', 'absent', 'absent', 'absent'];

const OPTIONS = [
  {
    id: 'A',
    word: 'BATCH',
    label: 'A — Guess a candidate',
    pattern: ['empty', 'correct', 'correct', 'correct', 'correct'] as TileState[],
    description: '50% chance to solve. If wrong, you\'ve used a guess and still don\'t know which one is correct.',
    isCorrect: false,
  },
  {
    id: 'B',
    word: 'MIGHT',
    label: 'B — Probe instead',
    pattern: PROBE_PROBE,
    description: 'Cannot solve now, but eliminates the ambiguity. MIGHT shares no letters with BATCH or CATCH, so its pattern will be all gray — but that instantly confirms the first letter is not B or C, narrowing to one or the other via process of elimination.',
    isCorrect: true,
  },
];

export default function M3L2() {
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Two candidates remain: <strong style={{ color: 'var(--text-primary)' }}>BATCH</strong> and <strong style={{ color: 'var(--text-primary)' }}>CATCH</strong>. They differ only in the first letter (B vs C). What should you play?
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        {CANDIDATES.map((w) => (
          <div key={w}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '10px 14px',
            }}
          >
            <TileRow
              word={w}
              pattern={[
                w === 'BATCH' ? 'absent' : 'correct',
                'correct', 'correct', 'correct', 'correct',
              ] as TileState[]}
              size="sm"
            />
          </div>
        ))}
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
              <TileRow word={opt.word} pattern={opt.pattern} size="sm" />
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
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              padding: '14px 16px',
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
              {chosen === 'B' ? 'Correct — the probe guarantees a solve.' : 'The probe is the safer play.'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Guessing BATCH is a coin flip. If wrong, you burned a guess and are back to 50/50. Playing MIGHT (or any word with B but not C, or vice versa) tells you definitively which candidate is correct — guaranteed solve on the next guess. Specifically, a word containing B but not C (like BATCH itself, if legal) would distinguish them; MIGHT is all-gray for both but confirms no new letters, so the correct approach is a word that contains B or C to settle the first-letter question. In hard mode this might not be legal, but in standard mode it's the correct play.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
