'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2,
  BarChart2,
  Brain,
  Zap,
  Target,
  Trophy,
  Keyboard,
  BookOpen,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  Star,
  Lock,
  ChevronDown,
  Sun,
  Swords,
  FlaskConical,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { springs } from '@/lib/animations';
import clsx from 'clsx';

/* ------------------------------------------------------------------ */
/*  Shared primitives                                                   */
/* ------------------------------------------------------------------ */

function Tile({
  letter,
  color,
  size = 'md',
}: {
  letter: string;
  color: 'green' | 'yellow' | 'gray' | 'empty';
  size?: 'sm' | 'md';
}) {
  const bgStyle: React.CSSProperties =
    color === 'green'
      ? { backgroundColor: 'var(--tile-correct)' }
      : color === 'yellow'
        ? { backgroundColor: 'var(--tile-present)' }
        : color === 'empty'
          ? { backgroundColor: 'transparent', border: '2px solid var(--tile-empty-border)' }
          : { backgroundColor: 'var(--tile-absent)' };

  const s = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm';
  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center rounded-tile font-bold text-white',
        s,
      )}
      style={bgStyle}
    >
      {letter}
    </span>
  );
}

function TileRow({
  word,
  pattern,
}: {
  word: string;
  pattern: ('green' | 'yellow' | 'gray')[];
}) {
  return (
    <div className="flex gap-1">
      {word.split('').map((ch, i) => (
        <Tile key={i} letter={ch} color={pattern[i]} size="sm" />
      ))}
    </div>
  );
}

function ClassBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 font-sans text-xs font-semibold px-2 py-0.5 rounded-pill"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`, color }}
    >
      {label}
    </span>
  );
}

function EfficiencyBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-pill bg-bg-muted overflow-hidden">
        <div
          className="h-full rounded-pill transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="font-mono text-[10px] text-text-ghost w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}

function MiniSparkline() {
  const points = [1000, 1024, 1018, 1057, 1045, 1089, 1076, 1102, 1098, 1134];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const h = 32;
  const w = 140;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / (max - min)) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className="block">
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke="var(--tile-correct)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <circle
        cx={w}
        cy={parseFloat(coords[coords.length - 1].split(',')[1])}
        r={2.5}
        fill="var(--tile-correct)"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Inner card helper — replaces all hardcoded #171719 backgrounds      */
