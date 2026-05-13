'use client';
import { motion } from 'framer-motion';

// Word A splits the answer pool into 23 groups (more even, smaller max)
const WORD_A_GROUPS = [
  { size: 92, pct: 4, label: 'Largest' },
  { size: 78, pct: 3.4 },
  { size: 65, pct: 2.8 },
  { size: 55, pct: 2.4 },
  { size: 48, pct: 2.1 },
  { size: 43, pct: 1.9 },
  { size: 39, pct: 1.7 },
  { size: 36, pct: 1.6 },
  { size: 32, pct: 1.4 },
  { size: 28, pct: 1.2 },
  { size: 24, pct: 1.0 },
  { size: 19, pct: 0.8 },
  { size: 14, pct: 0.6 },
];

// Word B splits into 8 groups (lumpy, huge max)
const WORD_B_GROUPS = [
  { size: 680, pct: 29.4, label: 'Largest' },
  { size: 310, pct: 13.4 },
  { size: 220, pct: 9.5 },
  { size: 190, pct: 8.2 },
  { size: 140, pct: 6.1 },
  { size: 90, pct: 3.9 },
  { size: 60, pct: 2.6 },
  { size: 25, pct: 1.1 },
];

interface BarProps {
  pct: number;
  isLargest?: boolean;
  color: string;
  delay: number;
}

function Bar({ pct, isLargest, color, delay }: BarProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        flex: '0 0 auto',
        width: 20,
      }}
    >
      <div
        style={{
          width: 14,
          height: 80,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        <motion.div
          style={{
            width: 14,
            backgroundColor: isLargest ? 'var(--cls-red)' : color,
            borderRadius: '3px 3px 0 0',
            flexShrink: 0,
          }}
          initial={{ height: 0 }}
          animate={{ height: `${Math.max(pct * 2.7, 3)}px` }}
          transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

export default function M5L2() {
  return (
    <div className="space-y-5">
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Two words. Same starting pool. But one creates 23 groups, the other creates 8. Which wins?
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { label: 'Word A', groups: WORD_A_GROUPS, count: 23, maxGroup: 92, color: 'var(--tile-correct)', verdict: 'Better', verdictColor: 'var(--tile-correct)' },
          { label: 'Word B', groups: WORD_B_GROUPS, count: 8, maxGroup: 680, color: 'var(--tile-present)', verdict: 'Worse', verdictColor: 'var(--cls-red)' },
        ].map((w, wi) => (
          <div
            key={w.label}
            style={{
              background: 'var(--bg-elevated)',
              border: `1px solid ${wi === 0 ? 'var(--tile-correct)' : 'var(--border-subtle)'}`,
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-ghost)', margin: 0 }}>
                {w.label}
              </p>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: w.verdictColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  background: `color-mix(in srgb, ${w.verdictColor} 14%, transparent)`,
                  borderRadius: 4,
                  padding: '2px 6px',
                }}
              >
                {w.verdict}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, overflow: 'hidden' }}>
              {w.groups.map((g, i) => (
                <Bar
                  key={i}
                  pct={g.pct}
                  isLargest={i === 0}
                  color={w.color}
                  delay={i * 0.04}
                />
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-ghost)', display: 'block', marginBottom: 2 }}>Groups</span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 22,
                    fontWeight: 700,
                    color: wi === 0 ? 'var(--tile-correct)' : 'var(--text-secondary)',
                  }}
                >
                  {w.count}
                </span>
              </div>
              <div>
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-ghost)', display: 'block', marginBottom: 2 }}>Largest</span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 22,
                    fontWeight: 700,
                    color: wi === 0 ? 'var(--text-secondary)' : 'var(--cls-red)',
                  }}
                >
                  {w.maxGroup}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--tile-correct)',
          borderRadius: 10,
          padding: '12px 16px',
        }}
      >
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Word A wins</strong>. More groups means the answer is more likely to land in a small bucket, leaving you very few candidates. Word B's largest group contains 680 words — if you land there, you have barely narrowed down anything.
        </p>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.55 }}>
        The Shannon entropy formula formalises this: more groups, smaller max bucket, lower expected remaining words = higher information gain. Optimal Wordle solvers maximise this automatically.
      </p>
    </div>
  );
}
