'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TileRow, TileState } from '../TileRow';

const PATTERN_A: TileState[] = ['absent', 'present', 'absent', 'absent', 'present'];
const PATTERN_B: TileState[] = ['present', 'absent', 'absent', 'absent', 'absent'];

export default function M2L2() {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="space-y-5">
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Both patterns came from the same opener <strong style={{ color: 'var(--text-primary)' }}>CRANE</strong> against different targets. Which one gave <em>more</em> information?
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { label: 'Pattern A', word: 'CRANE', pattern: PATTERN_A, yellows: 2, grays: 3, remaining: '~122' },
          { label: 'Pattern B', word: 'CRANE', pattern: PATTERN_B, yellows: 1, grays: 4, remaining: '~55' },
        ].map((p, i) => (
          <div
            key={p.label}
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
            <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-ghost)', margin: 0 }}>
              {p.label}
            </p>
            <TileRow word={p.word} pattern={p.pattern} size="sm" />
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-ghost)' }}>Yellows</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--tile-present)' }}>{p.yellows}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-ghost)' }}>Grays</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-tertiary)' }}>{p.grays}</span>
              </div>
              {revealed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 2, marginLeft: 'auto' }}
                >
                  <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-ghost)' }}>Remaining</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 20,
                      fontWeight: 700,
                      color: i === 1 ? 'var(--tile-correct)' : 'var(--text-secondary)',
                    }}
                  >
                    {p.remaining}
                  </span>
                </motion.div>
              )}
            </div>
          </div>
        ))}
      </div>

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            background: 'var(--bg-muted)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Reveal answer
        </button>
      ) : (
        <AnimatePresence>
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
              Pattern B wins — despite fewer yellows.
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Grays are powerful eliminators: each gray removes that letter from every position. Pattern B's one gray letter eliminates C from every position, cutting the candidate pool to ~55 words. Pattern A's two yellows ("letter in, wrong spot") still leave ~122 candidates — more than double. Yellows tell you where a letter <em>isn't</em> just as much as where it <em>is</em>.
            </p>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
