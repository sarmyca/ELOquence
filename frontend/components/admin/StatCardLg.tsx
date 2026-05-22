'use client';
import React from 'react';

interface TrendInfo {
  value: number;
  direction: 'up' | 'down' | 'neutral';
}

interface Props {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sparkline?: number[];
  trend?: TrendInfo;
  accent?: 'green' | 'red' | 'gold' | 'default';
}

const ACCENT_COLORS: Record<string, string> = {
  green: 'var(--tile-correct)',
  red: 'var(--red)',
  gold: 'var(--gold)',
  default: 'var(--text-secondary)',
};

function MicroSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const d = 'M ' + pts.join(' L ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
      <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r={2.5} fill={color} />
    </svg>
  );
}

export default function StatCardLg({ label, value, icon: Icon, sparkline, trend, accent = 'default' }: Props) {
  const accentColor = ACCENT_COLORS[accent];

  let trendBg = 'var(--bg-elevated)';
  let trendColor = 'var(--text-tertiary)';
  let trendIcon = '—';
  if (trend) {
    if (trend.direction === 'up') {
      trendBg = 'rgba(106,170,100,0.12)';
      trendColor = 'var(--tile-correct)';
      trendIcon = '▲';
    } else if (trend.direction === 'down') {
      trendBg = 'rgba(231,76,60,0.10)';
      trendColor = 'var(--red)';
      trendIcon = '▼';
    }
  }

  return (
    <div className="bg-bg-base border border-border-default rounded-card-lg px-4 py-4 flex flex-col gap-3 min-w-0">
      {/* Top row: icon + label + trend */}
      <div className="flex items-center gap-2">
        <Icon size={14} style={{ color: accentColor, flexShrink: 0 }} />
        <span className="text-xs uppercase tracking-wider text-text-secondary font-semibold font-sans flex-1 min-w-0 truncate">
          {label}
        </span>
        {trend && (
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-sans font-semibold"
            style={{ fontSize: 10, backgroundColor: trendBg, color: trendColor, flexShrink: 0 }}
          >
            {trendIcon} {Math.abs(trend.value).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Value */}
      <div className="flex items-end justify-between gap-2">
        <span
          className="font-display font-bold text-text-primary tabular-nums leading-none"
          style={{ fontSize: '1.75rem' }}
        >
          {value}
        </span>
        {sparkline && sparkline.length >= 2 && (
          <div className="flex-shrink-0 mb-0.5">
            <MicroSparkline values={sparkline} color={accentColor} />
          </div>
        )}
      </div>
    </div>
  );
}
