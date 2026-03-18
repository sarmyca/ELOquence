'use client';
import { useState, useId } from 'react';
import { motion } from 'framer-motion';
import { EloHistoryEntry } from '@/lib/types';

interface Props {
  data: EloHistoryEntry[];
  width?: number;
  height?: number;
}

const TIER_THRESHOLDS = [800, 1200, 1400, 1600];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function EloSparkline({ data, width = 600, height = 200 }: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const gradId = useId().replace(/:/g, '');

  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-sm text-text-ghost"
        style={{ height }}
        role="img"
        aria-label="No rating history yet"
      >
        No rating history yet
      </div>
    );
  }

  const pad = { top: 20, right: 20, bottom: 30, left: 50 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const elos = data.map((d) => d.elo_after);
  const rawMin = Math.min(...elos);
  const rawMax = Math.max(...elos);
  // Expand range by 5% on each side so the line doesn't hug edges
  const range = rawMax - rawMin || 100;
  const minElo = Math.floor((rawMin - range * 0.05) / 50) * 50;
  const maxElo = Math.ceil((rawMax + range * 0.05) / 50) * 50;

  const xScale = (i: number) =>
    pad.left + (i / (data.length - 1)) * plotW;
  const yScale = (elo: number) =>
    pad.top + plotH - ((elo - minElo) / (maxElo - minElo)) * plotH;

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(d.elo_after).toFixed(1)}`)
    .join(' ');
  const areaPath =
    linePath +
    ` L ${xScale(data.length - 1).toFixed(1)} ${yScale(minElo).toFixed(1)}` +
    ` L ${xScale(0).toFixed(1)} ${yScale(minElo).toFixed(1)} Z`;

  const isGain = elos[elos.length - 1] >= elos[0];
  const color = isGain ? '#538d4e' : '#e74c3c';

  // Tier threshold lines that fall within the visible range
  const visibleThresholds = TIER_THRESHOLDS.filter(
    (t) => t > minElo && t < maxElo
  );

  // Hover tooltip
  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const tooltipX = hoverIndex !== null ? xScale(hoverIndex) : 0;
  const tooltipY = hovered ? yScale(hovered.elo_after) : 0;
  // Clamp tooltip so it doesn't overflow left/right
  const tooltipBoxW = 110;
  const tooltipBoxH = 40;
  let tooltipLeft = tooltipX - tooltipBoxW / 2;
  tooltipLeft = Math.max(pad.left, Math.min(tooltipLeft, width - pad.right - tooltipBoxW));
  const tooltipTop = tooltipY - tooltipBoxH - 8;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label={`ELO rating history from ${elos[0]} to ${elos[elos.length - 1]}`}
      onMouseLeave={() => setHoverIndex(null)}
    >
      <defs>
        <linearGradient id={`elo-area-grad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = pad.top + plotH * frac;
        return (
          <line
            key={frac}
            x1={pad.left}
            y1={y}
            x2={pad.left + plotW}
            y2={y}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        );
      })}

      {/* Tier threshold lines */}
      {visibleThresholds.map((t) => {
        const y = yScale(t);
        return (
          <g key={t}>
            <line
              x1={pad.left}
              y1={y}
              x2={pad.left + plotW}
              y2={y}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={pad.left + 4}
              y={y - 3}
              fontSize={9}
              fontFamily="monospace"
              fill="rgba(255,255,255,0.25)"
            >
              {t}
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      <motion.path
        d={areaPath}
        fill={`url(#elo-area-grad-${gradId})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      />

      {/* Line */}
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Invisible hit areas for hover */}
      {data.map((_, i) => {
        const x = xScale(i);
        const slotW = plotW / (data.length - 1);
        return (
          <rect
            key={i}
            x={x - slotW / 2}
            y={pad.top}
            width={slotW}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(i)}
          />
        );
      })}

      {/* Hover vertical line + dot */}
      {hoverIndex !== null && hovered && (
        <>
          <line
            x1={tooltipX}
            y1={pad.top}
            x2={tooltipX}
            y2={pad.top + plotH}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <circle
            cx={tooltipX}
            cy={tooltipY}
            r={4}
            fill={color}
            stroke="rgba(255,255,255,0.6)"
            strokeWidth={1.5}
          />
          {/* Tooltip box rendered in SVG foreignObject */}
          <foreignObject
            x={tooltipLeft}
            y={Math.max(pad.top, tooltipTop)}
            width={tooltipBoxW}
            height={tooltipBoxH}
            style={{ overflow: 'visible' }}
          >
            <div
              className="rounded-lg border border-[#4a4a4c] bg-[#2a2a2c] shadow-xl px-3 py-2 pointer-events-none"
              style={{ fontSize: 11, lineHeight: 1.4 }}
            >
              <div className="font-mono text-text-ghost" style={{ fontSize: 10 }}>
                {formatDate(hovered.recorded_at)}
              </div>
              <div
                className="font-mono font-bold tabular-nums"
                style={{ color, fontSize: 13 }}
              >
                {hovered.elo_after}
                {hovered.delta !== 0 && (
                  <span
                    className="ml-1 font-normal"
                    style={{ fontSize: 10, color: hovered.delta > 0 ? '#538d4e' : '#e74c3c' }}
                  >
                    {hovered.delta > 0 ? '+' : ''}{hovered.delta}
                  </span>
                )}
              </div>
            </div>
          </foreignObject>
        </>
      )}

      {/* Y-axis labels */}
      <text
        x={pad.left - 6}
        y={pad.top + 4}
        fontSize={10}
        fontFamily="monospace"
        fill="#4b5563"
        textAnchor="end"
      >
        {maxElo}
      </text>
      <text
        x={pad.left - 6}
        y={pad.top + plotH}
        fontSize={10}
        fontFamily="monospace"
        fill="#4b5563"
        textAnchor="end"
      >
        {minElo}
      </text>

      {/* X-axis labels */}
      <text
        x={pad.left}
        y={height - 6}
        fontSize={10}
        fontFamily="monospace"
        fill="#4b5563"
        textAnchor="start"
      >
        {formatDate(data[0].recorded_at)}
      </text>
      <text
        x={pad.left + plotW}
        y={height - 6}
        fontSize={10}
        fontFamily="monospace"
        fill="#4b5563"
        textAnchor="end"
      >
        {formatDate(data[data.length - 1].recorded_at)}
      </text>
    </svg>
  );
}
