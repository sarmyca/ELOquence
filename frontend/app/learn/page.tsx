'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { springs } from '@/lib/animations';
import clsx from 'clsx';

/* ------------------------------------------------------------------ */
/*  Section data                                                       */
/* ------------------------------------------------------------------ */

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

function Tile({ letter, color, size = 'md' }: { letter: string; color: 'green' | 'yellow' | 'gray' | 'empty'; size?: 'sm' | 'md' }) {
  const bg =
    color === 'green'
      ? 'bg-[#538d4e]'
      : color === 'yellow'
        ? 'bg-[#b59f3b]'
        : color === 'empty'
          ? 'bg-bg-tertiary border border-white/[0.15]'
          : 'bg-[#3a3a3c]';
  const s = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm';
  return (
    <span className={clsx('inline-flex items-center justify-center rounded font-bold text-white', s, bg)}>
      {letter}
    </span>
  );
}

function TileRow({ word, pattern }: { word: string; pattern: ('green' | 'yellow' | 'gray')[] }) {
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
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {label}
    </span>
  );
}

function EfficiencyBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-bg-tertiary overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-mono text-text-ghost w-8 text-right">{pct}%</span>
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
      <polyline points={coords.join(' ')} fill="none" stroke="#538d4e" strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={w} cy={parseFloat(coords[coords.length - 1].split(',')[1])} r={2.5} fill="#538d4e" />
    </svg>
  );
}

