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
        const barColor = isHighlighted ? '#6aaa64' : '#538d4e';
        const isLarge = pct > 40;

        return (
          <div key={key} className="flex items-center gap-2">
            {/* Label */}
            <span
              className="font-mono tabular-nums shrink-0 text-right text-text-secondary"
              style={{ fontSize: 14, width: 16 }}
            >
              {label}
            </span>

            {/* Bar container */}
            <div className="flex-1 relative" style={{ height: 24 }}>
              <motion.div
                className="absolute inset-y-0 left-0 rounded-sm flex items-center overflow-hidden"
                style={{
                  backgroundColor: barColor,
                  minWidth: 8,
                  boxShadow: isHighlighted ? `0 0 8px ${barColor}60` : undefined,
                }}
                initial={{ width: '0%' }}
                animate={{ width: `max(8px, ${pct}%)` }}
                transition={{
                  duration: 0.5,
                  delay: rowIdx * 0.06,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                {isLarge && (
                  <span
                    className="font-mono tabular-nums text-white px-2 shrink-0"
                    style={{ fontSize: 12, fontWeight: 700 }}
                  >
                    {count}
                  </span>
                )}
              </motion.div>
            </div>

            {/* Count outside bar if bar is small */}
            {!isLarge && (
              <motion.span
                className="font-mono tabular-nums text-text-secondary shrink-0"
                style={{ fontSize: 12, width: 28, textAlign: 'right' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: rowIdx * 0.06 + 0.4 }}
              >
                {count}
              </motion.span>
            )}
            {isLarge && (
              <span
                className="font-mono tabular-nums text-text-ghost shrink-0"
                style={{ fontSize: 10, width: 28, textAlign: 'right' }}
              />
            )}
          </div>
        );
      })}

      {total > 0 && (
        <p className="text-[10px] text-text-ghost mt-1 tabular-nums">
          {total} game{total !== 1 ? 's' : ''} total
        </p>
      )}
    </div>
  );
}
