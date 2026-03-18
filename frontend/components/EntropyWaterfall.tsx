'use client';
import { useState, useId } from 'react';
import { motion } from 'framer-motion';
import { MoveAnalysis, CLASSIFICATION_CONFIG } from '@/lib/types';

interface Props {
  moves: MoveAnalysis[];
}

const VIEW_W = 500;
const VIEW_H = 220;
const PAD = { top: 30, right: 20, bottom: 48, left: 52 };
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;

function safeLog(n: number): number {
  return n > 0 ? Math.log10(n) : 0;
}

interface BarData {
  word: string;
  before: number;
  after: number;
  classification: MoveAnalysis['classification'];
  info: number | null;
  color: string;
}

export default function EntropyWaterfall({ moves }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const uid = useId().replace(/:/g, '');

  if (!moves || moves.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-text-ghost py-8">
        No move data available.
      </div>
    );
  }

  const bars: BarData[] = moves.map((m, i) => {
    const before =
      i === 0
        ? (m.remaining_words ?? m.remaining_after ?? 2309)
        : (moves[i - 1].remaining_after ?? moves[i - 1].remaining_words ?? 1);
    const after = m.remaining_after ?? m.remaining_words ?? 0;
    const color = m.classification
      ? CLASSIFICATION_CONFIG[m.classification].color
      : '#538d4e';
    return {
      word: m.guess_word,
      before,
      after,
      classification: m.classification,
      info: m.info_gained,
      color,
    };
  });

  const maxLog = safeLog(bars[0]?.before ?? 2309);
  const n = bars.length;
  const barW = Math.min(48, (PLOT_W / n) * 0.6);
  const gap = PLOT_W / n;

  const xCenter = (i: number) => PAD.left + gap * i + gap / 2;
  const yScale = (val: number) =>
    PAD.top + PLOT_H - (maxLog > 0 ? (safeLog(val) / maxLog) * PLOT_H : 0);

  const yTicks = [1, 10, 100, 1000, 2309].filter((v) => v <= (bars[0]?.before ?? 2309));

  const bottomY = PAD.top + PLOT_H;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="w-full"
      role="img"
      aria-label="Remaining words waterfall chart per guess"
      onMouseLeave={() => setHoveredIdx(null)}
    >
      {/* All gradient defs at top level */}
      <defs>
        {bars.map((bar, i) => (
          <linearGradient key={i} id={`wf-${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={bar.color} stopOpacity={i === bars.length - 1 ? '0.9' : '0.7'} />
            <stop offset="100%" stopColor={bar.color} stopOpacity="0.25" />
          </linearGradient>
        ))}
      </defs>

      {/* Grid lines */}
      {yTicks.map((v) => {
        const y = yScale(v);
        return (
          <g key={v}>
            <line
              x1={PAD.left}
              y1={y}
              x2={PAD.left + PLOT_W}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 5}
              y={y + 4}
              fontSize={9}
              fontFamily="monospace"
              fill="#4b5563"
              textAnchor="end"
            >
              {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {bars.map((bar, i) => {
        const isLast = i === bars.length - 1;
        const cx = xCenter(i);
        const topY = bar.after > 0 ? yScale(bar.after) : bottomY;
        const barHeight = Math.max(2, bottomY - topY);
        const isHovered = hoveredIdx === i;

        return (
          <g
            key={i}
            onMouseEnter={() => setHoveredIdx(i)}
            style={{ cursor: 'pointer' }}
          >
            {/* Eliminated region between previous bar top and this bar top */}
            {i > 0 && (() => {
              const prevBar = bars[i - 1];
              const prevTopY = prevBar.after > 0 ? yScale(prevBar.after) : bottomY;
              const elimH = Math.max(0, topY - prevTopY);
              if (elimH < 1) return null;
              return (
                <rect
                  x={cx - barW / 2}
                  y={prevTopY}
                  width={barW}
                  height={elimH}
                  rx={2}
                  fill={`${bar.color}22`}
                  stroke={`${bar.color}40`}
                  strokeWidth={1}
                />
              );
            })()}

            {/* Main animated bar */}
            <motion.rect
              x={cx - barW / 2}
              width={barW}
              rx={3}
              fill={`url(#wf-${uid}-${i})`}
              stroke={isHovered ? bar.color : 'transparent'}
              strokeWidth={1}
              style={isLast ? { filter: `drop-shadow(0 0 6px ${bar.color}80)` } : undefined}
              initial={{ y: bottomY, height: 0 }}
              animate={{ y: topY, height: barHeight }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Info gained label above bar */}
            {bar.info !== null && bar.info > 0 && (
              <motion.text
                x={cx}
                y={topY - 4}
                fontSize={9}
                fontFamily="monospace"
                fill="#4b5563"
                textAnchor="middle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.1 + 0.35 }}
              >
                {bar.info.toFixed(1)}b
              </motion.text>
            )}

            {/* X-axis word label */}
            <text
              x={cx}
              y={VIEW_H - 6}
              fontSize={9}
              fontFamily="monospace"
              fill={isHovered ? '#f0f0f3' : '#4b5563'}
              textAnchor="middle"
            >
              {bar.word.toUpperCase()}
            </text>
          </g>
        );
      })}

      {/* Hover tooltip */}
      {hoveredIdx !== null && (() => {
        const bar = bars[hoveredIdx];
        const cx = xCenter(hoveredIdx);
        const topY = bar.after > 0 ? yScale(bar.after) : bottomY;
        const bw = 144;
        const bh = 64;
        let bx = cx - bw / 2;
        bx = Math.max(PAD.left, Math.min(bx, VIEW_W - PAD.right - bw));
        const by = Math.max(PAD.top, topY - bh - 8);
        const eliminated = bar.before - bar.after;

        return (
          <foreignObject x={bx} y={by} width={bw} height={bh} style={{ overflow: 'visible' }}>
            <div
              className="rounded-lg border border-[#4a4a4c] bg-[#2a2a2c] shadow-xl px-3 py-2 pointer-events-none"
              style={{ fontSize: 11 }}
            >
              <div className="font-mono font-bold text-text-primary">
                {bar.word.toUpperCase()}
              </div>
              <div className="font-mono tabular-nums text-text-secondary" style={{ fontSize: 10 }}>
                {bar.after} remaining
              </div>
              <div className="font-mono tabular-nums text-[#538d4e]" style={{ fontSize: 10 }}>
                -{eliminated} eliminated
              </div>
              {bar.info !== null && (
                <div className="font-mono tabular-nums text-text-ghost" style={{ fontSize: 10 }}>
                  {bar.info.toFixed(2)} bits gained
                </div>
              )}
            </div>
          </foreignObject>
        );
      })()}
    </svg>
  );
}
