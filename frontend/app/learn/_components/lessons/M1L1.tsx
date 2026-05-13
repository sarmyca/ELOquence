'use client';
import { TileRow, TileState } from '../TileRow';

const OPENERS = [
  {
    word: 'SALET',
    pattern: ['absent', 'correct', 'present', 'correct', 'present'] as TileState[],
    bits: '5.9',
    unique: 5,
    note: 'S, A, L, E, T — five high-frequency letters, spread across positions that maximise coverage.',
  },
  {
    word: 'MAMMA',
    pattern: ['absent', 'correct', 'absent', 'absent', 'correct'] as TileState[],
    bits: '2.4',
    unique: 2,
    note: 'Only tests M and A (2 unique letters). Wastes three slots on repeated letters.',
  },
  {
    word: 'CRANE',
    pattern: ['correct', 'present', 'correct', 'absent', 'correct'] as TileState[],
    bits: '5.7',
    unique: 5,
    note: 'C, R, A, N, E — all unique, solid letter frequency. A reliable favourite.',
  },
];

export default function M1L1() {
  return (
    <div className="space-y-6">
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
        The opener sets everything up. A great one narrows the field by half or more on the first guess. A poor one can leave you with hundreds of candidates on guess two.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {OPENERS.map((op) => (
          <div
            key={op.word}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <TileRow word={op.word} pattern={op.pattern} size="sm" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  fontWeight: 700,
                  color: parseFloat(op.bits) >= 5.5 ? 'var(--tile-correct)' : 'var(--cls-red)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {op.bits}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                bits avg
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--text-ghost)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {op.unique} unique letters
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              {op.note}
            </p>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.55 }}>
        Position matters too. S at index 0 catches more answers than S at index 4, because more words start with S than end with it.
      </p>
    </div>
  );
}
