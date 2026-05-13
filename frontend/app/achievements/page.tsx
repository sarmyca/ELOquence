'use client';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Flag,
  Zap,
  Target,
  Award,
  ShieldCheck,
  Crosshair,
  Gem,
  Sparkles,
  Flame,
  CalendarDays,
  Trophy,
  Swords,
  Medal,
  Crown,
  TrendingUp,
  Hash,
  Activity,
  Layers,
  Lock,
} from 'lucide-react';
import clsx from 'clsx';
import { achievementsApi } from '@/lib/api';
import { ACHIEVEMENT_META } from '@/components/AchievementToast';

interface AchievementDef {
  type: string;
  name: string;
  description: string;
  icon: string;
}

interface UnlockedAchievement {
  type: string;
  unlocked_at: string;
}

// ─── Categories ──────────────────────────────────────────────────────────────

type Category = 'solving' | 'accuracy' | 'streaks' | 'rating' | 'variety';

const CATEGORY_FOR_TYPE: Record<string, Category> = {
  // Solving
  first_win:         'solving',
  quick_solve:       'solving',
  bullseye:          'solving',
  hole_in_one:       'solving',
  last_chance:       'solving',
  // Accuracy
  sharpshooter:      'accuracy',
  precision:         'accuracy',
  perfect_game:      'accuracy',
  // Streaks
  streak_7:          'streaks',
  streak_30:         'streaks',
  streak_100:        'streaks',
  // Rating
  reach_veteran:     'rating',
  reach_master:      'rating',
  reach_grandmaster: 'rating',
  upset:             'rating',
  // Variety
  regular:           'variety',
  marathon:          'variety',
  triathlete:        'variety',
};

const ICON_FOR_TYPE: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  // Solving
  first_win:    Flag,
  quick_solve:  Zap,
  bullseye:     Target,
  hole_in_one:  Award,
  last_chance:  ShieldCheck,
  // Accuracy
  sharpshooter: Crosshair,
  precision:    Gem,
  perfect_game: Sparkles,
  // Streaks
  streak_7:     Flame,
  streak_30:    CalendarDays,
  streak_100:   Trophy,
  // Rating
  reach_veteran:     Swords,
  reach_master:      Medal,
  reach_grandmaster: Crown,
  upset:             TrendingUp,
  // Variety
  regular:    Hash,
  marathon:   Activity,
  triathlete: Layers,
};

const CATEGORY_COLOR: Record<Category, string> = {
  solving:  'var(--tile-correct)',  // green
  accuracy: 'var(--cls-blue)',      // blue
  streaks:  'var(--tile-present)',  // yellow
  rating:   'var(--cls-orange)',    // orange
  variety:  'var(--silver)',        // silver/neutral
};

const CATEGORY_LABEL: Record<Category, string> = {
  solving:  'Solving',
  accuracy: 'Accuracy',
  streaks:  'Streaks',
  rating:   'Rating',
  variety:  'Variety',
};

const CATEGORY_ORDER: Category[] = ['solving', 'accuracy', 'streaks', 'rating', 'variety'];

interface MergedAchievement {
  type: string;
  name: string;
  description: string;
  icon: string;
  category: Category;
}

// ─── Achievement card ────────────────────────────────────────────────────────

