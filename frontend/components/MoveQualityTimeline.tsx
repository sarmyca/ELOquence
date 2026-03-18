'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { MoveAnalysis, CLASSIFICATION_CONFIG } from '@/lib/types';

interface Props {
  moves: MoveAnalysis[];
}

const THRESHOLDS = [
  { value: 0.97, label: 'Best', color: '#538d4e' },
  { value: 0.85, label: 'Good', color: '#6aaa64' },
  { value: 0.70, label: 'Okay', color: '#2e9688' },
  { value: 0.50, label: 'Inaccuracy', color: '#b59f3b' },
];

const VIEW_W = 400;
const VIEW_H = 200;
const PAD = { top: 16, right: 20, bottom: 32, left: 44 };
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;

export default function MoveQualityTimeline({ moves }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!moves || moves.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-text-ghost py-8">
        No move data available.
      </div>
    );
  }

  const n = moves.length;

  const xScale = (i: number): number => {
    if (n === 1) return PAD.left + PLOT_W / 2;
    return PAD.left + (i / (n - 1)) * PLOT_W;
  };
  const yScale = (v: number): number => PAD.top + PLOT_H - v * PLOT_H;

  // Build connecting line path (skip forced moves from line but include in x positions)
  const linePts = moves
    .map((m, i) => {
      if (m.classification === 'forced') return null;
      const eff = Math.max(0, Math.min(1, m.efficiency_ratio ?? 0));
      return { x: xScale(i), y: yScale(eff) };
    })
    .filter(Boolean) as { x: number; y: number }[];

  const linePath = linePts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const Y_LABELS = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full"
        role="img"
        aria-label="Move quality efficiency timeline"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* Horizontal grid lines */}
        {Y_LABELS.map((v) => (
          <line
            key={v}
            x1={PAD.left}
            y1={yScale(v)}
            x2={PAD.left + PLOT_W}
            y2={yScale(v)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}

        {/* Threshold reference lines */}
        {THRESHOLDS.map((t) => (
          <line
            key={t.value}
            x1={PAD.left}
            y1={yScale(t.value)}
            x2={PAD.left + PLOT_W}
            y2={yScale(t.value)}
            stroke={`${t.color}40`}
            strokeWidth={1}
            strokeDasharray="3 4"
          />
        ))}

        {/* Connecting line */}
        {linePts.length >= 2 && (
          <motion.path
            d={linePath}
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        )}

        {/* Dots */}
        {moves.map((m, i) => {
          const isForced = m.classification === 'forced';
          const eff = Math.max(0, Math.min(1, m.efficiency_ratio ?? 0));
          const cx = xScale(i);
          const cy = yScale(eff);
          const color = m.classification
            ? CLASSIFICATION_CONFIG[m.classification].color
            : '#565758';
          const r = isForced ? 4 : 6;

          return (
            <motion.g
              key={m.id || i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.15, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
              onMouseEnter={() => setHoveredIdx(i)}
            >
              <circle
                cx={cx}
                cy={cy}
                r={r + 6}
                fill="transparent"
                style={{ cursor: 'pointer' }}
              />
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={isForced ? '#565758' : color}
                stroke="rgba(255,255,255,0.5)"
                strokeWidth={isForced ? 1 : 2}
              />
            </motion.g>
          );
        })}

        {/* X-axis labels (move numbers) */}
        {moves.map((m, i) => (
          <text
            key={`xl-${i}`}
            x={xScale(i)}
            y={VIEW_H - 6}
            fontSize={10}
            fontFamily="monospace"
            fill="#4b5563"
            textAnchor="middle"
          >
            {m.move_number}
          </text>
        ))}

        {/* Y-axis labels */}
        {Y_LABELS.map((v) => (
          <text
            key={`yl-${v}`}
            x={PAD.left - 6}
            y={yScale(v) + 4}
            fontSize={10}
            fontFamily="monospace"
            fill="#4b5563"
            textAnchor="end"
          >
            {v.toFixed(2)}
          </text>
        ))}

        {/* Hover tooltip via foreignObject */}
        {hoveredIdx !== null && (() => {
          const m = moves[hoveredIdx];
          const eff = Math.max(0, Math.min(1, m.efficiency_ratio ?? 0));
          const cx = xScale(hoveredIdx);
          const cy = yScale(eff);
          const color = m.classification
            ? CLASSIFICATION_CONFIG[m.classification].color
            : '#565758';
          const label = m.classification
            ? CLASSIFICATION_CONFIG[m.classification].label
            : 'Unknown';
          const bw = 130;
          const bh = 56;
          let bx = cx - bw / 2;
          bx = Math.max(PAD.left, Math.min(bx, VIEW_W - PAD.right - bw));
          const by = Math.max(PAD.top, cy - bh - 10);

          return (
            <foreignObject x={bx} y={by} width={bw} height={bh} style={{ overflow: 'visible' }}>
              <div
                className="rounded-lg border border-[#4a4a4c] bg-[#2a2a2c] shadow-xl px-3 py-2 pointer-events-none"
                style={{ fontSize: 11 }}
              >
                <div className="font-mono text-text-ghost" style={{ fontSize: 10 }}>
                  Move {m.move_number} — {m.guess_word.toUpperCase()}
                </div>
                <div className="font-mono font-bold tabular-nums" style={{ color, fontSize: 12 }}>
                  {(eff * 100).toFixed(1)}% efficiency
                </div>
                <div style={{ fontSize: 10, color }}>{label}</div>
              </div>
            </foreignObject>
          );
        })()}
      </svg>
    </div>
  );
}
