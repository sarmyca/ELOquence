'use client';
import { motion } from 'framer-motion';

interface Props {
  distribution: Record<string, number>;
  losses: number;
  highlight?: number;
}

const ROWS: Array<{ key: string; label: string }> = [
  { key: '1', label: '1' },
  { key: '2', label: '2' },
  { key: '3', label: '3' },
  { key: '4', label: '4' },
  { key: '5', label: '5' },
  { key: '6', label: '6' },
  { key: 'X', label: 'X' },
];

export default function GuessDistribution({ distribution, losses, highlight }: Props) {
  const counts: Record<string, number> = {
    ...distribution,
    X: losses,
  };

  const maxCount = Math.max(1, ...Object.values(counts));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const highlightKey = highlight !== undefined
    ? (highlight > 6 ? 'X' : String(highlight))
    : undefined;

  return (
    <div
      className="flex flex-col gap-1.5"
      role="img"
      aria-label="Guess distribution chart"
    >
      {ROWS.map(({ key, label }, rowIdx) => {
        const count = counts[key] ?? 0;
        const isHighlighted = highlightKey === key;
        const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
        // Ensure the bar is always wide enough to hold the count digit(s)
        // inside, even when its share is tiny. Zero rows render a flat stub
        // with no number at all.
        const minPx = count === 0 ? 4 : 26;

        return (
          <div key={key} className="flex items-center gap-2">
            {/* Label */}
            <span
              className="font-sans font-bold tabular-nums shrink-0 text-right text-text-secondary"
              style={{ fontSize: 14, width: 16 }}
            >
              {label}
            </span>

            {/* Bar container */}
            <div className="flex-1 relative" style={{ height: 24 }}>
              <motion.div
                className="absolute inset-y-0 left-0 rounded-sm flex items-center overflow-hidden"
                style={{
                  backgroundColor: isHighlighted
                    ? 'var(--tile-correct)'
                    : 'var(--text-secondary)',
                  opacity: isHighlighted ? 1 : 0.6,
                  minWidth: minPx,
                }}
                initial={{ width: '0%' }}
                animate={{ width: `max(${minPx}px, ${pct}%)` }}
                transition={{
                  duration: 0.5,
                  delay: rowIdx * 0.06,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                {count > 0 && (
                  <span
                    className="font-sans tabular-nums px-2 shrink-0"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: isHighlighted ? '#ffffff' : 'var(--bg-base)',
                    }}
                  >
                    {count}
                  </span>
                )}
              </motion.div>
            </div>
          </div>
        );
      })}

      {total > 0 && (
        <p className="text-[10px] text-text-tertiary mt-1 tabular-nums">
          {total} game{total !== 1 ? 's' : ''} total
        </p>
      )}
    </div>
  );
}
