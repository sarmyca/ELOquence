'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { PatternBucket, patternToTiles } from '@/lib/types';

interface Props {
  distribution: PatternBucket[];
  optimalDistribution?: PatternBucket[];
  actualPattern: number;
}

const VIEW_W = 500;
const VIEW_H = 180;
const PAD = { top: 20, right: 20, bottom: 32, left: 40 };
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;

const TILE_STATE_COLORS: Record<string, string> = {
  correct: '#538d4e',
  present: '#b59f3b',
  absent: '#3a3a3c',
};

function MiniPatternTiles({ pattern }: { pattern: number }) {
  const tiles = patternToTiles(pattern);
  return (
    <div className="flex gap-0.5">
      {tiles.map((state, i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: 10,
            backgroundColor: TILE_STATE_COLORS[state] ?? '#3a3a3c',
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
}

export default function PatternHistogram({
  distribution,
  optimalDistribution,
  actualPattern,
}: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!distribution || distribution.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-text-ghost py-8">
        No pattern distribution data available.
      </div>
    );
  }

  // Sort by count descending, take top 40
  const sorted = [...distribution]
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);

  const maxProb = Math.max(...sorted.map((b) => b.probability), 0.001);
  const n = sorted.length;
  const barW = Math.max(4, Math.min(10, (PLOT_W / n) - 2));

  const xPos = (i: number) => PAD.left + (i / n) * PLOT_W + (PLOT_W / n) / 2;
  const barHeight = (prob: number) => (prob / maxProb) * PLOT_H;

  // Build optimal lookup map
  const optimalMap = new Map<number, number>();
  if (optimalDistribution) {
    optimalDistribution.forEach((b) => optimalMap.set(b.pattern, b.probability));
  }

  const Y_LABELS = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full"
        role="img"
        aria-label="Pattern probability distribution histogram"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* Grid lines */}
        {Y_LABELS.map((frac) => {
          const y = PAD.top + PLOT_H * (1 - frac);
          return (
            <line
              key={frac}
              x1={PAD.left}
              y1={y}
              x2={PAD.left + PLOT_W}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          );
        })}

        {/* Optimal distribution overlay bars */}
        {optimalDistribution && sorted.map((bucket, i) => {
          const optProb = optimalMap.get(bucket.pattern) ?? 0;
          if (optProb === 0) return null;
          const h = barHeight(optProb);
          const cx = xPos(i);
          const y = PAD.top + PLOT_H - h;
          return (
            <rect
              key={`opt-${i}`}
              x={cx - barW / 2 - 1}
              y={y}
              width={barW + 2}
              height={h}
              rx={2}
              fill="none"
              stroke="#6aaa6450"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          );
        })}

        {/* Main bars */}
        {sorted.map((bucket, i) => {
          const isActual = bucket.pattern === actualPattern;
          const h = Math.max(2, barHeight(bucket.probability));
          const cx = xPos(i);
          const y = PAD.top + PLOT_H - h;
          const fill = isActual ? '#538d4e' : 'rgba(255,255,255,0.15)';

          return (
            <g
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              style={{ cursor: 'pointer' }}
            >
              <motion.rect
                x={cx - barW / 2}
                y={PAD.top + PLOT_H}
                width={barW}
                height={0}
                rx={2}
                fill={fill}
                style={
                  isActual
                    ? { filter: 'drop-shadow(0 0 6px #538d4e80)' }
                    : undefined
                }
                animate={{ y, height: h }}
                transition={{
                  delay: i * 0.015,
                  duration: 0.4,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
              {/* Invisible wider hit area */}
              <rect
                x={cx - Math.max(barW / 2, 6)}
                y={PAD.top}
                width={Math.max(barW, 12)}
                height={PLOT_H}
                fill="transparent"
              />
            </g>
          );
        })}

        {/* X-axis label: "Patterns (sorted by frequency)" */}
        <text
          x={PAD.left + PLOT_W / 2}
          y={VIEW_H - 4}
          fontSize={9}
          fontFamily="monospace"
          fill="#4b5563"
          textAnchor="middle"
        >
          patterns sorted by frequency ({n} shown)
        </text>

        {/* Y-axis label: probability */}
        <text
          x={8}
          y={PAD.top + PLOT_H / 2}
          fontSize={9}
          fontFamily="monospace"
          fill="#4b5563"
          textAnchor="middle"
          transform={`rotate(-90, 8, ${PAD.top + PLOT_H / 2})`}
        >
          prob.
        </text>

        {/* Y-axis ticks */}
        {[0, 0.5, 1.0].map((frac) => {
          const y = PAD.top + PLOT_H * (1 - frac);
          const prob = maxProb * frac;
          return (
            <text
              key={frac}
              x={PAD.left - 4}
              y={y + 4}
              fontSize={9}
              fontFamily="monospace"
              fill="#4b5563"
              textAnchor="end"
            >
              {(prob * 100).toFixed(1)}%
            </text>
          );
        })}

        {/* Hover tooltip */}
        {hoveredIdx !== null && (() => {
          const bucket = sorted[hoveredIdx];
          const cx = xPos(hoveredIdx);
          const h = Math.max(2, barHeight(bucket.probability));
          const topY = PAD.top + PLOT_H - h;
          const bw = 148;
          const bh = 64;
          let bx = cx - bw / 2;
          bx = Math.max(PAD.left, Math.min(bx, VIEW_W - PAD.right - bw));
          const by = Math.max(PAD.top, topY - bh - 6);

          return (
            <foreignObject x={bx} y={by} width={bw} height={bh} style={{ overflow: 'visible' }}>
              <div
                className="rounded-lg border border-[#4a4a4c] bg-[#2a2a2c] shadow-xl px-3 py-2 pointer-events-none"
                style={{ fontSize: 11 }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <MiniPatternTiles pattern={bucket.pattern} />
                  {bucket.pattern === actualPattern && (
                    <span className="text-[#538d4e] text-[9px] font-semibold">actual</span>
                  )}
                </div>
                <div className="font-mono tabular-nums text-text-primary font-bold">
                  {(bucket.probability * 100).toFixed(2)}%
                </div>
                <div className="font-mono tabular-nums text-text-ghost" style={{ fontSize: 10 }}>
                  {bucket.count} word{bucket.count !== 1 ? 's' : ''}
                </div>
              </div>
            </foreignObject>
          );
        })()}
      </svg>
    </div>
  );
}