function AchievementCard({
  ach,
  index,
  unlockedAt,
}: {
  ach: MergedAchievement;
  index: number;
  unlockedAt: string | undefined;
}) {
  const isUnlocked = !!unlockedAt;
  const tint = CATEGORY_COLOR[ach.category];
  const Icon = ICON_FOR_TYPE[ach.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', damping: 22, stiffness: 320, delay: index * 0.03 }}
      className="relative flex items-start gap-3 rounded-card p-4 bg-bg-base border transition-colors"
      style={{
        borderColor: isUnlocked
          ? `color-mix(in srgb, ${tint} 35%, var(--border-default))`
          : 'var(--border-subtle)',
        opacity: isUnlocked ? 1 : 0.55,
      }}
    >
      {/* Icon disc — color inherits to the SVG via `color` so we can use a token */}
      <div
        className="shrink-0 flex items-center justify-center rounded-full"
        style={{
          width: 40,
          height: 40,
          backgroundColor: isUnlocked
            ? `color-mix(in srgb, ${tint} 14%, transparent)`
            : 'var(--bg-muted)',
          border: '1px solid',
          borderColor: isUnlocked
            ? `color-mix(in srgb, ${tint} 35%, transparent)`
            : 'var(--border-subtle)',
          color: isUnlocked ? tint : 'var(--text-tertiary)',
        }}
      >
        {Icon ? (
          <Icon size={18} strokeWidth={2} />
        ) : (
          <span style={{ fontSize: 18 }}>{ach.icon}</span>
        )}
      </div>

      {/* Text block */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="font-sans text-sm font-semibold truncate"
            style={{ color: isUnlocked ? 'var(--text-primary)' : 'var(--text-secondary)' }}
          >
            {ach.name}
          </span>
          {!isUnlocked && (
            <Lock size={11} style={{ color: 'var(--text-ghost)', flexShrink: 0 }} />
          )}
        </div>
        <p
          className="font-sans text-xs leading-snug"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {ach.description}
        </p>
        {isUnlocked && unlockedAt && (
          <p
            className="font-sans text-[10px] font-mono mt-1"
            style={{ color: 'var(--text-ghost)' }}
          >
            unlocked {new Date(unlockedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        )}
      </div>

    </motion.div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex items-start gap-3 rounded-card p-4 bg-bg-base border border-border-subtle">
      <div className="w-10 h-10 rounded-full bg-bg-muted animate-pulse" />
      <div className="flex-1 space-y-1.5 pt-1">
        <div className="h-3 w-24 rounded bg-bg-muted animate-pulse" />
        <div className="h-2.5 w-36 rounded bg-bg-muted/60 animate-pulse" />
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AchievementsPage() {
  const [allAchievements, setAllAchievements] = useState<AchievementDef[]>([]);
  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | Category>('all');

  useEffect(() => {
    Promise.all([achievementsApi.all(), achievementsApi.mine()])
      .then(([allRes, mineRes]) => {
        setAllAchievements(allRes.data);
        setUnlocked(mineRes.data);
      })
      .catch(() => setError('Failed to load achievements.'))
      .finally(() => setLoading(false));
  }, []);

  const unlockedMap = useMemo(
    () => new Map(unlocked.map((u) => [u.type, u.unlocked_at])),
    [unlocked],
  );

  const mergedAchievements: MergedAchievement[] = useMemo(
    () =>
      allAchievements.map((a) => {
        const meta = ACHIEVEMENT_META[a.type];
        return {
          type: a.type,
          name: a.name || meta?.name || a.type,
          description: a.description || meta?.description || '',
          icon: a.icon || meta?.icon || '🏆',
          category: CATEGORY_FOR_TYPE[a.type] ?? 'rating',
        };
      }),
    [allAchievements],
  );

  const filteredAchievements = useMemo(
    () =>
      filter === 'all'
        ? mergedAchievements
        : mergedAchievements.filter((a) => a.category === filter),
    [mergedAchievements, filter],
  );

  const grouped: Array<{ category: Category; items: MergedAchievement[] }> = useMemo(() => {
    const map: Record<Category, MergedAchievement[]> = {
      solving: [], accuracy: [], streaks: [], rating: [], variety: [],
    };
    for (const a of filteredAchievements) map[a.category].push(a);
    return CATEGORY_ORDER
      .map((category) => ({ category, items: map[category] }))
      .filter((g) => g.items.length > 0);
  }, [filteredAchievements]);

  const unlockedCount = unlocked.length;
  const totalCount = mergedAchievements.length;
  const progressPct = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  const filterCounts = useMemo(() => {
    const counts: Record<'all' | Category, number> = {
      all: mergedAchievements.length,
      solving: 0, accuracy: 0, streaks: 0, rating: 0, variety: 0,
    };
    for (const a of mergedAchievements) counts[a.category]++;
    return counts;
  }, [mergedAchievements]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6 space-y-2">
          <div className="h-3 w-24 rounded bg-bg-muted animate-pulse" />
          <div className="h-9 w-56 rounded bg-bg-muted animate-pulse" />
          <div className="h-1.5 w-48 rounded-pill bg-bg-muted/60 animate-pulse mt-3" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Compact header matching dashboard/review style */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="mb-5"
      >
        <p
          className="font-sans text-[10px] uppercase tracking-[0.1em] mb-1"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Achievements
        </p>
        <h1
          className="font-display font-black tracking-tight mb-2"
          style={{
            fontSize: '2rem',
            color: 'var(--text-primary)',
            lineHeight: 1.1,
          }}
        >
          {unlockedCount}
          <span style={{ color: 'var(--text-tertiary)' }}> / {totalCount}</span>
          <span
            className="font-sans font-medium ml-2"
            style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}
          >
            unlocked
          </span>
        </h1>

        <div
          className="relative h-1.5 max-w-[280px] rounded-pill overflow-hidden bg-bg-muted"
          role="progressbar"
          aria-valuenow={unlockedCount}
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-label={`${unlockedCount} of ${totalCount} achievements unlocked`}
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-pill"
            initial={{ width: '0%' }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            style={{ backgroundColor: 'var(--tile-correct)' }}
          />
        </div>
      </motion.div>

      {/* Category filter — same pattern as dashboard/recent-games */}
      <div
        role="tablist"
        aria-label="Filter achievements by category"
        className="flex gap-1 mb-5 p-1 rounded-card bg-bg-elevated border border-border-subtle w-fit"
      >
        {(
          [
            { key: 'all',      label: 'All' },
            { key: 'solving',  label: 'Solving' },
            { key: 'accuracy', label: 'Accuracy' },
            { key: 'streaks',  label: 'Streaks' },
            { key: 'rating',   label: 'Rating' },
            { key: 'variety',  label: 'Variety' },
          ] as const
        ).map((opt) => {
          const active = filter === opt.key;
          return (
            <button
              key={opt.key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setFilter(opt.key)}
              className={clsx(
                'px-3 py-1.5 rounded-card text-xs font-sans font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2',
                active
                  ? 'bg-bg-base text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary',
              )}
              style={active ? { outlineColor: 'var(--tile-correct)' } : undefined}
            >
              {opt.label}
              <span className="ml-1.5 text-text-ghost font-mono">
                {filterCounts[opt.key]}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-card font-sans text-sm"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--red) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--red) 20%, transparent)',
            color: 'var(--red)',
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Grouped grid */}
      {grouped.length === 0 && !error ? (
        <div className="text-center py-16 font-sans text-text-secondary text-sm">
          No achievements in this category.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ category, items }) => (
            <section key={category}>
              <header className="flex items-center gap-2 mb-3">
                <span
                  className="font-sans text-[10px] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: CATEGORY_COLOR[category] }}
                >
                  {CATEGORY_LABEL[category]}
                </span>
                <span
                  className="flex-1 h-px"
                  style={{ backgroundColor: 'var(--border-subtle)' }}
                />
                <span
                  className="font-mono text-[10px]"
                  style={{ color: 'var(--text-ghost)' }}
                >
                  {items.filter((a) => unlockedMap.has(a.type)).length}
                  {' / '}
                  {items.length}
                </span>
              </header>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {items.map((ach, i) => (
                  <AchievementCard
                    key={ach.type}
                    ach={ach}
                    index={i}
                    unlockedAt={unlockedMap.get(ach.type)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
