'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  BarChart2,
  Brain,
  Zap,
  Target,
  Trophy,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  Star,
  Lock,
  Search,
  ChevronDown,
  Sun,
  Swords,
  FlaskConical,
  FileText,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { springs } from '@/lib/animations';
import clsx from 'clsx';

/* ------------------------------------------------------------------ */
/*  Shared primitives (carried over)                                    */
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
  pattern: ('green' | 'yellow' | 'gray' | 'empty')[];
}) {
  return (
    <div className="flex gap-1">
      {word.split('').map((ch, i) => (
        <Tile key={i} letter={ch} color={pattern[i] as 'green' | 'yellow' | 'gray' | 'empty'} size="sm" />
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

function InnerCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('p-3 rounded-card bg-bg-elevated border border-border-subtle', className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface FAQItem {
  q: string;
  a: React.ReactNode;
  plain: string;
}

interface SectionDef {
  slug: string;
  title: string;
  icon: React.ReactNode;
  partLabel: string;
  intro?: string;
  items: FAQItem[];
  guestUnlocked: boolean;
}

/* ------------------------------------------------------------------ */
/*  Section data                                                        */
/* ------------------------------------------------------------------ */

const SECTIONS: SectionDef[] = [
  /* ============================== 1. THE BASICS ============================== */
  {
    slug: 'basics',
    title: 'The Basics',
    icon: <BookOpen size={16} />,
    partLabel: 'PART 01',
    intro: 'New to ELOquence? Start here.',
    guestUnlocked: true,
    items: [
      {
        q: 'What is ELOquence?',
        plain:
          'ELOquence is a Wordle analyzer that reviews every guess you make, scores your skill and luck separately, and tracks your improvement over time with an ELO rating. Think of it as a chess engine but for Wordle — it tells you what the optimal play was, how close you came, and why.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              ELOquence is a Wordle analyzer that reviews every guess you make, scores your skill
              and luck separately, and tracks your improvement over time with an ELO rating. Think
              of it as a chess engine but for Wordle — it tells you what the optimal play was, how
              close you came, and why.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Nope, ELOquence doesn&apos;t pick the daily word — it analyzes whatever you played.
              The word comes from the same place it always has. We just have opinions about how you
              handled it.
            </p>
          </div>
        ),
      },
      {
        q: 'How do I play?',
        plain:
          'Same as regular Wordle: guess a five-letter word, get green/yellow/gray feedback, and try to solve in six guesses. After you finish, ELOquence breaks down every move. Green means the right letter in the right spot. Yellow means the letter is in the word but in a different position. Gray means the letter is not in the word at all.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Same as regular Wordle: guess a five-letter word, get green/yellow/gray feedback, and
              try to solve in six guesses. After you finish, ELOquence breaks down every move.
            </p>
            <InnerCard className="space-y-2">
              <p className="font-sans text-[10px] text-text-ghost uppercase tracking-wider">
                What the colors mean
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Tile letter="C" color="green" size="sm" />
                  <span className="font-sans text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">Green</span> — right letter,
                    right position.
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Tile letter="R" color="yellow" size="sm" />
                  <span className="font-sans text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">Yellow</span> — right letter,
                    wrong position.
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Tile letter="A" color="gray" size="sm" />
                  <span className="font-sans text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">Gray</span> — letter not in
                    the word.
                  </span>
                </div>
              </div>
            </InnerCard>
          </div>
        ),
      },
      {
        q: 'What modes can I play?',
        plain:
          'Three modes: Daily is one puzzle per day, same word for everyone — unrated, just for fun and streaks. Competitive is unlimited rated games from an extended word pool, and it is the only mode that moves your ELO. Practice is unlimited unrated games from the standard pool — experiment freely.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Three modes, three different purposes.
            </p>
            <div className="grid gap-3">
              {[
                {
                  icon: <Sun size={15} style={{ color: 'var(--tile-present)' }} className="shrink-0 mt-0.5" />,
                  name: 'Daily',
                  desc: 'One puzzle per day, shared by all players. Unrated — daily results do not change your ELO; they only feed your streak and stats. Miss a day and your streak resets, so come back tomorrow.',
                },
                {
                  icon: <Swords size={15} style={{ color: 'var(--tile-absent)' }} className="shrink-0 mt-0.5" />,
                  name: 'Competitive',
                  desc: 'Unlimited rated games drawn from the ~5,500-word competitive pool. Each game adjusts your ELO. Great for climbing the tiers quickly.',
                },
                {
                  icon: <FlaskConical size={15} className="shrink-0 mt-0.5 text-text-secondary" />,
                  name: 'Practice',
                  desc: 'Unlimited unrated games from the standard 2,309-word list. Zero ELO risk — the place to try weird openers or practice endgame escapes.',
                },
              ].map((m) => (
                <InnerCard key={m.name} className="flex gap-3">
                  {m.icon}
                  <div>
                    <p className="font-sans text-xs font-semibold text-text-primary">{m.name}</p>
                    <p className="font-sans text-xs text-text-secondary mt-0.5 leading-relaxed">
                      {m.desc}
                    </p>
                  </div>
                </InnerCard>
              ))}
            </div>
          </div>
        ),
      },
      {
        q: 'What do the colored tiles mean?',
        plain:
          'Green means the letter is correct and in the right position. Yellow means the letter is in the word but placed incorrectly. Gray means the letter does not appear in the word at all. Pay close attention to yellows — they are the most commonly wasted clues.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Wordle&apos;s color system is a binary signal at each position. Here&apos;s a worked
              example where the answer is CRANE:
            </p>
            <InnerCard className="space-y-2.5">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <TileRow word="SALET" pattern={['gray', 'yellow', 'gray', 'yellow', 'gray']} />
                  <span className="font-sans text-[10px] text-text-ghost">
                    A and E are in CRANE, wrong spots
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <TileRow word="CRANE" pattern={['green', 'green', 'green', 'green', 'green']} />
                  <span className="font-sans text-[10px] text-text-ghost">Solved!</span>
                </div>
              </div>
            </InnerCard>
            <p className="font-sans text-xs text-text-secondary leading-relaxed">
              Pay close attention to yellows — they are the most commonly wasted clues.
              Ignoring a yellow and guessing that letter in the same wrong position again is a
              constraint violation, and the analysis will call it out.
            </p>
          </div>
        ),
      },
      {
        q: 'Should I sign in?',
        plain:
          'You can browse and play without an account, but signing in unlocks your personal ELO rating, full game history, Coach Chat, and the detailed review pages. All rated games also require an account so your progress persists across devices.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            You can browse and play without an account, but signing in unlocks your personal ELO
            rating, full game history, Coach Chat, and the detailed review pages. All rated games
            also require an account so your progress persists across devices. It&apos;s free and
            takes about ten seconds.
          </p>
        ),
      },
    ],
  },

  /* ============================== 2. YOUR SCORES ============================== */
  {
    slug: 'scores',
    title: 'Your Scores',
    icon: <BarChart2 size={16} />,
    partLabel: 'PART 02',
    intro: 'Skill, luck, opener — what they measure and why they are separate.',
    guestUnlocked: true,
    items: [
      {
        q: 'What are skill, luck, and opener?',
        plain:
          'Skill measures the quality of your guesses — how close each one came to the theoretical best. Luck measures how favorable the feedback was — you can make a perfect guess and still get unlucky if it produces a terrible pattern. Opener shows how rare your first guess was compared to everyone else who played.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Three numbers, three different questions about the same game.
            </p>
            <div className="grid gap-2">
              {[
                {
                  label: 'Skill (0–99)',
                  color: 'var(--tile-correct)',
                  desc: 'How good were your guesses? Compares each move to the mathematically optimal one. Pure skill — luck is factored out.',
                },
                {
                  label: 'Luck (0–99)',
                  color: 'var(--tile-present)',
                  desc: 'How favorable was the feedback? A guess can be brilliant and still give you an ugly, unhelpful pattern. Luck captures that variance.',
                },
                {
                  label: 'Opener',
                  color: '#c9a227',
                  desc: 'How rare was your first guess? Most players open with CRANE, SLATE or SALET, so anything else pushes your rarity up. Not better or worse — just how off-piste you started.',
                },
              ].map((s) => (
                <InnerCard key={s.label} className="flex gap-3 items-start">
                  <span
                    className="font-sans text-[10px] font-bold px-1.5 py-0.5 rounded-pill shrink-0 mt-0.5"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${s.color} 18%, transparent)`,
                      color: s.color,
                    }}
                  >
                    {s.label}
                  </span>
                  <p className="font-sans text-xs text-text-secondary leading-relaxed">{s.desc}</p>
                </InnerCard>
              ))}
            </div>
          </div>
        ),
      },
      {
        q: 'What does the Skill score mean exactly?',
        plain:
          'Your skill score starts at 99 and drops for every guess that falls short of optimal. The gap between what you guessed and what the bot would have guessed determines how many points come off. Make all optimal guesses and you score a 99. One bad guess in a lucky two-move game might still land you a 70. The opener does not count — more on that below.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Your skill score starts at 99 and drops for every guess that falls short of optimal.
              The gap between what you guessed and what the bot would have guessed determines how
              many points come off. Make all optimal guesses and you score a 99. One bad guess in a
              lucky two-move game might still land you a 70.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              The score is averaged across all your moves (excluding the opener), weighted by the
              stakes of each position. A blunder when 30 words remain costs more than the same
              blunder when 500 words remain — because you had better information and still
              messed it up.
            </p>
            <InnerCard>
              <p className="font-sans text-xs text-text-secondary leading-relaxed">
                <span className="font-semibold text-text-primary">Note:</span> Skill is computed
                only on moves where a meaningful choice existed. If only one valid guess remains,
                the move is marked <ClassBadge label="Forced" color="#565758" /> and skipped — you
                get no credit and no penalty.
              </p>
            </InnerCard>
          </div>
        ),
      },
      {
        q: 'What does the Luck score mean?',
        plain:
          'Luck measures how informative the feedback pattern was — independent of your guess quality. Say you open with CRANE. It could come back all gray (terrible luck, nothing learned) or all green (lucky break, word solved). Same guess, wildly different outcomes. The luck score quantifies that difference.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Luck measures how informative the feedback pattern was — independent of your guess
              quality. Say you open with CRANE. It could come back all gray (terrible luck, nothing
              learned) or all green (lucky break, word solved). Same guess, wildly different
              outcomes. The luck score quantifies that difference.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              High luck means the patterns you got were more helpful than average. Low luck means
              you were dealt a poor hand — the feedback was sparse or misleading. It&apos;s
              possible to play brilliantly and still lose, and that&apos;s what the luck score is
              designed to capture.
            </p>
            <InnerCard>
              <p className="font-sans text-xs text-text-secondary leading-relaxed">
                Yes, it just so happened that CRANE came back with four green squares. That&apos;s
                high luck, not high skill. They look the same from the outside — your scorecard
                tells you which one it was.
              </p>
            </InnerCard>
          </div>
        ),
      },
      {
        q: 'What does the Opener stat mean?',
        plain:
          'It shows your first guess and the percentage of other completed games that started with a different word. CRANE, SLATE and SALET are the heavy favourites — open with something unusual and the rarity climbs. It is not a quality judgment, just a measure of how off-piste your opening choice was.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            The Opener stat shows your first guess and what fraction of other completed games
            started with a different word. Openers cluster heavily around CRANE, SLATE and SALET,
            so playing anything else pushes your rarity toward 100%. It&apos;s descriptive, not
            evaluative — &quot;different&quot; doesn&apos;t mean &quot;better.&quot;
          </p>
        ),
      },
      {
        q: 'What is "info gained" and "efficiency"?',
        plain:
          'Info gained is how much a single guess narrowed down the remaining possibilities, measured in bits. A perfect opener gains around 5-6 bits and cuts 2,000 words down to maybe 50. Efficiency is the ratio of your info gained to the maximum possible info gain for that position — so 90% efficiency means you got 90% of the value the best possible guess would have gotten.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Info gained (measured in bits) tells you how much a single guess narrowed down the
              remaining possibilities. Think of it like asking yes/no questions: each bit cuts the
              search space in half. A perfect opener at the start of the game gains around 5–6
              bits, slashing 2,000+ possible words down to maybe 50.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Efficiency is the ratio of your info gained to the maximum possible info gain for that
              position. 90% efficiency means your guess got 90% of the value the single best guess
              would have gotten. It&apos;s the closest thing to a per-move grade.
            </p>
            <InnerCard className="space-y-2">
              <p className="font-sans text-[10px] text-text-ghost uppercase tracking-wider">
                Example — SALET as opener
              </p>
              <div className="flex items-center gap-3">
                <TileRow word="SALET" pattern={['gray', 'yellow', 'gray', 'yellow', 'gray']} />
                <ClassBadge label="Best" color="#538d4e" />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-sans text-xs mt-1">
                <div className="flex justify-between">
                  <span className="text-text-ghost">Info gained</span>
                  <span className="font-mono text-text-primary">5.43 bits</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-ghost">Words remaining</span>
                  <span className="font-mono text-text-primary">53</span>
                </div>
              </div>
              <EfficiencyBar pct={97} color="var(--tile-correct)" />
            </InnerCard>
          </div>
        ),
      },
      {
        q: 'What do the move classification badges mean?',
        plain:
          'Each guess is classified by comparing its efficiency to the theoretical best. Brilliant means you beat the bot — you found a guess the algorithm ranked lower but that turned out to be more valuable. Best means you matched or nearly matched the optimal pick. Good, Okay, Inaccuracy, Mistake, Blunder, Miss, and Forced cover the rest of the spectrum.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Each guess is classified by comparing its efficiency to the theoretical best. Here is
              the full ladder:
            </p>
            <div className="space-y-1.5">
              {[
                { label: 'Brilliant', color: '#1565c0', pct: '> 100%', w: 100, note: 'You beat the bot.' },
                { label: 'Best', color: '#538d4e', pct: '95–100%', w: 97, note: 'Matched the optimal pick.' },
                { label: 'Good', color: '#6aaa64', pct: '85–95%', w: 90, note: 'Very close to optimal.' },
                { label: 'Okay', color: '#2e9688', pct: '70–85%', w: 77, note: 'Solid, minor room to improve.' },
                { label: 'Inaccuracy', color: '#b59f3b', pct: '50–70%', w: 60, note: 'Noticeably suboptimal.' },
                { label: 'Mistake', color: '#e67e22', pct: '30–50%', w: 40, note: 'A meaningful miss.' },
                { label: 'Blunder', color: '#e74c3c', pct: '< 30%', w: 20, note: 'Significant information left on the table.' },
                { label: 'Miss', color: '#e74c3c', pct: '—', w: 10, note: 'Violated a known constraint.' },
                { label: 'Forced', color: '#565758', pct: '—', w: 5, note: 'Only one valid guess remained. No credit, no penalty.' },
              ].map((c) => (
                <div key={c.label} className="flex items-center gap-2">
                  <span
                    className="font-sans text-[10px] w-20 text-right font-semibold shrink-0"
                    style={{ color: c.color }}
                  >
                    {c.label}
                  </span>
                  <div className="flex-1 h-2 rounded-pill bg-bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-pill"
                      style={{ width: `${c.w}%`, backgroundColor: c.color, opacity: 0.75 }}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-text-ghost w-14 shrink-0">{c.pct}</span>
                </div>
              ))}
            </div>
            <p className="font-sans text-xs text-text-ghost leading-relaxed">
              <span className="font-semibold text-text-secondary">Brilliant</span> is genuinely
              rare — it means you identified an option the algorithm under-ranked. When you see
              it, it&apos;s real.
            </p>
          </div>
        ),
      },
    ],
  },

  /* ============================== 3. THE BOT'S PICKS ============================== */
  {
    slug: 'bot',
    title: "The Bot's Picks",
    icon: <Brain size={16} />,
    partLabel: 'PART 03',
    intro: "How the analyzer chooses its recommendations — and why they sometimes surprise you.",
    guestUnlocked: false,
    items: [
      {
        q: "How does the bot decide its top picks?",
        plain:
          'The bot scores every valid guess by computing the expected information gain — a weighted average over all possible feedback patterns. Whichever guess is expected to narrow down the remaining possibilities the most becomes the top pick. It has no sentimental attachment to any particular word, and it does not care how unusual the suggestion looks.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              The bot scores every valid guess by computing the expected information gain — a
              weighted average over all possible feedback patterns. Whichever guess is expected to
              narrow down the remaining possibilities the most becomes the top pick.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              It has no sentimental attachment to any particular word, and it does not care how
              unusual the suggestion looks. If XYLEM is the cleanest test at a certain point in the
              game, XYLEM goes to the top of the list. Words that could actually be the answer are
              given a slight tiebreaker boost — but only when they are otherwise equally efficient.
            </p>
          </div>
        ),
      },
      {
        q: "Why does the bot sometimes ignore a green square?",
        plain:
          'When very few words remain, the fastest path to the answer is often a guess that tests multiple unknowns at once — even if that means temporarily ignoring a green letter. Example: VERGE then TRACE then SHRUG. TRACE does not reuse the green E from VERGE. That seems wasteful, but TRACE tests four new high-value letters. SHRUG then covers the remaining unknowns. This is called an efficiency play.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              When several possible words remain, the fastest path to the answer is often a guess
              that tests multiple unknowns at once — even if that means temporarily ignoring a green
              letter you already locked in.
            </p>
            <InnerCard className="space-y-2">
              <p className="font-sans text-[10px] text-text-ghost uppercase tracking-wider">
                Example: VERGE → TRACE → SHRUG
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <TileRow word="VERGE" pattern={['gray', 'yellow', 'green', 'gray', 'yellow']} />
                  <span className="font-sans text-[10px] text-text-ghost">E locked in pos 3; R and E elsewhere</span>
                </div>
                <div className="flex items-center gap-3">
                  <TileRow word="TRACE" pattern={['gray', 'green', 'yellow', 'gray', 'green']} />
                  <span className="font-sans text-[10px] text-text-ghost">Ignores green E — tests R, A, C</span>
                </div>
                <div className="flex items-center gap-3">
                  <TileRow word="SHRUG" pattern={['gray', 'gray', 'green', 'gray', 'gray']} />
                  <span className="font-sans text-[10px] text-text-ghost">Covers remaining unknowns</span>
                </div>
              </div>
            </InnerCard>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              TRACE doesn&apos;t reuse the green E from VERGE. That looks wasteful — but TRACE
              tests four new high-value letters at once. By the time you get to guess four, the
              field is so narrow that the solution falls out naturally. This is called an efficiency
              play, and the bot prefers it whenever it leads to a faster expected solve.
            </p>
          </div>
        ),
      },
      {
        q: "Sometimes the bot suggests the actual solution — isn't that cheating?",
        plain:
          'Nope. Let us say the solution is SLANT. The bot is telling you that, of all the words still possible, SLANT was the cleanest test — even if the answer had been something else. If you guess SLANT and it is right, great. If it is wrong, the feedback still narrows down the field efficiently. The bot picks SLANT because of its information value, not because it peeked at the answer.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Nope. Let&apos;s say the solution is SLANT. The bot is telling you that, of all the
              words still possible at that moment, SLANT was the cleanest test — even if the answer
              had been something else. It picks SLANT because of its information value, not because
              it peeked at the answer.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              When SLANT happens to be both the optimal guess and the correct answer, that is a
              coincidence the math stumbled into. There is no crystal ball — just probability.
            </p>
          </div>
        ),
      },
      {
        q: '"Expected solutions after guess" vs "actual solutions after guess" — what is the difference?',
        plain:
          'Expected is the average number of words that would remain across all possible feedback patterns for that guess. Actual is how many words remained after you saw the specific pattern you got. When actual is much lower than expected, you got lucky feedback. When it is much higher, you were unlucky.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              <span className="font-semibold text-text-primary">Expected</span> is the average
              number of words that would remain across all possible feedback patterns for that guess.
              It is computed before the game knows what pattern you will get.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              <span className="font-semibold text-text-primary">Actual</span> is how many words
              remained after you saw the specific pattern the real answer produced. When actual is
              much lower than expected, you got lucky feedback. When it is much higher, you were
              unlucky — a scenario the luck score picks up.
            </p>
          </div>
        ),
      },
      {
        q: 'What does "expected steps until solution" mean?',
        plain:
          'This is the bot\'s estimate of how many more guesses the average player would need from this point in the game, given the remaining words. If it says 1.8, the bot expects most paths from here to end in under 2 moves. It is a forward-looking measure: lower is better.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            This is the bot&apos;s estimate of how many more guesses the average player would need
            from this point in the game, given the remaining words. If it says 1.8, the bot expects
            most paths from here to end in under 2 moves. It is a forward-looking measure: lower is
            better. A well-placed guess drops it by more than 1; a wasteful guess barely moves it.
          </p>
        ),
      },
    ],
  },

  /* ============================== 4. HARD MODE ============================== */
  {
    slug: 'hardmode',
    title: 'Hard Mode',
    icon: <Swords size={16} />,
    partLabel: 'PART 04',
    intro: 'Stricter rules, different optimal strategy.',
    guestUnlocked: false,
    items: [
      {
        q: 'What is hard mode?',
        plain:
          'Hard mode requires you to use every green and yellow letter you have already found in every subsequent guess. If you get a yellow R in position 2, every future guess must include an R. This rules out the efficiency plays the bot normally loves — you cannot ignore green squares or skip yellow letters.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Hard mode requires you to use every green and yellow letter you have already found in
              every subsequent guess. If you get a yellow R in position 2, every future guess must
              include an R somewhere. If you get a green E in position 3, every future guess must
              have E in position 3.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              This rules out the efficiency plays the bot normally loves — you cannot ignore green
              squares or throw an unrelated word to test new letters. Every guess must be a
              legal candidate given everything you know.
            </p>
          </div>
        ),
      },
      {
        q: 'How does hard mode change scoring?',
        plain:
          'In hard mode, the bot re-solves the game under the same constraints you faced. It only recommends guesses that honor all known green and yellow letters. The efficiency calculations and classifications are identical — they just apply to a smaller set of valid options. A Brilliant guess in hard mode is rarer and arguably more impressive.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            In hard mode, the bot re-solves the game under the same constraints you faced. It only
            recommends guesses that honor all known green and yellow letters. The efficiency
            calculations and classifications are identical — they just apply to a smaller set of
            valid options. A <ClassBadge label="Brilliant" color="#1565c0" /> guess in hard mode is
            rarer and arguably more impressive, because the room for creative plays is narrower.
          </p>
        ),
      },
      {
        q: 'Why is CLASP the recommended hard-mode opener, not SLATE?',
        plain:
          'In normal mode, SLATE is an excellent opener — it tests five high-frequency letters with no duplicates. In hard mode, SLATE commits you to placing those letters correctly from the start. CLASP, by contrast, shares similar letter coverage but leaves you more flexibility in where yellows land. The hard-mode constraint means the opener choice matters more, and CLASP survives those constraints slightly better on average.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              In normal mode, SLATE is an excellent opener — it tests five high-frequency letters
              with no repeats. But in hard mode, every yellow and green you earn must be carried
              forward. CLASP, which covers a similar set of common letters (C, L, A, S, P), tends
              to leave you in better shape when those letters come back yellow, because the
              hard-mode constraint gives you more valid options for where to place them next.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              The difference is small, but across thousands of games, CLASP produces a slightly
              lower average solve count under hard-mode rules. Normal-mode players should stick
              with SLATE or whatever opener they prefer.
            </p>
          </div>
        ),
      },
      {
        q: 'Hard mode still allows reusing gray letters — why?',
        plain:
          'Hard mode only enforces the positive constraints: use your greens and yellows. It does not force you to exclude gray letters. That asymmetry is a deliberate design choice in Wordle itself. ELOquence flags gray-letter reuse as a soft constraint violation in the analysis, but it does not prevent you from submitting the guess.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            Hard mode only enforces the positive constraints: use your greens and yellows. It does
            not force you to exclude gray letters. That asymmetry is a deliberate design choice in
            Wordle itself — ELOquence follows the same rules. Reusing a gray letter is allowed but
            flagged as a soft constraint violation in the post-game analysis, since it wastes
            information you already had.
          </p>
        ),
      },
    ],
  },

  /* ============================== 5. STRATEGY & MATH ============================== */
  {
    slug: 'strategy',
    title: 'Strategy & Math',
    icon: <Zap size={16} />,
    partLabel: 'PART 05',
    intro: 'The concepts behind efficient guessing — no formulas required.',
    guestUnlocked: true,
    items: [
      {
        q: 'What is "efficient guessing"?',
        plain:
          'An efficient guess splits the remaining possible words into as many equal-sized groups as possible. If one guess can separate five possible answers into five groups of one, you are guaranteed to solve next turn. A bad guess leaves all five words in the same group — no new information.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Suppose you have narrowed it down to BATCH, CATCH, LATCH, MATCH, PATCH. What should
              you guess next?
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <InnerCard className="space-y-2">
                <p className="font-sans text-xs font-semibold text-text-primary">Guess BATCH</p>
                <p className="font-sans text-[10px] text-text-ghost leading-relaxed">
                  If BATCH is right, all-green. Otherwise, B comes back gray and you still have
                  four candidates left — no new info beyond ruling out B.
                </p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <TileRow word="BATCH" pattern={['green', 'green', 'green', 'green', 'green']} />
                    <span className="font-sans text-[10px] text-text-ghost">BATCH ✓</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TileRow word="BATCH" pattern={['gray', 'green', 'green', 'green', 'green']} />
                    <span className="font-sans text-[10px] text-text-ghost">4 words left</span>
                  </div>
                </div>
              </InnerCard>
              <InnerCard className="space-y-2">
                <p className="font-sans text-xs font-semibold text-text-primary">Guess BLIMP</p>
                <p className="font-sans text-[10px] text-text-ghost leading-relaxed">
                  BLIMP shares no letters with any of the five words. Every solution gives a
                  different pattern — five groups of one.
                </p>
                <div className="space-y-1">
                  {(['BATCH', 'CATCH', 'LATCH', 'MATCH', 'PATCH'] as const).map((w) => (
                    <div key={w} className="flex items-center gap-2">
                      <TileRow word="BLIMP" pattern={['gray', 'gray', 'gray', 'gray', 'gray']} />
                      <span className="font-sans text-[10px] text-text-ghost">→ {w}</span>
                    </div>
                  ))}
                </div>
              </InnerCard>
            </div>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              BLIMP splits the five solutions into five groups of one — you are guaranteed to solve
              next turn. Guessing BATCH only resolves the game immediately if BATCH is the answer;
              otherwise you are no better off than before. That is what efficiency means.
            </p>
          </div>
        ),
      },
      {
        q: 'What is a trap and how do I escape one?',
        plain:
          'A trap happens in the endgame when several possible words share all but one letter. The classic example is the _IGHT family: LIGHT, MIGHT, NIGHT, RIGHT, SIGHT, TIGHT. You know the last four letters are IGHT. But guessing each candidate one by one gives you only a 1-in-6 chance each turn. A skilled player throws an escape word — something that tests all six possible first letters at once.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              A trap happens when several possible words differ in only one position. The
              classic example is the <span className="font-mono text-text-primary">_IGHT</span> family.
              You know four of the five letters. But guessing candidates one by one gives you a
              1-in-6 shot each turn — which could cost you the game.
            </p>
            <InnerCard className="space-y-2">
              <p className="font-sans text-[10px] text-text-ghost uppercase tracking-wider">
                The _IGHT trap
              </p>
              <div className="space-y-1">
                {[
                  { w: 'LIGHT', p: ['gray', 'green', 'green', 'green', 'green'] },
                  { w: 'MIGHT', p: ['gray', 'green', 'green', 'green', 'green'] },
                  { w: 'NIGHT', p: ['gray', 'green', 'green', 'green', 'green'] },
                  { w: 'RIGHT', p: ['gray', 'green', 'green', 'green', 'green'] },
                  { w: 'SIGHT', p: ['gray', 'green', 'green', 'green', 'green'] },
                  { w: 'TIGHT', p: ['gray', 'green', 'green', 'green', 'green'] },
                ].map(({ w, p }) => (
                  <div key={w} className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <Tile letter={w[0]} color="empty" size="sm" />
                      {w.slice(1).split('').map((ch, i) => (
                        <Tile key={i} letter={ch} color="green" size="sm" />
                      ))}
                    </div>
                    <span className="font-sans text-[10px] text-text-ghost">{w}</span>
                  </div>
                ))}
              </div>
            </InnerCard>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Random guessing gives you a 1-in-6 shot. A skilled player throws an &quot;escape
              word&quot; — something like a word that contains L, M, N, R, S, and T — that tests
              all the candidate first letters at once. One guess, six letters tested, trap escaped.
              The analysis flags when you were in a trap and shows whether you handled it optimally.
            </p>
          </div>
        ),
      },
      {
        q: 'What is a constraint violation?',
        plain:
          'A hard violation means you ignored information you definitely had — for example, reusing a gray letter or placing a yellow letter in the same position it already appeared. A soft violation means you omitted a letter you know is in the word. Soft violations are sometimes strategically correct — the escape-word play deliberately does this.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Violations come in two flavors.
            </p>
            <div
              className="p-3 rounded-card space-y-2"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--red) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--red) 20%, transparent)',
              }}
            >
              <p className="font-sans text-xs font-semibold" style={{ color: 'var(--red)' }}>
                Hard violation
              </p>
              <p className="font-sans text-xs text-text-secondary leading-relaxed">
                You used a gray letter again, or put a yellow letter in the exact position it
                already appeared. This is never strategically correct — it throws away guaranteed
                information. Marked with a <ClassBadge label="Miss" color="#9c27b0" /> badge.
              </p>
            </div>
            <InnerCard className="space-y-2">
              <p className="font-sans text-xs font-semibold text-text-secondary">Soft violation</p>
              <p className="font-sans text-xs text-text-secondary leading-relaxed">
                You omitted a letter you know is in the word. This is sometimes the right call —
                the escape-word play deliberately does it. Shown as a neutral note in the analysis,
                not a warning. The context determines whether it was smart or sloppy.
              </p>
            </InnerCard>
          </div>
        ),
      },
      {
        q: 'What is green-chasing and why is it bad?',
        plain:
          'Green-chasing means guessing words that reuse letters you have already confirmed green, instead of testing new unknown letters. It feels satisfying — you are building on what you know — but it wastes guesses. Once a letter is green, you get no new information from testing it again.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Green-chasing means guessing words that reuse letters you have already confirmed as
              green, instead of testing new unknown letters. It feels productive — you are building
              on certainty — but it wastes guesses. Once a letter is green, you already know it is
              correct. Guessing it again gives you zero new information about the remaining unknowns.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              The most common trap: getting green on the last four letters and then guessing five
              words in a row that all end the same way, one per unknown first letter. That is
              pure luck-based play when an escape word could have tested all five first letters
              in a single guess.
            </p>
          </div>
        ),
      },
      {
        q: "How does the bot's math actually work?",
        plain:
          'The bot computes a weighted average of information gain across all possible feedback patterns for each candidate guess. This concept comes from information theory and was popularized for Wordle by Grant Sanderson (3Blue1Brown). The bot does this computation for every valid word in the dictionary, which is why the analysis takes a moment to run.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              For each candidate guess, the bot simulates every possible feedback pattern it could
              produce against the remaining possible words. It then computes a weighted average of
              how much each pattern narrows down the search — a concept from information theory
              called entropy reduction (or information gain). The guess that maximizes this average
              becomes the top recommendation.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              This approach was popularized for Wordle by Grant Sanderson (3Blue1Brown) in his
              excellent YouTube breakdown. If you want the mathematical details, his video is the
              clearest explanation available. ELOquence extends it with skill/luck separation,
              move classification, and per-game history tracking.
            </p>
          </div>
        ),
      },
    ],
  },

  /* ============================== 6. GAME REVIEW ============================== */
  {
    slug: 'review',
    title: 'Game Review & Analysis Tools',
    icon: <Target size={16} />,
    partLabel: 'PART 06',
    intro: 'A walkthrough of everything on the post-game review page.',
    guestUnlocked: false,
    items: [
      {
        q: "What's on the review page?",
        plain:
          'The review page is your main post-game tool. It walks you through the game one step at a time: an overview of all your moves, then a card for each guess comparing it to the bot’s optimal pick, then a final summary with community stats and your ELO change. Move between steps with the arrow keys or the on-screen arrows.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              The review is a step-by-step walkthrough rather than a dashboard. Your overall skill,
              luck, and opener stats sit at the top of the overview; from there you page through one
              step at a time.
            </p>
            <div className="grid gap-2">
              {[
                { n: '1', name: 'Overview', desc: 'Your full guess grid plus a stats table summarising every move — skill, luck, words left and info gained, row by row. Click any row to jump straight to that move.' },
                { n: '2', name: 'Per-move cards', desc: 'One card per guess: its classification, a “Comparing our guesses” table (your guess vs. the bot’s optimal pick), the bits of information gained, and how each guess split the remaining solutions into groups. Expand the optimal pick to see runner-up alternatives.' },
                { n: '3', name: 'Summary', desc: 'How unique your game was versus the community, your projected ELO change (rated games), and links back to play or share.' },
              ].map((tab) => (
                <InnerCard key={tab.n} className="flex gap-2.5">
                  <span className="font-mono text-[10px] text-text-ghost bg-bg-muted w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                    {tab.n}
                  </span>
                  <div>
                    <p className="font-sans text-xs font-semibold text-text-primary">{tab.name}</p>
                    <p className="font-sans text-[11px] text-text-secondary leading-relaxed">{tab.desc}</p>
                  </div>
                </InnerCard>
              ))}
            </div>
          </div>
        ),
      },
      {
        q: 'How do I see the bot’s recommended guesses?',
        plain:
          'On each per-move card the bot’s single best pick is shown with a green check and a score of 99. Expand it to reveal up to five runner-up alternatives, each with the average number of solutions it would leave behind. These are the highest-ranked guesses by expected information gain at that point in the game.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Every per-move card names the bot&apos;s single best guess for that position, marked
              with a{' '}
              <span className="font-bold" style={{ color: 'var(--tile-correct)' }}>✓</span>{' '}
              green check and a perfect score of 99 — the guess with the highest expected
              information gain.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Tap the chevron next to it to expand up to five runner-up alternatives. Each shows the
              word and the average number of solutions it would be expected to leave behind (lower
              is better). If your own guess was the optimal one, it simply appears as the best pick
              — you matched the bot.
            </p>
          </div>
        ),
      },
      {
        q: 'What are the pattern groups on each card?',
        plain:
          'Each per-move card shows how your guess split the remaining solutions into groups — one group per feedback pattern it could produce — side by side with how the bot’s optimal pick would have split them. More, smaller groups mean faster solving; one big group means the guess barely narrowed things down. The card also reports the number of groups, the largest group, and the bits of information gained.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            Each per-move card visualises how your guess divided the solutions that remained before
            you played it: every distinct feedback pattern becomes one group, shown as a row of
            mini-tiles sized by how many words fall into it. Your split is placed next to the
            bot&apos;s optimal split for direct comparison. The accompanying table reports the
            number of groups, the largest group, and the bits of information gained — more and
            smaller groups (more bits) means the guess narrowed the field more evenly, and
            you&apos;ll usually solve faster.
          </p>
        ),
      },
      {
        q: 'What’s on the final summary (community stats)?',
        plain:
          'The last step of the review pulls back from individual moves and compares your whole game to everyone else who solved the same word: how many players got it, how your guess count stacks up, and how unique your exact sequence of guesses was. Rated games also show your projected ELO change here.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            The final step looks at the whole game in context. It shows community stats for the
            same answer — how many people solved it and how your number of guesses compares — plus
            how unique your particular path was, since identical games share a fingerprint. For
            rated games, your projected ELO change is shown here too. From this step you can jump
            back to play or share the game.
          </p>
        ),
      },
      {
        q: 'Are there keyboard shortcuts on the review page?',
        plain:
          'Yes. Use the left and right arrow keys to step backward and forward through the review. Home jumps to the overview, and End jumps to the final summary.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Yes. The review is a stepper, so navigation is quick from the keyboard.
            </p>
            <div className="grid gap-1.5">
              {[
                { keys: '←', action: 'Previous step' },
                { keys: '→', action: 'Next step' },
                { keys: 'Home', action: 'Jump to the overview' },
                { keys: 'End', action: 'Jump to the final summary' },
              ].map((s) => (
                <InnerCard key={s.keys} className="flex items-center justify-between py-2">
                  <span className="font-mono text-xs text-text-primary bg-bg-muted px-2 py-0.5 rounded-key">
                    {s.keys}
                  </span>
                  <span className="font-sans text-xs text-text-secondary">{s.action}</span>
                </InnerCard>
              ))}
            </div>
          </div>
        ),
      },
    ],
  },

  /* ============================== 7. THE COACH ============================== */
  {
    slug: 'coach',
    title: 'The Coach (AI Chat)',
    icon: <MessageSquare size={16} />,
    partLabel: 'PART 07',
    intro: 'A personal tutor that has read every line of your game.',
    guestUnlocked: false,
    items: [
      {
        q: 'What is Coach Chat?',
        plain:
          'Coach Chat is an AI assistant available on the review page. Unlike a general chatbot, it has the full context of your specific game — every guess, every pattern, every score — so it can give you advice that is actually about what you played, not generic Wordle tips.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            Coach Chat is an AI assistant available on the review page. Unlike a general chatbot, it
            has the full context of your specific game — every guess, every pattern, every analysis
            result — so it can give you advice that is actually about what you played, not generic
            Wordle tips. Ask it anything about your moves and it can explain, critique, or suggest
            what you could have done differently.
          </p>
        ),
      },
      {
        q: 'What can I ask it?',
        plain:
          'Anything about your game. Why was move 3 an inaccuracy? What should I have played instead? Why did the bot prefer TRACE over CRANE here? How do I avoid this kind of trap next time? The coach uses your actual game data to answer, so the responses are specific rather than generic.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Anything about your game. A few examples of questions that work well:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Why was move 3 an inaccuracy?',
                'What should I have played instead?',
                'How do I handle this kind of trap?',
                'Why did the bot prefer TRACE here?',
                "What patterns should I look for in the endgame?",
                'How close was my skill score to a perfect game?',
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
        ),
      },
      {
        q: 'Does the coach see my full game?',
        plain:
          'Yes. Every guess, feedback pattern, skill score, luck score, move classification, candidate list, and top picks for your specific game are provided to the coach automatically. You do not need to describe your game — it already knows.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            Yes. Every guess, feedback pattern, skill score, luck score, move classification,
            candidate list, and top picks for your specific game are provided to the coach
            automatically when you open the chat. You do not need to describe your game — it
            already knows. That is what makes it genuinely useful rather than a generic tip
            generator.
          </p>
        ),
      },
      {
        q: 'Are there limits?',
        plain:
          'Each game session has a 10-message limit. This resets when you start a review for a new game. The limit exists to keep the service sustainable — 10 messages is enough for a thorough debrief of any single game.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            Each game session has a 10-message limit. This resets when you start a review for a new
            game. The limit exists to keep the service sustainable — 10 messages is enough for a
            thorough debrief of any single game. If you find yourself needing more, that is a sign
            you are asking broad questions; try focusing on a specific move instead.
          </p>
        ),
      },
    ],
  },

  /* ============================== 8. ELO & PROGRESS ============================== */
  {
    slug: 'elo',
    title: 'ELO & Progress',
    icon: <TrendingUp size={16} />,
    partLabel: 'PART 08',
    intro: 'How your rating is calculated and what the tiers mean.',
    guestUnlocked: false,
    items: [
      {
        q: 'What is my ELO rating?',
        plain:
          'ELO is a number that represents your current skill level relative to other players. It goes up when you beat a hard word and down when you lose to an easy one. The system is borrowed from chess: it accounts for the expected difficulty of what you faced, so beating a hard word earns more than beating an easy one.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              ELO is a number that represents your skill level relative to other players. It goes up
              when you solve a word and down when you fail, with the magnitude depending on the
              word&apos;s difficulty. Beat a hard word and you gain more. Lose to an easy one and
              you lose more.
            </p>
            <InnerCard className="space-y-2">
              <p className="font-sans text-[10px] text-text-ghost uppercase tracking-wider">
                Example: win against a hard word
              </p>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="font-display text-lg font-bold text-text-primary">1057</p>
                  <p className="font-sans text-[10px] text-text-ghost">Before</p>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-sans text-xs font-bold" style={{ color: 'var(--tile-correct)' }}>+43</span>
                  <div className="w-12 h-px bg-border-subtle" />
                  <span className="font-sans text-[9px] text-text-ghost">Word difficulty: 1420</span>
                </div>
                <div className="text-center">
                  <p className="font-display text-lg font-bold" style={{ color: 'var(--tile-correct)' }}>1100</p>
                  <p className="font-sans text-[10px] text-text-ghost">After</p>
                </div>
              </div>
            </InnerCard>
          </div>
        ),
      },
      {
        q: 'What are the tiers?',
        plain:
          'Tiers are ELO bands: Novice (0–1199), Veteran (1200–1399), Master (1400–1599), Grandmaster (1600+). They are decorative milestones — your raw ELO is the authoritative number. Reaching a new tier does feel good though.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Tiers are ELO bands — decorative milestones that mark your progress. Your raw ELO
              is the authoritative number; tiers just give it a name.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Novice', range: '0 – 1199', cls: 'bg-tier-novice' },
                { name: 'Veteran', range: '1200 – 1399', cls: 'bg-tier-veteran' },
                { name: 'Master', range: '1400 – 1599', cls: 'bg-tier-master' },
                { name: 'Grandmaster', range: '1600+', cls: 'bg-tier-grandmaster' },
              ].map((t) => (
                <InnerCard key={t.name} className="flex items-center gap-2 py-2">
                  <span className={clsx('w-2 h-2 rounded-full shrink-0', t.cls)} />
                  <div>
                    <span className="font-sans text-xs font-semibold text-text-primary">{t.name}</span>
                    <span className="font-sans text-[10px] text-text-ghost ml-1.5">{t.range}</span>
                  </div>
                </InnerCard>
              ))}
            </div>
          </div>
        ),
      },
      {
        q: 'What are placement matches?',
        plain:
          'Your first five rated games use a boosted adjustment factor (K=128 instead of the usual K=32). This means your rating moves four times faster during placement, so it settles close to your true level quickly rather than grinding there over weeks. After placement, changes are more gradual.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            Your first five rated games use a boosted adjustment factor — four times higher than
            normal. This means your rating moves quickly during placement, settling close to your
            true level fast rather than grinding there over weeks. Once placement ends, rating
            changes become more gradual and stable. If you want a fast calibration: play five
            competitive games and let the system find you.
          </p>
        ),
      },
      {
        q: 'How is word difficulty computed?',
        plain:
          'Each word gets a difficulty score from how common its letters are, how typical those letters are in their positions, whether it repeats letters, and how everyday the word itself is. Rare letters, unusual placements, duplicates, and words outside the common answer list all push difficulty up. The score (roughly 600–1800) feeds directly into how much ELO you gain or lose for that word.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            Each word gets a difficulty score from how common its letters are, how typical those
            letters are in their positions, whether it repeats letters, and how everyday the word
            itself is. Rare letters, unusual placements, duplicates, and words outside the common
            answer list all push it up — those words are genuinely harder to solve. Scores span
            roughly 600–1800, and the number feeds directly into how much ELO you gain or lose:
            beat a difficulty-1500 word and you gain significantly more than beating a
            difficulty-700 word.
          </p>
        ),
      },
      {
        q: "What's my streak?",
        plain:
          'Your streak counts consecutive days on which you solved the Daily puzzle. Miss a day — even by a few minutes past midnight in your local time — and it resets to zero. Your all-time best streak is saved separately and never resets.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            Your streak counts consecutive days on which you solved the Daily puzzle. Miss a
            day — even by a few minutes past midnight in your local time — and it resets to zero.
            Your all-time best streak is saved separately and never resets. The Daily puzzle
            refreshes at midnight in your local timezone, so plan accordingly.
          </p>
        ),
      },
    ],
  },

  /* ============================== 9. WORD LISTS ============================== */
  {
    slug: 'wordlists',
    title: 'Word Lists',
    icon: <FileText size={16} />,
    partLabel: 'PART 09',
    intro: 'Four different word lists power different parts of the game.',
    guestUnlocked: true,
    items: [
      {
        q: "How many words does ELOquence know?",
        plain:
          'ELOquence works with four distinct word lists. 15,000 valid guesses — anything you can submit. 5,500 competitive answers — the pool used for Competitive mode. 4,500 bot suggestion words — the pool the bot draws its top-pick recommendations from. 2,309 standard daily words — the classic Wordle answer list.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              ELOquence works with four distinct word lists, each serving a different purpose.
            </p>
            <div className="space-y-2">
              {[
                {
                  n: '15,000',
                  label: 'Valid guesses',
                  desc: 'Anything you can submit. The full dictionary ELOquence recognizes as a legal guess.',
                },
                {
                  n: '5,500',
                  label: 'Competitive answers',
                  desc: 'The pool used for Competitive mode games. Broader than the daily list — includes less common but still fair words.',
                },
                {
                  n: '4,500',
                  label: 'Bot suggestion pool',
                  desc: "Words the bot can recommend as top picks. Filtered for fairness — no obscure words that would feel like a trick.",
                },
                {
                  n: '2,309',
                  label: 'Standard daily words',
                  desc: "The classic Wordle answer list. If you played the NYT's original Wordle, you know these words. Used for Daily mode.",
                },
              ].map((w) => (
                <InnerCard key={w.n} className="flex gap-3 items-start">
                  <span
                    className="font-display font-black text-lg shrink-0 leading-none mt-0.5"
                    style={{ color: 'var(--tile-correct)' }}
                  >
                    {w.n}
                  </span>
                  <div>
                    <p className="font-sans text-xs font-semibold text-text-primary">{w.label}</p>
                    <p className="font-sans text-xs text-text-secondary leading-relaxed mt-0.5">
                      {w.desc}
                    </p>
                  </div>
                </InnerCard>
              ))}
            </div>
          </div>
        ),
      },
      {
        q: 'Can I guess a word that is not on any list?',
        plain:
          'No. ELOquence only accepts guesses from the 15,000-word valid guess dictionary. If you type a word and it does not submit, it is not in the dictionary. Proper nouns, abbreviations, and most words fewer than five letters are excluded.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            No. ELOquence only accepts guesses from the 15,000-word valid-guess dictionary. If you
            type a word and it is not accepted, it is simply not in the list. Proper nouns,
            abbreviations, and most obscure technical terms are excluded. The 15,000-word list
            covers essentially all common English five-letter words.
          </p>
        ),
      },
      {
        q: 'Are past solutions excluded from future daily puzzles?',
        plain:
          'Yes, by default the bot and top-picks list exclude words that have already been the daily solution. You can toggle this behavior off in the analysis settings if you want to see what the bot would recommend without that filter.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            Yes, by default the bot and top-picks list exclude words that have already appeared as
            the daily solution. You can toggle this off in the analysis settings if you want to see
            what the bot would recommend without the past-solutions filter — useful for
            understanding how the recommendations change when you lift that constraint.
          </p>
        ),
      },
      {
        q: 'Why does the bot sometimes suggest a word I have never heard of?',
        plain:
          'The bot optimizes for information gain, not familiarity. If an unusual word splits the remaining candidates perfectly, it goes to the top of the list. It is always drawn from the 4,500-word suggestion pool, so it is always a real word — just possibly one you did not know.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            The bot optimizes for information gain, not familiarity. If an unusual word splits the
            remaining candidates perfectly, it goes to the top of the list regardless of how common
            it is. All suggestions are drawn from the 4,500-word suggestion pool, so every
            recommendation is a real word — just possibly one that lives at the edge of everyday
            vocabulary. The bot has no sentimental attachment to common words.
          </p>
        ),
      },
    ],
  },

  /* ============================== 10. ARCHIVE & REPLAY ============================== */
  {
    slug: 'archive',
    title: 'Archive & Replay',
    icon: <Star size={16} />,
    partLabel: 'PART 10',
    intro: 'Go back and play any past daily puzzle.',
    guestUnlocked: false,
    items: [
      {
        q: 'What is the Wordle Archive?',
        plain:
          'The archive is a collection of every past daily puzzle, available at /archive. You can replay any of them, get a full analysis, and use Coach Chat — exactly like a regular game. The only difference is that archive games are unrated.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            The archive is a collection of every past daily puzzle, available at{' '}
            <span className="font-mono text-text-primary">/archive</span>. You can replay any of
            them, get a full analysis, and use Coach Chat — exactly like a regular game. It is a
            great way to study specific words you heard about from friends, or to deliberately
            practice on words known to be tricky.
          </p>
        ),
      },
      {
        q: 'Does replaying a past daily affect my ELO?',
        plain:
          'No. Archive games are always unrated. Your ELO, streak, and stats are not affected by anything that happens in the archive. Play as many as you like without risk.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            No. Archive games are always unrated. Your ELO, streak, and stats are completely
            unaffected by anything that happens in the archive. Play as many as you like without
            any risk to your rating. Think of the archive as a practice lab with a full analysis
            suite attached.
          </p>
        ),
      },
      {
        q: 'Can I replay a game I already played?',
        plain:
          'Yes, with a caveat: if you already played a daily and go back to replay it in the archive, you already know the answer. The analysis will still run correctly, but your skill score will reflect that foreknowledge. There is no way to un-know a word.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            Yes, with a caveat: if you already played a daily and go back to replay it in the
            archive, you already know the answer. The analysis will run correctly, and your moves
            will be scored normally — but your skill score will inevitably reflect that
            foreknowledge. There is no way to un-know a word. Use the archive mainly to replay
            puzzles you missed or to study specific words cold.
          </p>
        ),
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  SectionHeader component                                             */
/* ------------------------------------------------------------------ */

function SectionHeader({
  partLabel,
  title,
  icon,
  id,
}: {
  partLabel: string;
  title: string;
  icon: React.ReactNode;
  id: string;
}) {
  return (
    <div id={id} className="scroll-mt-24 mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-px flex-none w-8 bg-border-default" aria-hidden="true" />
        <span className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-text-ghost">
          {partLabel}
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <span
          className="p-1.5 rounded-card border shrink-0"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--tile-correct) 10%, transparent)',
            borderColor: 'color-mix(in srgb, var(--tile-correct) 18%, transparent)',
            color: 'var(--tile-correct)',
          }}
        >
          {icon}
        </span>
        <h2 className="font-display font-black text-2xl text-text-primary">{title}</h2>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FAQItem accordion component                                         */
/* ------------------------------------------------------------------ */

function FAQAccordionItem({
  id,
  item,
  isOpen,
  onToggle,
}: {
  id: string;
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={clsx(
        'border-b border-border-subtle last:border-b-0',
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 py-4 text-left group"
        aria-expanded={isOpen}
        id={`faq-btn-${id}`}
        aria-controls={`faq-body-${id}`}
      >
        <h3 className="flex-1 font-display font-semibold text-sm text-text-primary leading-snug group-hover:text-tile-correct transition-colors">
          {item.q}
        </h3>
        <span
          className="shrink-0 mt-0.5 text-text-ghost transition-transform duration-fast"
          style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
          aria-hidden="true"
        >
          <Plus size={16} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={`faq-body-${id}`}
            role="region"
            aria-labelledby={`faq-btn-${id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-5 pr-6">{item.a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Locked section card                                                 */
/* ------------------------------------------------------------------ */

function LockedSection({ title }: { title: string }) {
  const router = useRouter();
  return (
    <div
      className="flex flex-col items-center gap-3 py-10 px-6 rounded-card border border-border-subtle text-center"
      style={{ backgroundColor: 'color-mix(in srgb, var(--bg-muted) 60%, transparent)' }}
    >
      <span
        className="p-3 rounded-full border"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--tile-correct) 8%, transparent)',
          borderColor: 'color-mix(in srgb, var(--tile-correct) 15%, transparent)',
          color: 'var(--tile-correct)',
        }}
      >
        <Lock size={20} />
      </span>
      <div className="space-y-1">
        <p className="font-display font-semibold text-sm text-text-primary">
          Sign in to read this section
        </p>
        <p className="font-sans text-xs text-text-secondary leading-relaxed max-w-xs mx-auto">
          Create a free account to unlock <span className="font-medium text-text-primary">{title}</span> and
          all other sections.
        </p>
      </div>
      <button
        onClick={() => router.push('/login')}
        className="mt-1 px-4 py-2 rounded-card font-sans text-xs font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'var(--tile-correct)' }}
      >
        Sign in
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                      */
/* ------------------------------------------------------------------ */

export default function LearnPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  void router;

  const [query, setQuery] = useState('');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [activeSectionSlug, setActiveSectionSlug] = useState<string>(SECTIONS[0].slug);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  /* ---- search filter ---- */
  const normalizedQuery = query.toLowerCase().trim();

  const filteredSections = useMemo(() => {
    if (!normalizedQuery) return SECTIONS;
    return SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.q.toLowerCase().includes(normalizedQuery) ||
          item.plain.toLowerCase().includes(normalizedQuery),
      ),
    })).filter((section) => section.items.length > 0);
  }, [normalizedQuery]);

  /* ---- when searching, auto-open matches ---- */
  useEffect(() => {
    if (normalizedQuery) {
      const ids = new Set<string>();
      filteredSections.forEach((section) => {
        section.items.forEach((item) => {
          ids.add(`${section.slug}::${item.q}`);
        });
      });
      setOpenItems(ids);
    }
  }, [normalizedQuery, filteredSections]);

  /* ---- expand / collapse all ---- */
  const handleToggleAll = useCallback(() => {
    if (allExpanded) {
      setOpenItems(new Set());
      setAllExpanded(false);
    } else {
      const ids = new Set<string>();
      SECTIONS.forEach((section) => {
        section.items.forEach((item) => {
          ids.add(`${section.slug}::${item.q}`);
        });
      });
      setOpenItems(ids);
      setAllExpanded(true);
    }
  }, [allExpanded]);

  /* ---- toggle individual item ---- */
  const toggleItem = useCallback((id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /* ---- IntersectionObserver for ToC highlight ---- */
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const thresholds = [0.2];

    SECTIONS.forEach((section) => {
      const el = sectionRefs.current[section.slug];
      if (!el) return;

      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveSectionSlug(section.slug);
            }
          });
        },
        { rootMargin: '-80px 0px -60% 0px', threshold: thresholds },
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => {
      observers.forEach((obs) => obs.disconnect());
    };
  }, []);

  const isLocked = (section: SectionDef) => !user && !section.guestUnlocked;

  /* ---- mobile ToC ---- */
  const MobileToc = () => (
    <details className="lg:hidden mb-6 rounded-card border border-border-subtle bg-bg-elevated">
      <summary className="px-4 py-3 font-sans text-sm font-medium text-text-primary cursor-pointer flex items-center justify-between list-none">
        <span>Jump to section</span>
        <ChevronDown size={14} className="text-text-ghost" />
      </summary>
      <div className="px-4 pb-3 space-y-1 border-t border-border-subtle pt-2">
        {SECTIONS.map((section) => (
          <a
            key={section.slug}
            href={`#${section.slug}`}
            className="block font-sans text-xs text-text-secondary hover:text-text-primary py-1 transition-colors"
            onClick={() => {
              // close details after click
              const details = document.querySelector('details.lg\\:hidden') as HTMLDetailsElement | null;
              if (details) details.open = false;
            }}
          >
            {section.partLabel} — {section.title}
          </a>
        ))}
      </div>
    </details>
  );

  /* ---- desktop ToC ---- */
  const DesktopToc = () => (
    <aside className="hidden lg:block lg:sticky lg:top-20 self-start w-52 shrink-0">
      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-text-ghost mb-3">
        Contents
      </p>
      <nav className="space-y-0.5">
        {SECTIONS.map((section) => {
          const active = activeSectionSlug === section.slug;
          return (
            <a
              key={section.slug}
              href={`#${section.slug}`}
              className={clsx(
                'block font-sans text-xs py-1.5 px-2 rounded-card transition-colors',
                active
                  ? 'text-text-primary font-semibold bg-bg-muted'
                  : 'text-text-secondary hover:text-text-primary',
              )}
              style={active ? { color: 'var(--tile-correct)' } : undefined}
            >
              {section.title}
            </a>
          );
        })}
      </nav>
    </aside>
  );

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-bg-base">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Page header */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.slide}
          className="mb-8"
        >
          <div className="flex items-center gap-2.5 mb-2">
            <BookOpen size={22} style={{ color: 'var(--tile-correct)' }} />
            <p className="font-sans text-sm font-medium text-text-secondary tracking-wide uppercase">
              Frequently asked questions
            </p>
          </div>
          <h1 className="font-display font-black text-5xl text-text-primary tracking-tight mb-2">
            FAQ
          </h1>
          <p className="font-sans text-base text-text-secondary leading-relaxed">
            Everything about scores, picks, ELO, hard mode, and the rest of the bot.
          </p>

          {!loading && !user && (
            <div
              className="mt-4 flex items-center gap-2.5 px-3 py-2.5 rounded-card border"
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

          {/* Search + expand/collapse row */}
          <div className="flex items-center gap-3 mt-5">
            <div className="relative flex-1 max-w-sm">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost pointer-events-none"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search questions…"
                className="w-full pl-9 pr-4 py-2 rounded-card bg-bg-elevated border border-border-subtle font-sans text-sm text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-border-strong transition-colors"
              />
            </div>
            <button
              onClick={handleToggleAll}
              className="shrink-0 font-sans text-xs text-text-secondary hover:text-text-primary border border-border-subtle rounded-card px-3 py-2 bg-bg-elevated transition-colors hover:border-border-default"
            >
              {allExpanded ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
        </motion.header>

        {/* Mobile ToC */}
        <MobileToc />

        {/* Body: article + desktop ToC */}
        <div className="flex gap-10 items-start">
          {/* Article column */}
          <motion.article
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.08 }}
            className="flex-1 min-w-0 max-w-[720px]"
          >
            {filteredSections.length === 0 && (
              <div className="py-16 text-center">
                <p className="font-display font-semibold text-text-secondary text-lg">
                  No results for &ldquo;{query}&rdquo;
                </p>
                <p className="font-sans text-sm text-text-ghost mt-2">
                  Try a different keyword, or{' '}
                  <button
                    className="underline hover:text-text-secondary transition-colors"
                    onClick={() => setQuery('')}
                  >
                    clear the search
                  </button>
                  .
                </p>
              </div>
            )}

            {filteredSections.map((section, sectionIdx) => {
              const locked = isLocked(section);
              return (
                <section
                  key={section.slug}
                  ref={(el) => { sectionRefs.current[section.slug] = el; }}
                  className={clsx(sectionIdx > 0 && 'mt-14')}
                >
                  <SectionHeader
                    id={section.slug}
                    partLabel={section.partLabel}
                    title={section.title}
                    icon={section.icon}
                  />

                  {section.intro && (
                    <p className="font-sans text-sm text-text-secondary leading-relaxed mb-5 -mt-2">
                      {section.intro}
                    </p>
                  )}

                  {locked ? (
                    <LockedSection title={section.title} />
                  ) : (
                    <div className="border-t border-border-subtle">
                      {section.items.map((item) => {
                        const itemId = `${section.slug}::${item.q}`;
                        return (
                          <FAQAccordionItem
                            key={itemId}
                            id={itemId}
                            item={item}
                            isOpen={openItems.has(itemId)}
                            onToggle={() => toggleItem(itemId)}
                          />
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}

            {/* Credit card */}
            {!normalizedQuery && (
              <div
                className="mt-16 mb-4 p-6 rounded-card-lg border border-border-subtle text-center"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 80%, transparent)',
                }}
              >
                <MiniSparkline />
                <p className="font-display font-semibold text-text-primary mt-3">
                  Made by Marin Bošković
                </p>
                <p className="font-sans text-xs text-text-ghost mt-1 leading-relaxed">
                  ELOquence is a personal project. If you find a bug or have a suggestion,
                  the best way to reach me is through the feedback option in your account menu.
                </p>
              </div>
            )}
          </motion.article>

          {/* Desktop ToC (sticky) */}
          <DesktopToc />
        </div>
      </div>
    </div>
  );
}
