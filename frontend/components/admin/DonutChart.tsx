'use client';
import { motion } from 'framer-motion';

interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: Segment[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
  ariaLabel?: string;
}

export default function DonutChart({ segments, size = 160, centerLabel, centerValue, ariaLabel }: Props) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0 || segments.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-text-secondary"
        style={{ height: size }}
        role="img"
        aria-label={ariaLabel ? `${ariaLabel}: no data` : 'No data available'}
      >
        No data
      </div>
    );
  }

  const descriptive = ariaLabel
    ? `${ariaLabel}: ${segments
        .map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`)
        .join(', ')}`
    : 'Donut chart';

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const strokeW = size * 0.14;
  const circumference = 2 * Math.PI * r;

  // Build arc offsets
  const segs: Array<{ seg: Segment; offset: number; dash: number; pct: number }> = [];
  let cumulative = 0;
  for (const seg of segments) {
    const pct = seg.value / total;
    const dash = pct * circumference;
    const offset = circumference * (1 - cumulative) - circumference * 0.005;
    segs.push({ seg, offset, dash: dash - circumference * 0.005, pct });
    cumulative += pct;
  }

  return (
    <div role="img" aria-label={descriptive}>
      <div className="flex justify-center mb-3">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background ring */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth={strokeW}
          />

          {/* Animated segments */}
          {segs.map(({ seg, offset, dash }, i) => (
            <motion.circle
              key={seg.key}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeW}
              strokeLinecap="butt"
              strokeDasharray={`${dash} ${circumference}`}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${dash} ${circumference}` }}
              transition={{
                duration: 0.6,
                delay: i * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
          ))}

          {/* Center text */}
          {centerValue && (
            <text
              x={cx}
              y={cy - (centerLabel ? 7 : 0)}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={size * 0.14}
              fontFamily="var(--font-display, sans-serif)"
              fontWeight="700"
              fill="var(--text-primary)"
            >
              {centerValue}
            </text>
          )}
          {centerLabel && (
            <text
              x={cx}
              y={cy + (centerValue ? size * 0.1 : 0)}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={size * 0.07}
              fontFamily="sans-serif"
              fill="var(--text-secondary)"
            >
              {centerLabel}
            </text>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5">
        {segs.map(({ seg, pct }) => (
          <div key={seg.key} className="flex items-center gap-2">
            <span
              className="flex-shrink-0 rounded-sm"
              style={{ width: 10, height: 10, backgroundColor: seg.color }}
            />
            <span className="font-sans text-text-secondary flex-1 min-w-0 truncate" style={{ fontSize: 11 }}>
              {seg.label}
            </span>
            <span className="font-mono tabular-nums text-text-secondary" style={{ fontSize: 11 }}>
              {seg.value.toLocaleString()}
            </span>
            <span className="font-mono tabular-nums text-text-tertiary" style={{ fontSize: 10 }}>
              {(pct * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
