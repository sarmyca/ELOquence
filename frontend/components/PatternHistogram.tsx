'use client';
import { useRef, useState } from 'react';
import { PatternBucket, patternToTiles } from '@/lib/types';

interface Props {
  distribution: PatternBucket[];
  actualPattern: number;
}

const VIEW_W = 500;
const VIEW_H = 200;
const PAD = { top: 20, right: 20, bottom: 40, left: 40 };
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;

const TILE_STATE_COLORS: Record<string, string> = {
  correct: '#538d4e',
  present: '#b59f3b',
  absent: '#3a3a3c',
};

function MiniPatternTiles({ pattern, size = 10 }: { pattern: number; size?: number }) {
  const tiles = patternToTiles(pattern);
  return (
    <div className="flex gap-0.5">
      {tiles.map((state, i) => (
        <div
          key={i}
          style={{
            width: size,
            height: size,
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
  actualPattern,
}: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [mouseX, setMouseX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!distribution || distribution.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-text-ghost py-8">
        No pattern distribution data available.
      </div>
    );
  }

  // Sort by count descending, show all
  const sorted = [...distribution].sort((a, b) => b.count - a.count);

  const maxProb = Math.max(...sorted.map((b) => b.probability), 0.001);
  const n = sorted.length;
  const barW = Math.max(1, Math.min(10, (PLOT_W / n) * 0.8));

  const xPos = (i: number) => PAD.left + (i / n) * PLOT_W + (PLOT_W / n) / 2;
  const barHeight = (prob: number) => (prob / maxProb) * PLOT_H;

  const Y_LABELS = [0, 0.25, 0.5, 0.75, 1.0];

  /** Convert mouse clientX to SVG x coordinate */
  const toSvgX = (clientX: number): number | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;
    return relX * VIEW_W;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const sx = toSvgX(e.clientX);
    if (sx !== null && sx >= PAD.left && sx <= PAD.left + PLOT_W) {
      setMouseX(sx);
    } else {
      setMouseX(null);
    }
  };

  const handleBarClick = (idx: number) => {
    setSelectedIdx(prev => prev === idx ? null : idx);
  };

  const selectedBucket = selectedIdx !== null ? sorted[selectedIdx] : null;
  const selectedWords = selectedBucket?.words ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full"
          role="img"
          aria-label="Pattern probability distribution histogram"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => { setHoveredIdx(null); setMouseX(null); }}
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

          {/* Vertical crosshair line */}
          {mouseX !== null && (
            <line
              x1={mouseX}
              y1={PAD.top}
              x2={mouseX}
              y2={PAD.top + PLOT_H}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={1}
              strokeDasharray="3 3"
              pointerEvents="none"
            />
          )}

          {/* Main bars */}
          {sorted.map((bucket, i) => {
            const isActual = bucket.pattern === actualPattern;
            const isSelected = selectedIdx === i;
            const h = Math.max(2, barHeight(bucket.probability));
            const cx = xPos(i);
            const y = PAD.top + PLOT_H - h;
            const fill = isActual ? '#b59f3b' : isSelected ? '#6aaa64' : '#538d4e';
            const hitW = Math.max(barW, PLOT_W / n);

            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onClick={() => handleBarClick(i)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={cx - barW / 2}
                  y={y}
                  width={barW}
                  height={h}
                  rx={barW > 3 ? 1 : 0}
                  fill={fill}
                  opacity={isActual || isSelected ? 1 : 0.5}
                  style={
                    isActual
                      ? { filter: 'drop-shadow(0 0 8px #b59f3b80)' }
                      : isSelected
                        ? { filter: 'drop-shadow(0 0 6px #6aaa6480)' }
                        : undefined
                  }
                />
                {/* Selected indicator dot */}
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={PAD.top + PLOT_H + 6}
                    r={2.5}
                    fill="#6aaa64"
                  />
                )}
                {/* Invisible wider hit area */}
                <rect
                  x={cx - hitW / 2}
                  y={PAD.top}
                  width={hitW}
                  height={PLOT_H}
                  fill="transparent"
                />
              </g>
            );
          })}

          {/* X-axis label */}
          <text
            x={PAD.left + PLOT_W / 2}
            y={VIEW_H - 4}
            fontSize={9}
            fontFamily="monospace"
            fill="#4b5563"
            textAnchor="middle"
          >
            {n} pattern{n !== 1 ? 's' : ''} sorted by frequency
          </text>

          {/* Y-axis label */}
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
                      <span className="text-[#b59f3b] text-[9px] font-semibold">actual</span>
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

      {/* Selected pattern detail panel */}
      {selectedBucket && (
        <div className="rounded-lg border border-border-primary bg-bg-elevated px-3 py-2.5">
          <div className="flex items-center gap-2 mb-2">
            <MiniPatternTiles pattern={selectedBucket.pattern} size={14} />
            <span className="text-xs font-mono text-text-secondary">
              {selectedBucket.count} word{selectedBucket.count !== 1 ? 's' : ''}
            </span>
            {selectedBucket.pattern === actualPattern && (
              <span className="text-[#b59f3b] text-[10px] font-semibold">actual result</span>
            )}
            <button
              onClick={() => setSelectedIdx(null)}
              className="ml-auto text-text-ghost hover:text-text-secondary text-xs"
            >
              close
            </button>
          </div>
          {selectedWords.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedWords.map((word) => (
                <span
                  key={word}
                  className="px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-white/[0.06] text-text-primary"
                >
                  {word}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-ghost">
              No word data available.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
