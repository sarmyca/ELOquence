'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { MoveAnalysis, CLASSIFICATION_CONFIG } from '@/lib/types';

interface Props {
  moves: MoveAnalysis[];
  /** When true, show the extended WordleBot per-turn card layout */
  extended?: boolean;
  onMoveClick?: (index: number) => void;
}

const THRESHOLDS = [
  { value: 0.97, label: 'Best' },
  { value: 0.85, label: 'Good' },
  { value: 0.70, label: 'Okay' },
  { value: 0.50, label: 'Inaccuracy' },
];

const VIEW_W = 400;
const VIEW_H = 200;
const PAD = { top: 16, right: 20, bottom: 32, left: 44 };
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;

/** Skill score → CSS color via var tokens */
function skillColor(skill: number): string {
  if (skill >= 80) return 'var(--tile-correct)';
  if (skill >= 50) return 'var(--tile-present)';
  return 'var(--red)';
}

/** Luck score → CSS color */
function luckColor(luck: number): string {
  if (luck >= 80) return '#1565c0';
  if (luck >= 30) return 'var(--text-secondary)';
  return 'var(--red)';
}

export default function MoveQualityTimeline({ moves, extended = false, onMoveClick }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!moves || moves.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm py-8"
        style={{ color: 'var(--text-ghost)' }}
      >
        No move data available.
      </div>
    );
  }

  if (extended) {
    return (
      <div className="flex flex-col gap-3">
        {moves.map((m, i) => {
          const skill = m.skill_score ?? 0;
          const luck = m.luck_score ?? 50;
          const remainBefore = m.remaining_before ?? m.remaining_words ?? 0;
          const remainAfter = m.remaining_after ?? 0;
          const expSolAfter = m.expected_solutions_after ?? 0;
          const actSolAfter = m.actual_solutions_after ?? remainAfter;
          const expSteps = m.expected_steps_until_solution ?? 1;
          const botPick = m.bot_pick ?? '';
          const isGolden = skill === 99;

          return (
            <motion.div
              key={m.id || i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl p-3 cursor-pointer transition-colors"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
              onClick={() => onMoveClick?.(i)}
            >
              {/* Top row: tiles comparison + chips */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Move number */}
                <span
                  className="text-xs font-mono w-4 shrink-0 text-right"
                  style={{ color: 'var(--text-ghost)' }}
                >
                  {i + 1}
                </span>

                {/* Player word */}
                <div className="flex flex-col gap-0.5">
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-ghost)' }}
                  >
                    You
                  </span>
                  <span
                    className="text-sm font-mono font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {m.guess_word}
                  </span>
                </div>

                {/* Divider */}
                <div
                  className="w-px h-8 self-center"
                  style={{ backgroundColor: 'var(--border-subtle)' }}
                />

                {/* Bot word */}
                <div className="flex flex-col gap-0.5">
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-ghost)' }}
                  >
                    Bot
                  </span>
                  <span
                    className="text-sm font-mono font-bold uppercase tracking-wider"
                    style={{
                      color: botPick === m.guess_word
                        ? 'var(--tile-correct)'
                        : 'var(--text-secondary)',
                    }}
                    title={m.bot_pick_rationale ?? ''}
                  >
                    {botPick || '—'}
                  </span>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Skill chip */}
                <div className="flex items-center gap-1">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      color: skillColor(skill),
                      backgroundColor: `${skillColor(skill)}18`,
                    }}
                    title={`Skill: ${skill}/99`}
                  >
                    {isGolden && (
                      <Check
                        size={10}
                        style={{ color: 'var(--gold)' }}
                        aria-label="Bot's seal — matched bot perfectly"
                      />
                    )}
                    Skill {skill}
                  </span>

                  {/* Luck chip */}
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      color: luckColor(luck),
                      backgroundColor: `${luckColor(luck)}18`,
                    }}
                    title={`Luck: ${luck}/99 (50 = neutral)`}
                  >
                    Luck {luck}
                  </span>
                </div>
              </div>

              {/* Remaining solutions delta row */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span
                  className="text-xs font-mono"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {remainBefore} → {remainAfter}
                </span>

                <span
                  className="text-[10px]"
                  style={{ color: 'var(--text-ghost)' }}
                >
                  Exp. sol. after: <span className="font-mono tabular-nums">{expSolAfter.toFixed(1)}</span>
                </span>

                <span
                  className="text-[10px]"
                  style={{ color: 'var(--text-ghost)' }}
                >
                  Actual: <span className="font-mono tabular-nums">{actSolAfter}</span>
                </span>

                <span
                  className="text-[10px]"
                  style={{ color: 'var(--text-ghost)' }}
                >
                  Exp. steps: <span className="font-mono tabular-nums">{expSteps.toFixed(1)}</span>
                </span>

                {/* Classification badge */}
                {m.classification && CLASSIFICATION_CONFIG[m.classification] && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ml-auto"
                    style={{
                      color: CLASSIFICATION_CONFIG[m.classification].color,
                      backgroundColor: `${CLASSIFICATION_CONFIG[m.classification].color}18`,
                    }}
                  >
                    {CLASSIFICATION_CONFIG[m.classification].icon}{' '}
                    {CLASSIFICATION_CONFIG[m.classification].label}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  }

  // ---- Standard SVG chart mode ----
  const n = moves.length;

  const xScale = (i: number): number => {
    if (n === 1) return PAD.left + PLOT_W / 2;
    return PAD.left + (i / (n - 1)) * PLOT_W;
  };
  const yScale = (v: number): number => PAD.top + PLOT_H - v * PLOT_H;

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
            stroke="var(--border-subtle)"
            strokeOpacity={0.5}
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
            stroke="var(--border-default)"
            strokeOpacity={0.3}
            strokeWidth={1}
            strokeDasharray="3 4"
          />
        ))}

        {/* Connecting line */}
        {linePts.length >= 2 && (
          <motion.path
            d={linePath}
            fill="none"
            stroke="var(--border-strong)"
            strokeOpacity={0.35}
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
            : 'var(--text-ghost)';
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
                fill={isForced ? 'var(--text-ghost)' : color}
                stroke="var(--bg-base)"
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
            fill="var(--text-tertiary)"
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
            fill="var(--text-tertiary)"
            textAnchor="end"
          >
            {v.toFixed(2)}
          </text>
        ))}

        {/* Hover tooltip */}
        {hoveredIdx !== null && (() => {
          const m = moves[hoveredIdx];
          const eff = Math.max(0, Math.min(1, m.efficiency_ratio ?? 0));
          const cx = xScale(hoveredIdx);
          const cy = yScale(eff);
          const color = m.classification
            ? CLASSIFICATION_CONFIG[m.classification].color
            : 'var(--text-ghost)';
          const label = m.classification
            ? CLASSIFICATION_CONFIG[m.classification].label
            : 'Unknown';
          const bw = 140;
          const bh = 64;
          let bx = cx - bw / 2;
          bx = Math.max(PAD.left, Math.min(bx, VIEW_W - PAD.right - bw));
          const by = Math.max(PAD.top, cy - bh - 10);

          return (
            <foreignObject x={bx} y={by} width={bw} height={bh} style={{ overflow: 'visible' }}>
              <div
                className="rounded-lg shadow-xl px-3 py-2 pointer-events-none"
                style={{
                  fontSize: 11,
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  className="font-mono"
                  style={{ fontSize: 10, color: 'var(--text-ghost)' }}
                >
                  Move {m.move_number} — {m.guess_word.toUpperCase()}
                </div>
                <div
                  className="font-mono font-bold tabular-nums"
                  style={{ color, fontSize: 12 }}
                >
                  {(eff * 100).toFixed(1)}% efficiency
                </div>
                <div style={{ fontSize: 10, color }}>
                  {label}
                </div>
                {m.skill_score !== undefined && (
                  <div
                    className="font-mono tabular-nums"
                    style={{ fontSize: 10, color: 'var(--text-secondary)' }}
                  >
                    Skill {m.skill_score} · Luck {m.luck_score ?? 50}
                  </div>
                )}
              </div>
            </foreignObject>
          );
        })()}
      </svg>
    </div>
  );
}
