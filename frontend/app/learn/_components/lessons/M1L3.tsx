'use client';
import { TileRow, TileState } from '../TileRow';

const ROW_A: TileState[] = ['present', 'correct', 'absent', 'present', 'correct'];
const ROW_B: TileState[] = ['correct', 'present', 'correct', 'absent', 'correct'];

export default function M1L3() {
  return (
    <div className="space-y-5">
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Picking a random word each day feels creative, but it costs you. When you commit to one strong opener and study its common follow-ups, your average guess count drops measurably.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}
      >
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '14px 16px',
          }}
        >
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-ghost)', marginBottom: 8 }}>
            Player A — random opener each day (illustrative)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            <TileRow word="STARE" pattern={ROW_A} size="sm" />
            <TileRow word="CRANE" pattern={ROW_B} size="sm" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--cls-orange)' }}>4.3</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>avg guesses</span>
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--tile-correct)',
            borderRadius: 10,
            padding: '14px 16px',
          }}
        >
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-ghost)', marginBottom: 8 }}>
            Player B — SALET every day
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            <TileRow word="SALET" pattern={['absent', 'correct', 'present', 'correct', 'present']} size="sm" />
            <TileRow word="SALET" pattern={['correct', 'absent', 'correct', 'correct', 'absent']} size="sm" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--tile-correct)' }}>3.8</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>avg guesses</span>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.55 }}>
        0.5 guesses per game. Over a year that is the difference between finishing in 3-4 guesses vs. bumping your head on 5-6 regularly. Pick an opener, stick to it, and learn your second-guess branches.
      </p>
    </div>
  );
}
