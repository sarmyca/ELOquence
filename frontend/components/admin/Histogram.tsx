'use client';
import { motion } from 'framer-motion';

interface Props {
  buckets: Array<{ label: string; count: number }>;
  height?: number;
  color?: string;
  highlight?: number;
}

export default function Histogram({ buckets, height = 180, color = 'var(--tile-correct)', highlight }: Props) {
  if (!buckets || buckets.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-text-secondary"
        style={{ height }}
        role="img"
        aria-label="No data available"
      >
        No data available
      </div>
    );
  }

  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const barW = Math.max(4, Math.min(40, Math.floor(220 / buckets.length)));
  const gap = Math.max(2, Math.min(6, Math.floor(60 / buckets.length)));
  const labelRotate = buckets.length > 8;

  return (
    <div
      className="flex items-end justify-around gap-1 w-full"
      style={{ height }}
      role="img"
      aria-label="Histogram chart"
    >
      {buckets.map((b, i) => {
        const pct = maxCount > 0 ? (b.count / maxCount) * 100 : 0;
        const isHighlighted = highlight === i;
        const barColor = isHighlighted ? 'var(--tile-correct)' : color;
        const barH = Math.max(2, (pct / 100) * (height - 48));
        const showCountInside = barH > 18;

        return (
          <div
            key={i}
            className="flex flex-col items-center"
            style={{ gap: 2, flex: `0 0 ${barW + gap}px`, maxWidth: barW + gap + 4 }}
          >
            {/* Count above bar (when bar is short) */}
            {!showCountInside && b.count > 0 && (
              <span
                className="font-sans tabular-nums text-text-secondary"
                style={{ fontSize: 9, lineHeight: 1 }}
              >
                {b.count}
              </span>
            )}
            {showCountInside && <span style={{ height: 14 }} />}

            {/* Bar */}
            <motion.div
              style={{
                width: barW,
                backgroundColor: barColor,
                borderRadius: '3px 3px 0 0',
                opacity: isHighlighted ? 1 : 0.75,
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
              }}
              initial={{ height: 2 }}
              animate={{ height: Math.max(2, barH) }}
              transition={{
                duration: 0.5,
                delay: i * 0.04,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {showCountInside && b.count > 0 && (
                <span
                  className="font-sans tabular-nums font-bold"
                  style={{
                    fontSize: 9,
                    lineHeight: 1,
                    color: '#fff',
                    marginTop: 3,
                  }}
                >
                  {b.count}
                </span>
              )}
            </motion.div>

            {/* Label */}
            <span
              className="font-sans text-text-secondary overflow-hidden text-ellipsis"
              style={{
                fontSize: 8,
                lineHeight: 1.2,
                maxWidth: barW + 8,
                textAlign: 'center',
                transform: labelRotate ? 'rotate(-45deg)' : 'none',
                transformOrigin: 'top center',
                whiteSpace: labelRotate ? 'nowrap' : 'normal',
              }}
            >
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
