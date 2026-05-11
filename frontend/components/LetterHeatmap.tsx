'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  frequencies: Record<string, Record<string, number>>;
  knownPositions?: Record<number, string>;
  knownPresent?: string[];
}

const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const POSITIONS = [0, 1, 2, 3, 4];
const POS_LABELS = ['1', '2', '3', '4', '5'];

const CELL_W = 38;
const CELL_H = 18;
const CELL_GAP = 1;
const ROW_LABEL_W = 22;
const COL_LABEL_H = 20;

/**
 * Returns a green-scale fill using var(--tile-correct) at variable alpha.
 * value is 0–100 (percentage). Returns 'transparent' for zero.
 */
function getHeatAlpha(value: number): number {
  if (value <= 0) return 0;
  // Map 0–100 onto 0.08–0.9 alpha
  return Math.min(0.9, 0.08 + (value / 100) * 0.82);
}

export default function LetterHeatmap({ frequencies, knownPositions, knownPresent }: Props) {
  const [hovered, setHovered] = useState<{ letter: string; pos: number } | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  const getFreq = (pos: number, letter: string): number => {
    const posData = frequencies[String(pos)];
    if (!posData) return 0;
    return posData[letter] ?? posData[letter.toLowerCase()] ?? 0;
  };

  const LETTERS = ALL_LETTERS.filter((letter) =>
    POSITIONS.some((pos) => getFreq(pos, letter) > 0)
  );

  const totalW = ROW_LABEL_W + POSITIONS.length * (CELL_W + CELL_GAP) - CELL_GAP;
  const totalH = COL_LABEL_H + LETTERS.length * (CELL_H + CELL_GAP) - CELL_GAP;

  return (
    <div
      className="relative overflow-auto"
      onMouseLeave={() => {
        setHovered(null);
        setHoveredRow(null);
        setHoveredCol(null);
      }}
    >
      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        className="w-full"
        style={{ minWidth: totalW }}
        role="img"
        aria-label="Letter frequency heatmap by position"
      >
        {/* Column headers */}
        {POSITIONS.map((pos) => {
          const x = ROW_LABEL_W + pos * (CELL_W + CELL_GAP) + CELL_W / 2;
          return (
            <text
              key={pos}
              x={x}
              y={14}
              fontSize={11}
              fontFamily="sans-serif"
              fill="var(--text-secondary)"
              textAnchor="middle"
              fontWeight={hoveredCol === pos ? 'bold' : 'normal'}
            >
              {POS_LABELS[pos]}
            </text>
          );
        })}

        {/* Cells */}
        {LETTERS.map((letter, rowIdx) => {
          const y = COL_LABEL_H + rowIdx * (CELL_H + CELL_GAP);
          const isKnownPresent = knownPresent?.includes(letter);

          return (
            <g key={letter}>
              {/* Row label */}
              <text
                x={ROW_LABEL_W - 4}
                y={y + CELL_H / 2 + 4}
                fontSize={11}
                fontFamily="sans-serif"
                fill={
                  hoveredRow === letter
                    ? 'var(--text-primary)'
                    : isKnownPresent
                    ? 'var(--tile-present)'
                    : 'var(--text-secondary)'
                }
                textAnchor="end"
                fontWeight={hoveredRow === letter ? 'bold' : 'normal'}
              >
                {letter}
              </text>

              {/* Row highlight bar */}
              {hoveredRow === letter && (
                <rect
                  x={ROW_LABEL_W}
                  y={y}
                  width={POSITIONS.length * (CELL_W + CELL_GAP) - CELL_GAP}
                  height={CELL_H}
                  fill="var(--bg-muted)"
                  rx={2}
                />
              )}

              {/* Known present indicator */}
              {isKnownPresent && (
                <rect
                  x={0}
                  y={y + 2}
                  width={3}
                  height={CELL_H - 4}
                  fill="var(--tile-present)"
                  rx={1}
                />
              )}

              {/* Cells per position */}
              {POSITIONS.map((pos) => {
                const freq = getFreq(pos, letter);
                const alpha = getHeatAlpha(freq);
                const cellX = ROW_LABEL_W + pos * (CELL_W + CELL_GAP);
                const isKnownGreen = knownPositions?.[pos]?.toUpperCase() === letter;
                const isHoveredCell = hovered?.letter === letter && hovered?.pos === pos;
                const isHighlighted = hoveredRow === letter || hoveredCol === pos;
                // For high-alpha cells, use light text for readability
                const textFill = alpha > 0.55 ? 'var(--bg-base)' : 'var(--text-primary)';

                return (
                  <motion.g
                    key={pos}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: (rowIdx * 5 + pos) * 0.01 }}
                    onMouseEnter={() => {
                      setHovered({ letter, pos });
                      setHoveredRow(letter);
                      setHoveredCol(pos);
                    }}
                    style={{ cursor: 'default' }}
                  >
                    {/* Base cell */}
                    <rect
                      x={cellX}
                      y={y}
                      width={CELL_W}
                      height={CELL_H}
                      rx={2}
                      fill="var(--bg-elevated)"
                      stroke="var(--border-subtle)"
                      strokeWidth={0.5}
                      opacity={isHighlighted && !isHoveredCell ? 0.7 : 1}
                    />
                    {/* Heat overlay */}
                    {alpha > 0 && (
                      <rect
                        x={cellX}
                        y={y}
                        width={CELL_W}
                        height={CELL_H}
                        rx={2}
                        style={{ fill: `rgb(from var(--tile-correct) r g b / ${alpha})` }}
                      />
                    )}
                    {/* Known-green outline */}
                    {isKnownGreen && (
                      <rect
                        x={cellX}
                        y={y}
                        width={CELL_W}
                        height={CELL_H}
                        rx={2}
                        fill="none"
                        stroke="var(--tile-correct)"
                        strokeWidth={1.5}
                      />
                    )}

                    {freq >= 5 && (
                      <text
                        x={cellX + CELL_W / 2}
                        y={y + CELL_H / 2 + 4}
                        fontSize={9}
                        fontFamily="sans-serif"
                        fill={textFill}
                        textAnchor="middle"
                        fontWeight="600"
                      >
                        {freq.toFixed(0)}%
                      </text>
                    )}

                    {isKnownGreen && (
                      <text
                        x={cellX + CELL_W - 4}
                        y={y + 8}
                        fontSize={8}
                        fill="var(--tile-correct)"
                        textAnchor="end"
                      >
                        ✓
                      </text>
                    )}
                  </motion.g>
                );
              })}
            </g>
          );
        })}

        {/* Column highlight overlay */}
        {hoveredCol !== null && (
          <rect
            x={ROW_LABEL_W + hoveredCol * (CELL_W + CELL_GAP)}
            y={COL_LABEL_H}
            width={CELL_W}
            height={LETTERS.length * (CELL_H + CELL_GAP) - CELL_GAP}
            fill="var(--bg-muted)"
            rx={2}
            opacity={0.25}
            pointerEvents="none"
          />
        )}

        {/* Hover tooltip */}
        {hovered && (() => {
          const freq = getFreq(hovered.pos, hovered.letter);
          const cellX = ROW_LABEL_W + hovered.pos * (CELL_W + CELL_GAP);
          const rowIdx = LETTERS.indexOf(hovered.letter);
          const y = COL_LABEL_H + rowIdx * (CELL_H + CELL_GAP);
          const bw = 120;
          const bh = 48;
          let bx = cellX + CELL_W + 4;
          if (bx + bw > totalW) bx = cellX - bw - 4;
          let by = y - 4;
          if (by + bh > totalH) by = totalH - bh;

          return (
            <foreignObject x={bx} y={by} width={bw} height={bh} style={{ overflow: 'visible' }}>
              <div
                className="rounded-md border border-border-default bg-bg-base shadow-md px-3 py-2 pointer-events-none"
                style={{ fontSize: 11 }}
              >
                <div className="font-sans font-bold text-text-primary">
                  {hovered.letter} at pos {hovered.pos + 1}
                </div>
                <div
                  className="font-mono tabular-nums"
                  style={{ color: 'var(--tile-correct)', fontSize: 13 }}
                >
                  {freq.toFixed(1)}%
                </div>
              </div>
            </foreignObject>
          );
        })()}
      </svg>
    </div>
  );
}
