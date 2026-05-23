'use client';
import { useState, useId } from 'react';
import { motion } from 'framer-motion';

interface SeriesDef {
  key: string;
  label: string;
  color: string;
}

interface Props {
  // Per-row mixed payload (numeric series values + a `date` ISO string).
  // The default Next.js eslint config doesn't load @typescript-eslint, so
  // we don't need a suppression comment for `any` — it's not flagged.
  data: Array<Record<string, any>>;
  series: SeriesDef[];
  height?: number;
  yLabel?: string;
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TimeSeriesChart({ data, series, height = 220, yLabel }: Props) {
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const gradId = useId().replace(/:/g, '');

  if (!data || data.length === 0) {
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

  const pad = { top: 20, right: 20, bottom: 32, left: yLabel ? 52 : 44 };
  const viewW = 600;
  const plotW = viewW - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  // Compute y domain across all series
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const row of data) {
    for (const s of series) {
      const v = row[s.key];
      if (typeof v === 'number') {
        if (v < yMin) yMin = v;
        if (v > yMax) yMax = v;
      }
    }
  }
  if (!isFinite(yMin)) { yMin = 0; yMax = 10; }
  if (yMin === yMax) { yMin = Math.max(0, yMin - 1); yMax = yMax + 1; }

  const xScale = (i: number) =>
    data.length < 2 ? pad.left + plotW / 2 : pad.left + (i / (data.length - 1)) * plotW;
  const yScale = (v: number) =>
    pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const buildPath = (seriesKey: string) => {
    const pts = data
      .map((row, i) => {
        const v = row[seriesKey];
        if (typeof v !== 'number') return null;
        return `${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`;
      })
      .filter(Boolean);
    if (pts.length === 0) return '';
    return 'M ' + pts.join(' L ');
  };

  // X-axis label indices: first, middle, last
  const xLabelIndices = [0, Math.floor((data.length - 1) / 2), data.length - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i
  );

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const svgX = relX * viewW;
    if (svgX < pad.left || svgX > pad.left + plotW) {
      setHoverX(null);
      setHoverIdx(null);
      return;
    }
    const t = (svgX - pad.left) / plotW;
    const rawIdx = t * (data.length - 1);
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(rawIdx)));
    setHoverX(xScale(idx));
    setHoverIdx(idx);
  };

  const tooltipW = 140;
  const tooltipH = 20 + series.length * 16 + 8;
  const hovered = hoverIdx !== null ? data[hoverIdx] : null;
  let tooltipLeft = hoverX !== null ? hoverX - tooltipW / 2 : 0;
  tooltipLeft = Math.max(pad.left, Math.min(tooltipLeft, viewW - pad.right - tooltipW));
  const tooltipTop = pad.top;

  return (
    <svg
      viewBox={`0 0 ${viewW} ${height}`}
      className="w-full"
      role="img"
      aria-label={`Time series chart${yLabel ? `: ${yLabel}` : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { setHoverX(null); setHoverIdx(null); }}
    >
      <defs>
        {series.map((s, i) => (
          <linearGradient key={i} id={`ts-grad-${gradId}-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.12" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = pad.top + plotH * (1 - frac);
        const val = yMin + (yMax - yMin) * frac;
        return (
          <g key={frac}>
            <line
              x1={pad.left}
              y1={y}
              x2={pad.left + plotW}
              y2={y}
              stroke="var(--border-subtle)"
              strokeWidth={1}
            />
            <text
              x={pad.left - 4}
              y={y + 4}
              fontSize={9}
              fontFamily="sans-serif"
              fill="var(--text-tertiary)"
              textAnchor="end"
            >
              {Number.isInteger(val) ? val : val.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* Y-axis label */}
      {yLabel && (
        <text
          x={8}
          y={pad.top + plotH / 2}
          fontSize={9}
          fontFamily="sans-serif"
          fill="var(--text-secondary)"
          textAnchor="middle"
          transform={`rotate(-90, 8, ${pad.top + plotH / 2})`}
        >
          {yLabel}
        </text>
      )}

      {/* Series paths */}
      {series.map((s, i) => {
        const d = buildPath(s.key);
        if (!d) return null;
        // Build area path
        const firstPt = data.findIndex((row) => typeof row[s.key] === 'number');
        const lastPt = data.length - 1 - [...data].reverse().findIndex((row) => typeof row[s.key] === 'number');
        const areaClose = ` L ${xScale(lastPt).toFixed(1)},${yScale(yMin).toFixed(1)} L ${xScale(firstPt).toFixed(1)},${yScale(yMin).toFixed(1)} Z`;
        return (
          <g key={s.key}>
            <motion.path
              d={d + areaClose}
              fill={`url(#ts-grad-${gradId}-${i})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            />
            <motion.path
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
            />
          </g>
        );
      })}

      {/* X-axis labels */}
      {xLabelIndices.map((idx) => (
        <text
          key={idx}
          x={xScale(idx)}
          y={height - 6}
          fontSize={9}
          fontFamily="sans-serif"
          fill="var(--text-secondary)"
          textAnchor={idx === 0 ? 'start' : idx === data.length - 1 ? 'end' : 'middle'}
        >
          {formatDateLabel(data[idx].date)}
        </text>
      ))}

      {/* Hover guide */}
      {hoverX !== null && hoverIdx !== null && hovered && (
        <>
          <line
            x1={hoverX}
            y1={pad.top}
            x2={hoverX}
            y2={pad.top + plotH}
            stroke="var(--border-default)"
            strokeWidth={1}
            strokeDasharray="3 3"
            pointerEvents="none"
          />
          {series.map((s) => {
            const v = hovered[s.key];
            if (typeof v !== 'number') return null;
            return (
              <circle
                key={s.key}
                cx={hoverX}
                cy={yScale(v)}
                r={3.5}
                fill={s.color}
                stroke="var(--bg-base)"
                strokeWidth={1.5}
                pointerEvents="none"
              />
            );
          })}
          <foreignObject
            x={tooltipLeft}
            y={Math.max(pad.top, tooltipTop)}
            width={tooltipW}
            height={tooltipH}
            style={{ overflow: 'visible' }}
          >
            <div
              className="rounded-md border border-border-default bg-bg-base shadow-md px-3 py-2 pointer-events-none"
              style={{ fontSize: 11, lineHeight: 1.5 }}
            >
              <div className="font-sans text-text-secondary mb-1" style={{ fontSize: 10 }}>
                {formatDateLabel(hovered.date)}
              </div>
              {series.map((s) => {
                const v = hovered[s.key];
                return (
                  <div key={s.key} className="flex items-center gap-1.5">
                    <span
                      style={{
                        display: 'inline-block',
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: s.color,
                        flexShrink: 0,
                      }}
                    />
                    <span className="font-sans text-text-secondary" style={{ fontSize: 10, flex: 1 }}>
                      {s.label}
                    </span>
                    <span className="font-mono font-bold text-text-primary tabular-nums" style={{ fontSize: 11 }}>
                      {typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(1)) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </foreignObject>
        </>
      )}
    </svg>
  );
}
