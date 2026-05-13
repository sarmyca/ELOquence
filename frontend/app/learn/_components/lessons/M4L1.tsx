'use client';
import { TileRow, TileState } from '../TileRow';
import { Lock } from 'lucide-react';

const OPENER_PATTERN: TileState[] = ['absent', 'absent', 'absent', 'absent', 'correct'];

const LEGAL: Array<{ word: string; pattern: TileState[]; legal: boolean; reason: string }> = [
  {
    word: 'SLATE',
    pattern: ['absent', 'absent', 'correct', 'absent', 'correct'],
    legal: true,
    reason: 'E appears at position 5 (green). Legal.',
  },
  {
    word: 'SHIRT',
    pattern: ['empty', 'empty', 'empty', 'empty', 'empty'],
    legal: false,
    reason: 'No E at all — illegal in hard mode. You must reuse the green E.',
  },
  {
    word: 'STARE',
    pattern: ['absent', 'absent', 'correct', 'absent', 'correct'],
    legal: true,
    reason: 'E appears at position 5. Hard mode constraint satisfied.',
  },
];

export default function M4L1() {
  return (
    <div className="space-y-5">
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        In hard mode, every revealed green or yellow <em>must</em> appear in every subsequent guess. Greens must stay in position. Yellows must appear somewhere.
      </p>

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
        <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-ghost)', margin: 0 }}>
          Opening guess result
        </p>
        <TileRow word="CRANE" pattern={OPENER_PATTERN} size="md" />
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          Green E at position 5. Hard mode now <strong style={{ color: 'var(--text-primary)' }}>requires</strong> E in position 5 for all future guesses.
        </p>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
        Which next guesses are legal?
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {LEGAL.map((item) => (
          <div
            key={item.word}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: 'var(--bg-elevated)',
              border: `1px solid ${item.legal ? 'var(--tile-correct)' : 'var(--cls-red)'}`,
              borderRadius: 10,
              padding: '12px 16px',
            }}
          >
            <TileRow word={item.word} pattern={item.pattern} size="sm" />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                {item.legal ? (
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
                    Legal
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--cls-red)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      background: 'color-mix(in srgb, var(--cls-red) 14%, transparent)',
                      borderRadius: 4,
                      padding: '2px 6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Lock size={9} aria-hidden="true" />
                    Blocked
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                {item.reason}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.55 }}>
        Hard mode is harder because useful probes (like BUMPY above a -ATCH cluster) often don't reuse known letters, making them illegal. You're forced to solve more directly from the answer pool.
      </p>
    </div>
  );
}
