'use client';
import { motion } from 'framer-motion';

const STEPS = [
  { label: '0 bits', count: 2048, pct: 100 },
  { label: '1 bit', count: 1024, pct: 50 },
  { label: '2 bits', count: 512, pct: 25 },
  { label: '3 bits', count: 256, pct: 12.5 },
  { label: '4 bits', count: 128, pct: 6.25 },
  { label: '5 bits', count: 64, pct: 3.125 },
  { label: '~6 bits (SALET)', count: 36, pct: 1.76, highlight: true },
  { label: '11 bits', count: 1, pct: 0.05 },
];

export default function M5L1() {
  return (
    <div className="space-y-5">
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        A "bit" of information means you've halved the remaining possibilities. Wordle starts with ~2048 possible answers. Each bit cuts that in half.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 110,
                fontSize: 11,
                color: s.highlight ? 'var(--tile-correct)' : 'var(--text-tertiary)',
                fontWeight: s.highlight ? 700 : 400,
                fontFamily: s.highlight ? 'var(--font-display)' : 'var(--font-sans)',
                flexShrink: 0,
                textAlign: 'right',
              }}
            >
              {s.label}
            </span>
            <div
              style={{
                flex: 1,
                height: 8,
                background: 'var(--bg-muted)',
                borderRadius: 4,
                overflow: 'hidden',
                border: s.highlight ? '1px solid var(--tile-correct)' : '1px solid var(--border-subtle)',
              }}
            >
              <motion.div
                style={{
                  height: '100%',
                  borderRadius: 4,
                  backgroundColor: s.highlight ? 'var(--tile-correct)' : 'var(--border-default)',
                }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(s.pct, 0.3)}%` }}
                transition={{ duration: 0.6, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span
              style={{
                width: 42,
                fontSize: 11,
                fontFamily: 'var(--font-display)',
                fontWeight: s.highlight ? 700 : 400,
                color: s.highlight ? 'var(--tile-correct)' : 'var(--text-tertiary)',
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {s.count.toLocaleString()}
            </span>
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
          SALET extracts approximately <strong style={{ color: 'var(--tile-correct)', fontFamily: 'var(--font-display)', fontSize: 15 }}>6 bits</strong> on the first guess — taking 2048 answers down to roughly <strong style={{ color: 'var(--text-primary)' }}>32–36</strong>. That's more than half the puzzle solved with one word.
        </p>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.55 }}>
        You don't need 11 bits to win — just enough to narrow to a handful by guess 3 or 4. Strong openers that extract 5–6 bits set up easy endgames.
      </p>
    </div>
  );
}