/* ------------------------------------------------------------------ */
function InnerCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('p-3 rounded-card bg-bg-elevated border border-border-subtle', className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section data                                                        */
/* ------------------------------------------------------------------ */

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: 'modes',
    icon: <Gamepad2 size={18} />,
    title: 'Game Modes',
    content: (
      <div className="space-y-4">
        <p className="font-sans text-sm text-text-secondary leading-relaxed">
          ELOquence offers three ways to play, each with a different purpose.
        </p>
        <div className="grid gap-3">
          {[
            {
              icon: <Sun size={16} className="text-tile-present shrink-0 mt-0.5" />,
              name: 'Daily',
              desc: 'One puzzle per day, same word for all players. Your result affects your ELO rating. Come back every day to keep your streak alive.',
            },
            {
              icon: <Swords size={16} className="text-tile-absent shrink-0 mt-0.5" />,
              name: 'Competitive',
              desc: 'Unlimited rated games drawn from the extended word pool (~5,500 words). Each game changes your ELO. Great for climbing the leaderboard.',
            },
            {
              icon: <FlaskConical size={16} className="text-text-secondary shrink-0 mt-0.5" />,
              name: 'Practice',
              desc: 'Unlimited unrated games from the standard word pool (2,309 words). No ELO impact — experiment freely with new strategies.',
            },
          ].map((m) => (
            <div
              key={m.name}
              className="flex gap-3 p-3 rounded-card bg-bg-elevated border border-border-subtle"
            >
              {m.icon}
              <div>
                <p className="font-sans text-sm font-semibold text-text-primary">{m.name}</p>
                <p className="font-sans text-xs text-text-secondary mt-0.5 leading-relaxed">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  {
    id: 'tiles',
    icon: <Target size={18} />,
    title: 'How Tiles Work',
    content: (
      <div className="space-y-4">
        <p className="font-sans text-sm text-text-secondary leading-relaxed">
          After each guess, every letter is colored to show how close you are to the answer.
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Tile letter="A" color="green" />
            <div>
              <p className="font-sans text-sm font-semibold text-text-primary">Green</p>
              <p className="font-sans text-xs text-text-secondary">Correct letter in the correct position.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Tile letter="B" color="yellow" />
            <div>
              <p className="font-sans text-sm font-semibold text-text-primary">Yellow</p>
              <p className="font-sans text-xs text-text-secondary">Correct letter, but in the wrong position.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Tile letter="C" color="gray" />
            <div>
              <p className="font-sans text-sm font-semibold text-text-primary">Gray</p>
              <p className="font-sans text-xs text-text-secondary">Letter is not in the word at all.</p>
            </div>
          </div>
        </div>

        <InnerCard className="space-y-2">
          <p className="font-sans text-xs font-semibold text-text-primary">Example — answer is CRANE</p>
          <div className="flex flex-col gap-1.5 items-start">
            <div className="flex items-center gap-3">
              <TileRow word="SALET" pattern={['gray', 'yellow', 'gray', 'yellow', 'gray']} />
              <span className="font-sans text-[10px] text-text-ghost">A and E are in the word, wrong spots</span>
            </div>
            <div className="flex items-center gap-3">
              <TileRow word="ADORE" pattern={['yellow', 'gray', 'gray', 'yellow', 'green']} />
              <span className="font-sans text-[10px] text-text-ghost">E locked in, A and R found but wrong spots</span>
            </div>
            <div className="flex items-center gap-3">
              <TileRow word="CRANE" pattern={['green', 'green', 'green', 'green', 'green']} />
              <span className="font-sans text-[10px] text-text-ghost">Solved in 3!</span>
            </div>
          </div>
        </InnerCard>

        <InnerCard>
          <p className="font-sans text-xs text-text-secondary leading-relaxed">
            <span className="font-semibold text-text-primary">Tip:</span> Pay attention to
            yellows — they tell you which letters to reuse in a different spot. Ignoring them
            is flagged as a constraint violation in analysis.
          </p>
        </InnerCard>
      </div>
    ),
  },

  {
    id: 'elo',
    icon: <TrendingUp size={18} />,
    title: 'ELO Rating System',
    content: (
      <div className="space-y-4">
        <p className="font-sans text-sm text-text-secondary leading-relaxed">
          Your ELO rating measures your skill. It goes up when you win and down when you lose,
          with the magnitude depending on the word&apos;s difficulty relative to your rating.
        </p>

        <InnerCard>
          <p className="font-sans text-[10px] text-text-ghost uppercase tracking-wider mb-2">Example: Win vs hard word</p>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="font-display text-lg font-bold text-text-primary">1057</p>
              <p className="font-sans text-[10px] text-text-ghost">Before</p>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-sans text-xs font-bold" style={{ color: 'var(--tile-correct)' }}>+43</span>
              <div className="w-12 h-px bg-border-subtle" />
              <span className="font-sans text-[9px] text-text-ghost">Word: 1420</span>
            </div>
            <div className="text-center">
              <p className="font-display text-lg font-bold" style={{ color: 'var(--tile-correct)' }}>1100</p>
              <p className="font-sans text-[10px] text-text-ghost">After</p>
            </div>
          </div>
        </InnerCard>

        <div className="space-y-2">
          <p className="font-sans text-xs font-semibold text-text-primary uppercase tracking-wider">Rating Tiers</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: 'Novice',      range: '0 – 1199',   cls: 'bg-tier-novice' },
              { name: 'Veteran',     range: '1200 – 1399', cls: 'bg-tier-veteran' },
              { name: 'Master',      range: '1400 – 1599', cls: 'bg-tier-master' },
              { name: 'Grandmaster', range: '1600+',       cls: 'bg-tier-grandmaster' },
            ].map((t) => (
              <div
                key={t.name}
                className="flex items-center gap-2 p-2 rounded-card bg-bg-elevated border border-border-subtle"
              >
                <span className={clsx('w-2 h-2 rounded-full shrink-0', t.cls)} />
                <div>
                  <span className="font-sans text-xs font-semibold text-text-primary">{t.name}</span>
                  <span className="font-sans text-[10px] text-text-ghost ml-1.5">{t.range}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <InnerCard className="space-y-1.5">
          <p className="font-sans text-xs font-semibold text-text-primary">Placement Matches</p>
          <p className="font-sans text-xs text-text-secondary leading-relaxed">
            Your first 5 rated games use a boosted K-factor (128 vs 32), so your rating adjusts
            quickly to your true skill level. After placement, changes are more gradual.
          </p>
        </InnerCard>

        <InnerCard className="space-y-1.5">
          <p className="font-sans text-xs font-semibold text-text-primary">Word Difficulty</p>
          <p className="font-sans text-xs text-text-secondary leading-relaxed">
            Each word has its own difficulty rating based on how hard it is to solve. Beating a
            hard word earns more ELO; losing to an easy one costs more. Word difficulty is
            calculated from letter frequencies, vowel count, and duplicate letters.
          </p>
        </InnerCard>
      </div>
    ),
  },

  {
    id: 'analysis',
    icon: <Brain size={18} />,
    title: 'Game Analysis',
    content: (
      <div className="space-y-4">
        <p className="font-sans text-sm text-text-secondary leading-relaxed">
          After every game, ELOquence runs a deep analysis of your play using information
          theory. Each guess is evaluated on how much it narrowed down the remaining
          possibilities.
        </p>

        <InnerCard className="space-y-3">
          <p className="font-sans text-[10px] text-text-ghost uppercase tracking-wider">Example Move Analysis</p>
          <div className="flex items-center gap-3">
            <TileRow word="SALET" pattern={['gray', 'yellow', 'gray', 'yellow', 'gray']} />
            <ClassBadge label="Best" color="#538d4e" />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-sans text-xs">
            <div className="flex justify-between">
              <span className="text-text-ghost">Entropy before</span>
              <span className="font-mono text-text-primary">11.15 bits</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-ghost">Entropy after</span>
              <span className="font-mono text-text-primary">5.72 bits</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-ghost">Info gained</span>
              <span className="font-mono" style={{ color: 'var(--tile-correct)' }}>5.43 bits</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-ghost">Remaining</span>
              <span className="font-mono text-text-primary">53 words</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between font-sans text-[10px]">
              <span className="text-text-ghost">Efficiency</span>
              <span className="text-text-secondary">5.43 / 5.58</span>
            </div>
            <EfficiencyBar pct={97} color="var(--tile-correct)" />
          </div>
        </InnerCard>

        <div className="space-y-2">
          <p className="font-sans text-xs font-semibold text-text-primary uppercase tracking-wider">Move Classifications</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'Brilliant',  color: '#1565c0' },
              { label: 'Best',       color: '#538d4e' },
              { label: 'Good',       color: '#6aaa64' },
              { label: 'Okay',       color: '#2e9688' },
              { label: 'Inaccuracy', color: '#b59f3b' },
              { label: 'Mistake',    color: '#e67e22' },
              { label: 'Blunder',    color: '#e74c3c' },
              { label: 'Miss',       color: '#9c27b0' },
              { label: 'Forced',     color: '#565758' },
            ].map((c) => (
              <ClassBadge key={c.label} label={c.label} color={c.color} />
            ))}
          </div>
        </div>

        <InnerCard className="space-y-2.5">
          <p className="font-sans text-xs font-semibold text-text-primary">How Classification Works</p>
          <p className="font-sans text-xs text-text-secondary leading-relaxed">
            Each guess is compared to the optimal guess (highest expected information gain).
            The ratio of your info gained vs the best possible determines the classification.
          </p>
          <div className="space-y-1">
            {[
              { label: 'Brilliant',  pct: '> 100%',   color: '#1565c0', w: 100 },
              { label: 'Best',       pct: '95 – 100%', color: '#538d4e', w: 97  },
              { label: 'Good',       pct: '85 – 95%',  color: '#6aaa64', w: 90  },
              { label: 'Okay',       pct: '70 – 85%',  color: '#2e9688', w: 78  },
              { label: 'Inaccuracy', pct: '50 – 70%',  color: '#b59f3b', w: 60  },
              { label: 'Mistake',    pct: '30 – 50%',  color: '#e67e22', w: 40  },
              { label: 'Blunder',    pct: '< 30%',     color: '#e74c3c', w: 20  },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-2">
                <span
                  className="font-sans text-[10px] w-16 text-right font-medium shrink-0"
                  style={{ color: c.color }}
                >
                  {c.label}
                </span>
                <div className="flex-1 h-2 rounded-pill bg-bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-pill"
                    style={{ width: `${c.w}%`, backgroundColor: c.color, opacity: 0.7 }}
                  />
                </div>
                <span className="font-mono text-[9px] text-text-ghost w-14">{c.pct}</span>
              </div>
            ))}
          </div>
          <p className="font-sans text-[10px] text-text-ghost leading-relaxed">
            &quot;Brilliant&quot; = better than the algorithm&apos;s top pick. &quot;Forced&quot; = only one valid guess remained.
          </p>
        </InnerCard>

        <InnerCard className="space-y-1.5">
          <p className="font-sans text-xs font-semibold text-text-primary">Key Metrics</p>
          <ul className="font-sans text-xs text-text-secondary space-y-1 leading-relaxed">
            <li>
              <span className="font-medium text-text-primary">Entropy</span> — How much uncertainty remains in the word pool (measured in bits).
            </li>
            <li>
              <span className="font-medium text-text-primary">Info Gained</span> — How many bits of information your guess revealed.
            </li>
            <li>
              <span className="font-medium text-text-primary">Efficiency</span> — Your info gained divided by the maximum possible info gain (as a percentage).
            </li>
            <li>
              <span className="font-medium text-text-primary">Remaining Words</span> — How many possible answers are left after your guess.
            </li>
          </ul>
        </InnerCard>
      </div>
    ),
  },

  {
    id: 'review',
    icon: <BarChart2 size={18} />,
    title: 'Review Page',
    content: (
      <div className="space-y-4">
        <p className="font-sans text-sm text-text-secondary leading-relaxed">
          The review page is your main post-game tool. It breaks down every move and shows
          exactly what happened at each step.
        </p>

        <InnerCard className="space-y-2">
          <p className="font-sans text-[10px] text-text-ghost uppercase tracking-wider">Example: Entropy Timeline</p>
          <div className="flex items-end gap-1.5" style={{ height: 64 }}>
            {[
              { label: '1', h: 100, bits: '11.2' },
              { label: '2', h: 52,  bits: '5.7'  },
              { label: '3', h: 22,  bits: '2.5'  },
              { label: '4', h: 0,   bits: '0.0'  },
            ].map((m) => (
              <div
                key={m.label}
                className="flex flex-col items-center flex-1"
                style={{ height: '100%' }}
              >
                <div className="w-full flex flex-col justify-end flex-1 min-h-0">
                  <div
                    className="w-full rounded-t"
                    style={{ height: `${Math.max(4, m.h)}%`, backgroundColor: 'color-mix(in srgb, var(--tile-correct) 60%, transparent)' }}
                  />
                </div>
                <span className="font-mono text-[9px] text-text-ghost mt-1">{m.bits}b</span>
                <span className="font-sans text-[9px] text-text-ghost">#{m.label}</span>
              </div>
            ))}
          </div>
          <p className="font-sans text-[10px] text-text-secondary">
            Each bar shows remaining entropy — shorter = closer to solving.
          </p>
        </InnerCard>

        <div className="space-y-2">
          <p className="font-sans text-xs font-semibold text-text-primary uppercase tracking-wider">Tabs</p>
          <div className="grid gap-2">
            {[
              {
                key: '1',
                name: 'Analysis',
                desc: 'Classification badge, entropy before/after, info gained, efficiency bar, and constraint violations for the selected move.',
              },
              {
                key: '2',
                name: 'Top Picks',
                desc: "The best guesses you could have made at that point, ranked by expected information gain.",
              },
              {
                key: '3',
                name: 'Timeline',
                desc: 'Visualizes how entropy decreased across all your moves. A steeper drop means a more effective guess.',
              },
              {
                key: '4',
                name: 'Patterns',
                desc: 'Histogram of all possible color patterns your guess could have produced, showing the probability distribution.',
              },
              {
                key: '5',
                name: 'Letters',
                desc: 'Heatmap showing the positional frequency of each letter among remaining possible words.',
              },
              {
                key: '6',
                name: 'Graph',
                desc: 'Interactive game-state tree showing all the decision branches and paths explored.',
              },
            ].map((tab) => (
              <div
                key={tab.key}
                className="flex gap-2.5 p-2.5 rounded-card bg-bg-elevated border border-border-subtle"
              >
                <span className="font-mono text-[10px] text-text-ghost bg-bg-muted w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                  {tab.key}
                </span>
                <div>
                  <p className="font-sans text-xs font-semibold text-text-primary">{tab.name}</p>
                  <p className="font-sans text-[11px] text-text-secondary leading-relaxed">{tab.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },

  {
    id: 'constraints',
    icon: <AlertTriangle size={18} />,
    title: 'Constraint Violations',
    content: (
      <div className="space-y-4">
        <p className="font-sans text-sm text-text-secondary leading-relaxed">
          The analysis engine checks whether each guess uses the information you already had.
          Violations are split into two types:
        </p>

        <div className="space-y-3">
          <div
            className="p-3 rounded-card space-y-2.5"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--red) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--red) 20%, transparent)',
            }}
          >
            <p className="font-sans text-xs font-semibold" style={{ color: 'var(--red)' }}>Hard Violation</p>
            <p className="font-sans text-xs text-text-secondary leading-relaxed">
              Using a letter that was already ruled out (gray), or placing a letter in a
              position already proven wrong (yellow in that spot before).
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <TileRow word="SALET" pattern={['gray', 'gray', 'gray', 'yellow', 'gray']} />
                <span className="font-sans text-[10px] text-text-ghost">S is gray (ruled out)</span>
              </div>
              <div className="flex items-center gap-2">
                <TileRow word="CRISP" pattern={['gray', 'gray', 'gray', 'gray', 'gray']} />
                <span className="font-sans text-[10px]" style={{ color: 'var(--red)' }}>Used S again — hard violation</span>
              </div>
            </div>
          </div>

          <InnerCard className="space-y-2.5">
            <p className="font-sans text-xs font-semibold text-text-secondary">Soft Violation</p>
            <p className="font-sans text-xs text-text-secondary leading-relaxed">
              Omitting a letter you know is in the word. Sometimes a valid strategy for
              maximizing information gain — shown as a neutral note, not a warning.
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <TileRow word="SALET" pattern={['gray', 'green', 'gray', 'yellow', 'gray']} />
                <span className="font-sans text-[10px] text-text-ghost">A is green, E is yellow</span>
              </div>
              <div className="flex items-center gap-2">
                <TileRow word="CRONY" pattern={['gray', 'gray', 'gray', 'gray', 'gray']} />
                <span className="font-sans text-[10px] text-text-secondary">No A or E — soft violation (info play)</span>
              </div>
            </div>
          </InnerCard>
        </div>
      </div>
    ),
  },

  {
    id: 'traps',
    icon: <Zap size={18} />,
    title: 'Endgame Traps',
    content: (
      <div className="space-y-4">
        <p className="font-sans text-sm text-text-secondary leading-relaxed">
          A trap occurs in the endgame when several remaining words share a common pattern
          (e.g., _IGHT: LIGHT, MIGHT, NIGHT, RIGHT, SIGHT, TIGHT) and only one letter position
          differs between them.
        </p>

        <InnerCard className="space-y-2.5">
          <p className="font-sans text-[10px] text-text-ghost uppercase tracking-wider">Example: _IGHT trap</p>
          <div className="flex flex-wrap gap-1.5">
            {['LIGHT', 'MIGHT', 'NIGHT', 'RIGHT', 'SIGHT', 'TIGHT'].map((w) => (
              <div key={w} className="flex gap-0.5">
                <Tile letter={w[0]} color={w === 'NIGHT' ? 'green' : 'empty'} size="sm" />
                {w.slice(1).split('').map((ch, i) => (
                  <Tile key={i} letter={ch} color="green" size="sm" />
                ))}
              </div>
            ))}
          </div>
          <p className="font-sans text-[10px] text-text-secondary leading-relaxed">
            Six words share <span className="font-mono text-text-primary">_IGHT</span> — only the first letter differs.
            Random guessing gives you a 1-in-6 chance each try.
          </p>
        </InnerCard>

        <InnerCard className="space-y-1.5">
          <p className="font-sans text-xs font-semibold text-text-primary">Why Traps Matter</p>
          <p className="font-sans text-xs text-text-secondary leading-relaxed">
            When trapped, random guessing gives you only a 1-in-N chance of finding the answer.
            A skilled player might use an &quot;escape word&quot; — a guess that tests multiple
            differing letters at once, even though it can&apos;t be the answer itself.
          </p>
        </InnerCard>

        <InnerCard className="space-y-1.5">
          <p className="font-sans text-xs font-semibold text-text-primary">Detection</p>
          <p className="font-sans text-xs text-text-secondary leading-relaxed">
            Traps are only detected when 20 or fewer words remain. The review page highlights traps
            so you can learn to recognize and navigate them.
          </p>
        </InnerCard>
      </div>
    ),
  },

  {
    id: 'coach',
    icon: <MessageSquare size={18} />,
    title: 'AI Coach',
    content: (
      <div className="space-y-4">
        <p className="font-sans text-sm text-text-secondary leading-relaxed">
          The Coach Chat is available on the review page (right side on desktop). It lets you
          ask questions about your game in natural language.
        </p>

        <div className="rounded-card bg-bg-elevated border border-border-subtle overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
            <MessageSquare size={11} style={{ color: 'var(--tile-correct)' }} />
            <span className="font-sans text-[10px] font-semibold text-text-primary">Coach Chat</span>
          </div>
          <div className="p-3 space-y-2">
            <div className="flex justify-end">
              <div
                className="font-sans text-xs text-text-primary px-3 py-1.5 rounded-card rounded-br-sm max-w-[85%]"
                style={{ backgroundColor: 'color-mix(in srgb, var(--tile-correct) 15%, transparent)' }}
              >
                Why was move 2 suboptimal?
              </div>
            </div>
            <div className="flex justify-start">
              <div className="font-sans text-xs text-text-primary px-3 py-1.5 bg-bg-muted rounded-card rounded-bl-sm max-w-[85%] leading-relaxed">
                Your second guess CRISP only gained 3.1 bits vs the optimal 4.8 bits. It reused the gray S and didn&apos;t test the yellow E from move 1.
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="font-sans text-xs font-semibold text-text-primary uppercase tracking-wider">Suggested Questions</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              'Why was move 2 suboptimal?',
              'What should I look for in endgame?',
              'How can I improve my opening?',
            ].map((q) => (
              <span
                key={q}
                className="font-sans text-xs px-2.5 py-1.5 rounded-card bg-bg-elevated border border-border-subtle text-text-secondary"
              >
                {q}
              </span>
            ))}
          </div>
        </div>

        <InnerCard className="space-y-1.5">
          <p className="font-sans text-xs font-semibold text-text-primary">Limits</p>
          <p className="font-sans text-xs text-text-secondary leading-relaxed">
            Each game session has a 10-message limit. The coach has full context of your game
            — all guesses, patterns, and analysis results — so it can give specific advice.
          </p>
        </InnerCard>
      </div>
    ),
  },

  {
    id: 'shortcuts',
    icon: <Keyboard size={18} />,
    title: 'Keyboard Shortcuts',
    content: (
      <div className="space-y-4">
        <p className="font-sans text-sm text-text-secondary leading-relaxed">
          The review page supports full keyboard navigation for quick analysis.
        </p>
        <div className="grid gap-1.5">
          {[
            { keys: '← ↑', action: 'Previous move' },
            { keys: '→ ↓', action: 'Next move' },
            { keys: '1 – 6', action: 'Switch to tab by number' },
          ].map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between p-2 rounded-card bg-bg-elevated border border-border-subtle"
            >
              <span className="font-mono text-xs text-text-primary bg-bg-muted px-2 py-0.5 rounded-md">
                {s.keys}
              </span>
              <span className="font-sans text-xs text-text-secondary">{s.action}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  {
    id: 'leaderboard',
    icon: <Trophy size={18} />,
    title: 'Leaderboard',
    content: (
      <div className="space-y-4">
        <p className="font-sans text-sm text-text-secondary leading-relaxed">
          The global leaderboard ranks all players by ELO rating. Your position updates after
          every rated game (Daily and Competitive modes).
        </p>

        <div className="rounded-card bg-bg-elevated border border-border-subtle overflow-hidden">
          <div className="grid grid-cols-[2rem_1fr_3.5rem_3rem_3rem] items-center gap-2 px-3 py-1.5 font-sans text-[10px] text-text-ghost uppercase tracking-wider border-b border-border-subtle">
            <span>#</span>
            <span>Player</span>
            <span>ELO</span>
            <span>Win%</span>
            <span>Avg</span>
          </div>
          {[
            { rank: 1, name: 'alice', elo: 1642, tierCls: 'bg-tier-grandmaster', win: 89, avg: 3.2 },
            { rank: 2, name: 'bob',   elo: 1531, tierCls: 'bg-tier-master',      win: 82, avg: 3.5 },
            { rank: 3, name: 'carol', elo: 1487, tierCls: 'bg-tier-master',      win: 78, avg: 3.7 },
          ].map((p) => (
            <div
              key={p.rank}
              className="grid grid-cols-[2rem_1fr_3.5rem_3rem_3rem] items-center gap-2 px-3 py-2 font-sans text-xs border-b border-border-subtle last:border-0"
            >
              <span className="font-mono text-text-ghost">{p.rank}</span>
              <div className="flex items-center gap-1.5">
                <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', p.tierCls)} />
                <span className="font-medium text-text-primary">{p.name}</span>
              </div>
              <span className="font-mono text-text-primary">{p.elo}</span>
              <span className="text-text-secondary">{p.win}%</span>
              <span className="text-text-secondary">{p.avg}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  {
    id: 'dashboard',
    icon: <Star size={18} />,
    title: 'Dashboard',
    content: (
      <div className="space-y-4">
        <p className="font-sans text-sm text-text-secondary leading-relaxed">
          Your personal dashboard shows your overall performance stats and game history.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <InnerCard className="space-y-2">
            <p className="font-sans text-[10px] text-text-ghost uppercase tracking-wider">ELO Sparkline</p>
            <MiniSparkline />
            <p className="font-sans text-[10px] text-text-ghost">Your rating trend over recent games</p>
          </InnerCard>

          <InnerCard className="space-y-2">
            <p className="font-sans text-[10px] text-text-ghost uppercase tracking-wider">Guess Distribution</p>
            <div className="space-y-1">
              {[
                { n: 1, pct: 2 },
                { n: 2, pct: 8 },
                { n: 3, pct: 28 },
                { n: 4, pct: 42 },
                { n: 5, pct: 15 },
                { n: 6, pct: 5 },
              ].map((g) => (
                <div key={g.n} className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-text-ghost w-3">{g.n}</span>
                  <div className="flex-1 h-2 rounded-pill bg-bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-pill"
                      style={{ width: `${Math.max(3, g.pct)}%`, backgroundColor: 'var(--tile-correct)' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </InnerCard>
        </div>

        <ul className="font-sans text-xs text-text-secondary space-y-1.5 leading-relaxed">
          <li>
            <span className="font-medium text-text-primary">Win Rate &amp; Streak</span> — Your
            overall win percentage and current/best winning streaks.
          </li>
          <li>
            <span className="font-medium text-text-primary">Game History</span> — All your past
            games with status, mode, guesses, and a link to the full review.
          </li>
        </ul>
      </div>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Mobile accordion item                                              */
/* ------------------------------------------------------------------ */

function AccordionItem({
  section,
  isOpen,
  isLocked,
  onToggle,
}: {
  section: Section;
  isOpen: boolean;
  isLocked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={clsx(
        'rounded-card bg-bg-base border overflow-hidden transition-colors',
        isOpen ? 'border-border-default' : 'border-border-subtle',
        isLocked && 'opacity-50',
      )}
    >
      <button
        onClick={onToggle}
        disabled={isLocked}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        aria-expanded={isOpen}
      >
        <span
          className={clsx('shrink-0', isOpen ? 'text-tile-correct' : 'text-text-ghost')}
          style={isOpen ? { color: 'var(--tile-correct)' } : undefined}
        >
          {isLocked ? <Lock size={14} /> : section.icon}
        </span>
        <span
          className={clsx(
            'flex-1 font-sans text-sm font-medium',
            isOpen ? 'text-text-primary' : 'text-text-secondary',
          )}
        >
          {section.title}
        </span>
        {isLocked ? (
          <span className="font-sans text-[10px] text-text-ghost px-1.5 py-0.5 rounded-md bg-bg-muted border border-border-subtle">
            Sign in
          </span>
        ) : (
          <ChevronDown
            size={15}
            className={clsx(
              'text-text-ghost transition-transform duration-200',
              isOpen && 'rotate-180',
            )}
          />
        )}
      </button>

      <AnimatePresence initial={false}>
        {isOpen && !isLocked && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-border-subtle">
              {section.content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                      */
/* ------------------------------------------------------------------ */

export default function LearnPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const GUEST_UNLOCKED_IDS = ['modes', 'tiles'];
  const allSections = SECTIONS.filter((s) => s.id !== 'shortcuts');

  const [activeSection, setActiveSection] = useState(allSections[0].id);
  const [openAccordion, setOpenAccordion] = useState<string | null>(allSections[0].id);

  const current = allSections.find((s) => s.id === activeSection) ?? allSections[0];

  const isLocked = (id: string) => !user && !GUEST_UNLOCKED_IDS.includes(id);

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-bg-base">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.slide}
          className="mb-6"
        >
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={20} style={{ color: 'var(--tile-correct)' }} />
            <h1 className="font-display font-black text-4xl text-text-primary">Learn</h1>
          </div>
          <p className="font-sans text-sm text-text-secondary">
            Everything you need to know about ELOquence.
          </p>
          {!loading && !user && (
            <div
              className="mt-3 flex items-center gap-2.5 px-3 py-2 rounded-card border"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--tile-correct) 8%, transparent)',
                borderColor: 'color-mix(in srgb, var(--tile-correct) 20%, transparent)',
              }}
            >
              <Lock size={12} style={{ color: 'var(--tile-correct)' }} className="shrink-0" />
              <span className="font-sans text-xs text-text-secondary">
                Some sections require an account.{' '}
                <button
                  onClick={() => router.push('/login')}
                  className="font-medium hover:underline"
                  style={{ color: 'var(--tile-correct)' }}
                >
                  Sign in
                </button>{' '}
                to unlock everything.
              </span>
            </div>
          )}
        </motion.div>

        {/* Desktop two-column layout */}
        <div className="hidden md:flex gap-6">
          {/* Sidebar nav */}
          <motion.nav
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...springs.slide, delay: 0.05 }}
            className="flex flex-col gap-0.5 w-52 shrink-0 sticky top-20 self-start"
          >
            {allSections.map((s) => {
              const locked = isLocked(s.id);
              const isActive = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => !locked && setActiveSection(s.id)}
                  disabled={locked}
                  className={clsx(
                    'flex items-center gap-2.5 px-3 py-2 rounded-card text-left font-sans text-sm transition-colors',
                    locked
                      ? 'opacity-40 cursor-default'
                      : isActive
                        ? 'bg-bg-muted text-text-primary font-medium'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated',
                  )}
                >
                  <span
                    className={clsx('shrink-0', !locked && isActive ? '' : 'text-text-ghost')}
                    style={!locked && isActive ? { color: 'var(--tile-correct)' } : undefined}
                  >
                    {locked ? <Lock size={14} /> : s.icon}
                  </span>
                  {s.title}
                </button>
              );
            })}
          </motion.nav>

          {/* Content panel */}
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 min-w-0"
          >
            <div className="rounded-card-lg bg-bg-elevated border border-border-default p-5">
              <div className="flex items-center gap-2 mb-5">
                <span
                  className="p-2 rounded-card border"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--tile-correct) 10%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--tile-correct) 15%, transparent)',
                    color: 'var(--tile-correct)',
                  }}
                >
                  {current.icon}
                </span>
                <h2 className="font-display font-bold text-2xl text-text-primary">{current.title}</h2>
              </div>
              {current.content}
            </div>
          </motion.div>
        </div>

        {/* Mobile accordion layout */}
        <div className="md:hidden flex flex-col gap-2">
          {allSections.map((s) => {
            const locked = isLocked(s.id);
            return (
              <AccordionItem
                key={s.id}
                section={s}
                isOpen={openAccordion === s.id}
                isLocked={locked}
                onToggle={() => {
                  if (locked) return;
                  setOpenAccordion(openAccordion === s.id ? null : s.id);
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
