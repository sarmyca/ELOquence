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

function MiniPatternTiles({ pattern, size = 10 }: { pattern: number; size?: number }) {
  const tiles = patternToTiles(pattern);
  return (
    <div className="flex gap-0.5">
      {tiles.map((state, i) => {
        const colorMap: Record<string, string> = {
          correct: 'var(--tile-correct)',
          present: 'var(--tile-present)',
          absent: 'var(--tile-absent)',
        };
        return (
          <div
            key={i}
            style={{
              width: size,
              height: size,
              backgroundColor: colorMap[state] ?? 'var(--tile-absent)',
              borderRadius: 1,
            }}
          />
        );
      })}
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
      <div className="flex items-center justify-center text-sm text-text-secondary py-8">
        No pattern distribution data available.
      </div>
    );
  }

  const sorted = [...distribution].sort((a, b) => b.count - a.count);

  const maxProb = Math.max(...sorted.map((b) => b.probability), 0.001);
  const n = sorted.length;
  const barW = Math.max(1, Math.min(10, (PLOT_W / n) * 0.8));

  const xPos = (i: number) => PAD.left + (i / n) * PLOT_W + (PLOT_W / n) / 2;
  const barHeight = (prob: number) => (prob / maxProb) * PLOT_H;

  const Y_LABELS = [0, 0.25, 0.5, 0.75, 1.0];

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
                stroke="var(--border-subtle)"
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
              stroke="var(--border-default)"
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
            const hitW = Math.max(barW, PLOT_W / n);

            // actual = yellow/present, selected = green/correct, default = muted green
            const fillVar = isActual
              ? 'var(--tile-present)'
              : isSelected
              ? 'var(--tile-correct)'
              : 'var(--tile-correct)';
            const opacity = isActual || isSelected ? 1 : 0.45;

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
                  fill={fillVar}
                  opacity={opacity}
                />
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={PAD.top + PLOT_H + 6}
                    r={2.5}
                    fill="var(--tile-correct)"
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
            fontFamily="sans-serif"
            fill="var(--text-secondary)"
            textAnchor="middle"
          >
            {n} pattern{n !== 1 ? 's' : ''} sorted by frequency
          </text>

          {/* Y-axis label */}
          <text
            x={8}
            y={PAD.top + PLOT_H / 2}
            fontSize={9}
            fontFamily="sans-serif"
            fill="var(--text-secondary)"
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
                fontFamily="sans-serif"
                fill="var(--text-secondary)"
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
                  className="rounded-md border border-border-default bg-bg-base shadow-md px-3 py-2 pointer-events-none"
                  style={{ fontSize: 11 }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <MiniPatternTiles pattern={bucket.pattern} />
                    {bucket.pattern === actualPattern && (
                      <span className="text-[10px] font-semibold" style={{ color: 'var(--tile-present)' }}>actual</span>
                    )}
                  </div>
                  <div className="font-mono tabular-nums text-text-primary font-bold">
                    {(bucket.probability * 100).toFixed(2)}%
                  </div>
                  <div className="font-mono tabular-nums text-text-secondary" style={{ fontSize: 10 }}>
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
        <div className="rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2.5">
          <div className="flex items-center gap-2 mb-2">
            <MiniPatternTiles pattern={selectedBucket.pattern} size={14} />
            <span className="text-xs font-sans text-text-secondary">
              {selectedBucket.count} word{selectedBucket.count !== 1 ? 's' : ''}
            </span>
            {selectedBucket.pattern === actualPattern && (
              <span className="text-[10px] font-semibold" style={{ color: 'var(--tile-present)' }}>actual result</span>
            )}
            <button
              onClick={() => setSelectedIdx(null)}
              className="ml-auto text-text-secondary hover:text-text-primary text-xs transition-colors"
            >
              close
            </button>
          </div>
          {selectedWords.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedWords.map((word) => (
                <span
                  key={word}
                  className="px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-bg-muted text-text-primary"
                >
                  {word}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-secondary">
              No word data available.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
