'use client';
import { TileRow, TileState } from '../TileRow';

const OPENERS: Array<{
  word: string;
  pattern: TileState[];
  score: string;
  notes: string[];
}> = [
  {
    word: 'SALET',
    pattern: ['correct', 'correct', 'absent', 'correct', 'absent'],
    score: 'Good',
    notes: [
      'Common second guesses: DROIT, POUTY, CHOMP',
      'S and A lock in early, giving usable constraints',
      'The T reveals a lot in follow-up positions',
    ],
  },
  {
    word: 'CRANE',
    pattern: ['absent', 'correct', 'correct', 'absent', 'correct'],
    score: 'Very good',
    notes: [
      'R and A central-position locks constrain well',
      'Many strong second guesses stay legal: LUSTY, THUMP, DROIT',
      'The five unique high-frequency letters branch cleanly',
    ],
  },
  {
    word: 'ADIEU',
    pattern: ['correct', 'absent', 'correct', 'correct', 'absent'],
    score: 'Risky',
    notes: [
      'All vowels — in hard mode you are locked into many low-info vowel-heavy follow-ups',
      'Second guess must include A, I, E (if yellowed) — very constraining',
      'Works fine in standard; hard mode often traps you in vowel-only follow-up space',
    ],
  },
];

export default function M4L2() {
  return (
    <div className="space-y-5">
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Not all openers work equally well under hard mode constraints. The key difference: an opener whose common follow-ups stay legal in hard mode is vastly more useful.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <TileRow word={op.word} pattern={op.pattern} size="sm" />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color:
                    op.score === 'Very good'
                      ? 'var(--tile-correct)'
                      : op.score === 'Good'
                      ? 'var(--tile-present)'
                      : 'var(--cls-orange)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  background:
                    op.score === 'Very good'
                      ? 'color-mix(in srgb, var(--tile-correct) 14%, transparent)'
                      : op.score === 'Good'
                      ? 'color-mix(in srgb, var(--tile-present) 14%, transparent)'
                      : 'color-mix(in srgb, var(--cls-orange) 14%, transparent)',
                  borderRadius: 4,
                  padding: '2px 8px',
                }}
              >
                {op.score}
              </span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {op.notes.map((n, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    display: 'flex',
                    gap: 6,
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{ color: 'var(--text-ghost)', flexShrink: 0, marginTop: 2 }}>–</span>
                  {n}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.55 }}>
        In hard mode, CRANE beats SALET for most players because its follow-up words are more diverse and easier to find under constraints. ADIEU is a trap: great for standard, punishing in hard.
      </p>
    </div>
  );
}