const SECTIONS: Section[] = [
  /* ---- Game Modes ---- */
  {
    id: 'modes',
    icon: <Gamepad2 size={18} />,
    title: 'Game Modes',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          ELOquence offers three ways to play, each with a different purpose.
        </p>

        <div className="grid gap-3">
          {[
            {
              emoji: '☀',
              name: 'Daily',
              desc: 'One puzzle per day, same word for all players. Your result affects your ELO rating. Come back every day to keep your streak alive.',
            },
            {
              emoji: '⚔',
              name: 'Competitive',
              desc: 'Unlimited rated games drawn from the extended word pool (~5,500 words). Each game changes your ELO. Great for climbing the leaderboard.',
            },
            {
              emoji: '⚗',
              name: 'Practice',
              desc: 'Unlimited unrated games from the standard word pool (2,309 words). No ELO impact — experiment freely with new strategies.',
            },
          ].map((m) => (
            <div
              key={m.name}
              className="flex gap-3 p-3 rounded-xl bg-bg-tertiary border border-white/[0.06]"
            >
              <span className="text-xl mt-0.5">{m.emoji}</span>
              <div>
                <p className="text-sm font-semibold text-text-primary">{m.name}</p>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  /* ---- ELO Rating System ---- */
  {
    id: 'elo',
    icon: <TrendingUp size={18} />,
    title: 'ELO Rating System',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          Your ELO rating measures your skill. It goes up when you win and down when you lose,
          with the magnitude depending on the word&apos;s difficulty relative to your rating.
        </p>

        {/* Visual: ELO change example */}
        <div className="p-3 rounded-xl bg-bg-tertiary border border-white/[0.06]">
          <p className="text-[10px] text-text-ghost uppercase tracking-wider mb-2">Example: Win vs hard word</p>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-lg font-bold text-text-primary font-mono">1057</p>
              <p className="text-[10px] text-text-ghost">Before</p>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs font-bold text-[#538d4e]">+43</span>
              <div className="w-12 h-px bg-white/[0.12]" />
              <span className="text-[9px] text-text-ghost">Word: 1420</span>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-[#538d4e] font-mono">1100</p>
              <p className="text-[10px] text-text-ghost">After</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-primary uppercase tracking-wider">
            Rating Tiers
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: 'Novice', range: '0 – 1199', color: '#9ca3af' },
              { name: 'Veteran', range: '1200 – 1399', color: '#3b82f6' },
              { name: 'Master', range: '1400 – 1599', color: '#a855f7' },
              { name: 'Grandmaster', range: '1600+', color: '#f59e0b' },
            ].map((t) => (
              <div
                key={t.name}
                className="flex items-center gap-2 p-2 rounded-lg bg-bg-tertiary border border-white/[0.06]"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                <div>
                  <span className="text-xs font-semibold text-text-primary">{t.name}</span>
                  <span className="text-[10px] text-text-ghost ml-1.5">{t.range}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-bg-tertiary border border-white/[0.06] space-y-1.5">
          <p className="text-xs font-semibold text-text-primary">Placement Matches</p>
          <p className="text-xs text-text-secondary leading-relaxed">
            Your first 5 rated games use a boosted K-factor (128 vs 32), so your rating adjusts
            quickly to your true skill level. After placement, changes are more gradual.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-bg-tertiary border border-white/[0.06] space-y-1.5">
          <p className="text-xs font-semibold text-text-primary">Word Difficulty</p>
          <p className="text-xs text-text-secondary leading-relaxed">
            Each word has its own difficulty rating based on how hard it is to solve. Beating a
            hard word earns more ELO; losing to an easy one costs more. Word difficulty is
            calculated from letter frequencies, vowel count, and duplicate letters.
          </p>
        </div>
      </div>
    ),
  },

  /* ---- How Tiles Work ---- */
  {
    id: 'tiles',
    icon: <Target size={18} />,
    title: 'How Tiles Work',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          After each guess, every letter is colored to show how close you are to the answer.
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Tile letter="A" color="green" />
            <div>
              <p className="text-sm font-semibold text-text-primary">Green</p>
              <p className="text-xs text-text-secondary">
                Correct letter in the correct position.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Tile letter="B" color="yellow" />
            <div>
              <p className="text-sm font-semibold text-text-primary">Yellow</p>
              <p className="text-xs text-text-secondary">
                Correct letter, but in the wrong position.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Tile letter="C" color="gray" />
            <div>
              <p className="text-sm font-semibold text-text-primary">Gray</p>
              <p className="text-xs text-text-secondary">Letter is not in the word at all.</p>
            </div>
          </div>
        </div>

        {/* Visual example: mini game */}
        <div className="p-3 rounded-xl bg-bg-tertiary border border-white/[0.06] space-y-2">
          <p className="text-xs font-semibold text-text-primary">Example — answer is CRANE</p>
          <div className="flex flex-col gap-1.5 items-start">
            <div className="flex items-center gap-3">
              <TileRow word="SALET" pattern={['gray', 'yellow', 'gray', 'yellow', 'gray']} />
              <span className="text-[10px] text-text-ghost">A and E are in the word, wrong spots</span>
            </div>
            <div className="flex items-center gap-3">
              <TileRow word="RANCH" pattern={['yellow', 'yellow', 'yellow', 'green', 'gray']} />
              <span className="text-[10px] text-text-ghost">R, A, N found — C is locked in</span>
            </div>
            <div className="flex items-center gap-3">
              <TileRow word="CRANE" pattern={['green', 'green', 'green', 'green', 'green']} />
              <span className="text-[10px] text-text-ghost">Solved in 3!</span>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-bg-tertiary border border-white/[0.06]">
          <p className="text-xs text-text-secondary leading-relaxed">
            <span className="font-semibold text-text-primary">Tip:</span> Pay attention to
            yellows — they tell you which letters to reuse in a different spot. Ignoring them
            is flagged as a constraint violation in analysis.
          </p>
        </div>
      </div>
    ),
  },

  /* ---- Game Analysis ---- */
  {
    id: 'analysis',
    icon: <Brain size={18} />,
    title: 'Game Analysis',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          After every game, ELOquence runs a deep analysis of your play using information
          theory. Each guess is evaluated on how much it narrowed down the remaining
          possibilities.
        </p>

        {/* Visual: mock move analysis card */}
        <div className="p-3 rounded-xl bg-bg-tertiary border border-white/[0.06] space-y-3">
          <p className="text-[10px] text-text-ghost uppercase tracking-wider">Example Move Analysis</p>
          <div className="flex items-center gap-3">
            <TileRow word="SALET" pattern={['gray', 'yellow', 'gray', 'yellow', 'gray']} />
            <ClassBadge label="Best" color="#538d4e" />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
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
              <span className="font-mono text-[#538d4e]">5.43 bits</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-ghost">Remaining</span>
              <span className="font-mono text-text-primary">53 words</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-text-ghost">Efficiency</span>
              <span className="text-text-secondary">5.43 / 5.58</span>
            </div>
            <EfficiencyBar pct={97} color="#538d4e" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-primary uppercase tracking-wider">
            Move Classifications
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'Brilliant', color: '#00b4d8' },
              { label: 'Best', color: '#538d4e' },
              { label: 'Good', color: '#6aaa64' },
              { label: 'Okay', color: '#8fbc8f' },
              { label: 'Inaccuracy', color: '#b59f3b' },
              { label: 'Mistake', color: '#e67e22' },
              { label: 'Blunder', color: '#e74c3c' },
              { label: 'Miss', color: '#c0392b' },
              { label: 'Forced', color: '#9ca3af' },
            ].map((c) => (
              <ClassBadge key={c.label} label={c.label} color={c.color} />
            ))}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-bg-tertiary border border-white/[0.06] space-y-2.5">
          <p className="text-xs font-semibold text-text-primary">How Classification Works</p>
          <p className="text-xs text-text-secondary leading-relaxed">
            Each guess is compared to the optimal guess (highest expected information gain).
            The ratio of your info gained vs the best possible determines the classification.
          </p>
          {/* Visual: classification scale */}
          <div className="space-y-1">
            {[
              { label: 'Brilliant', pct: '> 100%', color: '#00b4d8', w: 100 },
              { label: 'Best', pct: '95 – 100%', color: '#538d4e', w: 97 },
              { label: 'Good', pct: '85 – 95%', color: '#6aaa64', w: 90 },
              { label: 'Okay', pct: '70 – 85%', color: '#8fbc8f', w: 78 },
              { label: 'Inaccuracy', pct: '50 – 70%', color: '#b59f3b', w: 60 },
              { label: 'Mistake', pct: '30 – 50%', color: '#e67e22', w: 40 },
              { label: 'Blunder', pct: '< 30%', color: '#e74c3c', w: 20 },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-2">
                <span className="text-[10px] w-16 text-right font-medium shrink-0" style={{ color: c.color }}>{c.label}</span>
                <div className="flex-1 h-2 rounded-full bg-bg-elevated overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${c.w}%`, backgroundColor: c.color, opacity: 0.7 }} />
                </div>
                <span className="text-[9px] text-text-ghost w-14 font-mono">{c.pct}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-text-ghost leading-relaxed">
            &quot;Brilliant&quot; = better than the algorithm&apos;s top pick. &quot;Forced&quot; = only one valid guess remained (shown as gray).
          </p>
        </div>

        <div className="p-3 rounded-xl bg-bg-tertiary border border-white/[0.06] space-y-1.5">
          <p className="text-xs font-semibold text-text-primary">Key Metrics</p>
          <ul className="text-xs text-text-secondary space-y-1 leading-relaxed">
            <li>
              <span className="font-medium text-text-primary">Entropy</span> — How much
              uncertainty remains in the word pool (measured in bits).
            </li>
            <li>
              <span className="font-medium text-text-primary">Info Gained</span> — How many
              bits of information your guess revealed.
            </li>
            <li>
              <span className="font-medium text-text-primary">Efficiency</span> — Your info
              gained ÷ the maximum possible info gain (as a percentage).
            </li>
            <li>
              <span className="font-medium text-text-primary">Remaining Words</span> — How
              many possible answers are left after your guess.
            </li>
          </ul>
        </div>
      </div>
    ),
  },

  /* ---- Review Page ---- */
  {
    id: 'review',
    icon: <BarChart2 size={18} />,
    title: 'Review Page',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          The review page is your main post-game tool. It breaks down every move and shows
          exactly what happened at each step.
        </p>

        {/* Visual: mini entropy timeline */}
        <div className="p-3 rounded-xl bg-bg-tertiary border border-white/[0.06] space-y-2">
          <p className="text-[10px] text-text-ghost uppercase tracking-wider">Example: Entropy Timeline</p>
          <div className="flex items-end gap-1.5" style={{ height: 64 }}>
            {[
              { label: '1', h: 100, bits: '11.2' },
              { label: '2', h: 52, bits: '5.7' },
              { label: '3', h: 22, bits: '2.5' },
              { label: '4', h: 0, bits: '0.0' },
            ].map((m) => (
              <div key={m.label} className="flex flex-col items-center flex-1" style={{ height: '100%' }}>
                <div className="w-full flex flex-col justify-end flex-1 min-h-0">
                  <div
                    className="w-full rounded-t bg-[#538d4e]/60"
                    style={{ height: `${Math.max(4, m.h)}%` }}
                  />
                </div>
                <span className="text-[9px] font-mono text-text-ghost mt-1">{m.bits}b</span>
                <span className="text-[9px] text-text-ghost">#{m.label}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-text-secondary">Each bar shows remaining entropy — shorter = closer to solving.</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-primary uppercase tracking-wider">
            Tabs
          </p>
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
                desc: "The best guesses you could have made at that point, ranked by expected information gain. Shows what the algorithm's top choice was.",
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
                className="flex gap-2.5 p-2.5 rounded-lg bg-bg-tertiary border border-white/[0.06]"
              >
                <span className="text-[10px] font-mono text-text-ghost bg-bg-elevated w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5">
                  {tab.key}
                </span>
                <div>
                  <p className="text-xs font-semibold text-text-primary">{tab.name}</p>
                  <p className="text-[11px] text-text-secondary leading-relaxed">{tab.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },

  /* ---- Constraint Violations ---- */
  {
    id: 'constraints',
    icon: <AlertTriangle size={18} />,
    title: 'Constraint Violations',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          The analysis engine checks whether each guess uses the information you already had.
          Violations are split into two types:
        </p>

        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-[#e74c3c]/10 border border-[#e74c3c]/20 space-y-2.5">
            <p className="text-xs font-semibold text-[#e74c3c]">Hard Violation</p>
            <p className="text-xs text-text-secondary leading-relaxed">
              Using a letter that was already ruled out (gray), or placing a letter in a
              position already proven wrong (yellow in that spot before).
            </p>
            {/* Visual: hard violation example */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <TileRow word="SALET" pattern={['gray', 'gray', 'gray', 'yellow', 'gray']} />
                <span className="text-[10px] text-text-ghost">S is gray (ruled out)</span>
              </div>
              <div className="flex items-center gap-2">
                <TileRow word="CRISP" pattern={['gray', 'gray', 'gray', 'gray', 'gray']} />
                <span className="text-[10px] text-[#e74c3c]">Used S again — hard violation</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2.5">
            <p className="text-xs font-semibold text-text-secondary">Soft Violation</p>
            <p className="text-xs text-text-secondary leading-relaxed">
              Omitting a letter you know is in the word. Sometimes a valid strategy for
              maximizing information gain — shown as a neutral note, not a warning.
            </p>
            {/* Visual: soft violation example */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <TileRow word="SALET" pattern={['gray', 'green', 'gray', 'yellow', 'gray']} />
                <span className="text-[10px] text-text-ghost">A is green, E is yellow</span>
              </div>
              <div className="flex items-center gap-2">
                <TileRow word="CRONY" pattern={['gray', 'gray', 'gray', 'gray', 'gray']} />
                <span className="text-[10px] text-text-secondary">No A or E — soft violation (info play)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },

  /* ---- Traps ---- */
  {
    id: 'traps',
    icon: <Zap size={18} />,
    title: 'Endgame Traps',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          A trap occurs in the endgame when several remaining words share a common pattern
          (e.g., _IGHT: LIGHT, MIGHT, NIGHT, RIGHT, SIGHT, TIGHT) and only one letter position
          differs between them.
        </p>

        {/* Visual: trap word grid */}
        <div className="p-3 rounded-xl bg-bg-tertiary border border-white/[0.06] space-y-2.5">
          <p className="text-[10px] text-text-ghost uppercase tracking-wider">Example: _IGHT trap</p>
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
          <p className="text-[10px] text-text-secondary leading-relaxed">
            Six words share <span className="font-mono text-text-primary">_IGHT</span> — only the first letter differs.
            Random guessing gives you a 1-in-6 chance each try.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-bg-tertiary border border-white/[0.06] space-y-1.5">
          <p className="text-xs font-semibold text-text-primary">Why Traps Matter</p>
          <p className="text-xs text-text-secondary leading-relaxed">
            When trapped, random guessing gives you only a 1-in-N chance of finding the answer.
            A skilled player might use an &quot;escape word&quot; — a guess that tests multiple
            differing letters at once, even though it can&apos;t be the answer itself.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-bg-tertiary border border-white/[0.06] space-y-1.5">
          <p className="text-xs font-semibold text-text-primary">Detection</p>
          <p className="text-xs text-text-secondary leading-relaxed">
            Traps are only detected when 20 or fewer words remain — on earlier moves, the word
            pool is too large for meaningful trap patterns. The review page highlights traps
            so you can learn to recognize and navigate them.
          </p>
        </div>
      </div>
    ),
  },

  /* ---- Coach Chat ---- */
  {
    id: 'coach',
    icon: <MessageSquare size={18} />,
    title: 'AI Coach',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          The Coach Chat is available on the review page (right side on desktop). It lets you
          ask questions about your game in natural language.
        </p>

        {/* Visual: mock chat conversation */}
        <div className="rounded-xl bg-bg-tertiary border border-white/[0.06] overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
            <MessageSquare size={11} className="text-[#6aaa64]" />
            <span className="text-[10px] font-semibold text-text-primary">Coach Chat</span>
          </div>
          <div className="p-3 space-y-2">
            <div className="flex justify-end">
              <div className="text-xs text-text-primary px-3 py-1.5 bg-[#538d4e]/15 rounded-xl rounded-br-sm max-w-[85%]">
                Why was move 2 suboptimal?
              </div>
            </div>
            <div className="flex justify-start">
              <div className="text-xs text-text-primary px-3 py-1.5 bg-bg-elevated rounded-xl rounded-bl-sm max-w-[85%] leading-relaxed">
                Your second guess CRISP only gained 3.1 bits vs the optimal 4.8 bits. It reused the gray S and didn&apos;t test the yellow E from move 1.
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-primary uppercase tracking-wider">
            Suggested Questions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              'Why was move 2 suboptimal?',
              'What should I look for in endgame?',
              'How can I improve my opening?',
            ].map((q) => (
              <span
                key={q}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-bg-tertiary border border-white/[0.06] text-text-secondary"
              >
                {q}
              </span>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-bg-tertiary border border-white/[0.06] space-y-1.5">
          <p className="text-xs font-semibold text-text-primary">Limits</p>
          <p className="text-xs text-text-secondary leading-relaxed">
            Each game session has a 10-message limit. The coach has full context of your game
            — all guesses, patterns, and analysis results — so it can give specific advice.
          </p>
        </div>
      </div>
    ),
  },

  /* ---- Keyboard Shortcuts ---- */
  {
    id: 'shortcuts',
    icon: <Keyboard size={18} />,
    title: 'Keyboard Shortcuts',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary leading-relaxed">
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
              className="flex items-center justify-between p-2 rounded-lg bg-bg-tertiary border border-white/[0.06]"
            >
              <span className="text-xs font-mono text-text-primary bg-bg-elevated px-2 py-0.5 rounded">
                {s.keys}
              </span>
              <span className="text-xs text-text-secondary">{s.action}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  /* ---- Leaderboard ---- */
  {
    id: 'leaderboard',
    icon: <Trophy size={18} />,
    title: 'Leaderboard',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          The global leaderboard ranks all players by ELO rating. Your position updates after
          every rated game (Daily and Competitive modes).
        </p>

        {/* Visual: mock leaderboard rows */}
        <div className="rounded-xl bg-bg-tertiary border border-white/[0.06] overflow-hidden">
          <div className="grid grid-cols-[2rem_1fr_3.5rem_3rem_3rem] items-center gap-2 px-3 py-1.5 text-[10px] text-text-ghost uppercase tracking-wider border-b border-white/[0.04]">
            <span>#</span><span>Player</span><span>ELO</span><span>Win%</span><span>Avg</span>
          </div>
          {[
            { rank: 1, name: 'alice', elo: 1642, tier: '#f59e0b', win: 89, avg: 3.2 },
            { rank: 2, name: 'bob', elo: 1531, tier: '#a855f7', win: 82, avg: 3.5 },
            { rank: 3, name: 'carol', elo: 1487, tier: '#a855f7', win: 78, avg: 3.7 },
          ].map((p) => (
            <div
              key={p.rank}
              className="grid grid-cols-[2rem_1fr_3.5rem_3rem_3rem] items-center gap-2 px-3 py-2 text-xs border-b border-white/[0.03] last:border-0"
            >
              <span className="font-mono text-text-ghost">{p.rank}</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.tier }} />
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

  /* ---- Dashboard ---- */
  {
    id: 'dashboard',
    icon: <Star size={18} />,
    title: 'Dashboard',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          Your personal dashboard shows your overall performance stats and game history.
        </p>

        {/* Visual: mini sparkline + guess distribution */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-bg-tertiary border border-white/[0.06] space-y-2">
            <p className="text-[10px] text-text-ghost uppercase tracking-wider">ELO Sparkline</p>
            <MiniSparkline />
            <p className="text-[10px] text-text-ghost">Your rating trend over recent games</p>
          </div>

          <div className="p-3 rounded-xl bg-bg-tertiary border border-white/[0.06] space-y-2">
            <p className="text-[10px] text-text-ghost uppercase tracking-wider">Guess Distribution</p>
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
                  <span className="text-[10px] font-mono text-text-ghost w-3">{g.n}</span>
                  <div className="flex-1 h-2 rounded-full bg-bg-elevated overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#538d4e]"
                      style={{ width: `${Math.max(3, g.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <ul className="text-xs text-text-secondary space-y-1.5 leading-relaxed">
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
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function LearnPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);

  if (!loading && !user) {
    router.push('/');
    return null;
  }

  const current = SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0];

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-bg-primary">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.slide}
          className="mb-6"
        >
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={20} className="text-[#6aaa64]" />
            <h1 className="text-xl font-bold text-text-primary">Learn</h1>
          </div>
          <p className="text-sm text-text-secondary">
            Everything you need to know about ELOquence.
          </p>
        </motion.div>

        {/* Two-column layout */}
        <div className="flex gap-6">
          {/* Sidebar nav */}
          <motion.nav
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...springs.slide, delay: 0.05 }}
            className="hidden md:flex flex-col gap-0.5 w-52 shrink-0 sticky top-20 self-start"
          >
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors',
                  activeSection === s.id
                    ? 'bg-bg-tertiary text-text-primary font-medium'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50',
                )}
              >
                <span
                  className={clsx(
                    'shrink-0',
                    activeSection === s.id ? 'text-[#6aaa64]' : 'text-text-ghost',
                  )}
                >
                  {s.icon}
                </span>
                {s.title}
              </button>
            ))}
          </motion.nav>

          {/* Mobile section picker */}
          <div className="md:hidden w-full mb-4">
            <select
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-bg-secondary border border-white/[0.08] text-sm text-text-primary"
            >
              {SECTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>

          {/* Content area */}
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 min-w-0"
          >
            <div className="rounded-2xl bg-bg-secondary border border-white/[0.08] p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[#6aaa64]">{current.icon}</span>
                <h2 className="text-lg font-semibold text-text-primary">{current.title}</h2>
              </div>
              {current.content}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
