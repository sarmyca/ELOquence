'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Trophy } from 'lucide-react';
import { achievementsApi } from '@/lib/api';
import { ACHIEVEMENT_META } from '@/components/AchievementToast';
import { stagger } from '@/lib/animations';

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

interface MergedAchievement {
  type: string;
  name: string;
  description: string;
  icon: string;
}

// ---- Skeleton card ----------------------------------------------------------

function SkeletonCard() {
  return (
    <div
      className="flex flex-col items-center gap-2.5 rounded-[12px] px-4 py-5"
      style={{ background: '#0f0f12', border: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div className="w-9 h-9 rounded-full bg-bg-elevated animate-pulse" />
      <div className="w-16 h-2.5 rounded-full bg-bg-elevated animate-pulse" />
      <div className="w-20 h-2 rounded-full bg-bg-elevated/60 animate-pulse" />
    </div>
  );
}

// ---- Achievement card -------------------------------------------------------

interface AchievementCardProps {
  ach: MergedAchievement;
  index: number;
  unlockedAt: string | undefined;
}

function AchievementCard({ ach, index, unlockedAt }: AchievementCardProps) {
  const isUnlocked = !!unlockedAt;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 18, scale: 0.95 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            type: 'spring',
            damping: 22,
            stiffness: 320,
            delay: index * 0.04,
          },
        },
      }}
      className="relative flex flex-col items-center text-center gap-2 rounded-[12px] px-4 py-5 transition-opacity"
      style={{
        background: '#0f0f12',
        border: '1px solid rgba(255,255,255,0.06)',
        opacity: isUnlocked ? 1 : 0.4,
        filter: isUnlocked ? 'none' : 'grayscale(1)',
        ...(isUnlocked
          ? {
              boxShadow:
                'inset 0 2px 0 0 rgba(83,141,78,0.55), 0 1px 4px rgba(0,0,0,0.3)',
            }
          : {}),
      }}
    >
      {/* Lock overlay */}
      {!isUnlocked && (
        <div className="absolute top-2.5 right-2.5">
          <Lock size={11} className="text-text-ghost" />
        </div>
      )}

      {/* Icon */}
      <span
        className="text-[30px] leading-none"
        role="img"
        aria-label={ach.name}
      >
        {ach.icon}
      </span>

      {/* Name */}
      <span className="text-xs font-semibold text-text-primary leading-tight">
        {ach.name}
      </span>

      {/* Description */}
      <span className="text-[10px] text-text-secondary leading-snug">
        {ach.description}
      </span>

      {/* Unlocked date */}
      {isUnlocked && unlockedAt && (
        <span className="text-[9px] text-text-ghost mt-auto pt-0.5">
          {formatDate(unlockedAt)}
        </span>
      )}
    </motion.div>
  );
}

// ---- Page -------------------------------------------------------------------

export default function AchievementsPage() {
  const [allAchievements, setAllAchievements] = useState<AchievementDef[]>([]);
  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([achievementsApi.all(), achievementsApi.mine()])
      .then(([allRes, mineRes]) => {
        setAllAchievements(allRes.data);
        setUnlocked(mineRes.data);
      })
      .catch(() => setError('Failed to load achievements.'))
      .finally(() => setLoading(false));
  }, []);

  const unlockedMap = new Map(unlocked.map((u) => [u.type, u.unlocked_at]));

  // Merge server data with local ACHIEVEMENT_META for icons / descriptions
  const mergedAchievements: MergedAchievement[] = allAchievements.map((a) => {
    const meta = ACHIEVEMENT_META[a.type];
    return {
      type: a.type,
      name: a.name || meta?.name || a.type,
      description: a.description || meta?.description || '',
      icon: a.icon || meta?.icon || '🏆',
    };
  });

  const unlockedCount = unlocked.length;
  const totalCount = mergedAchievements.length;
  const progressPct = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  // ---- Render: loading ----
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-5 h-5 rounded bg-bg-elevated animate-pulse" />
            <div className="w-32 h-5 rounded bg-bg-elevated animate-pulse" />
          </div>
          <div className="w-20 h-3.5 rounded bg-bg-elevated/60 animate-pulse mt-1 mb-3" />
          <div className="h-1.5 w-48 rounded-full bg-bg-elevated animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="mb-6"
      >
        <div className="flex items-center gap-2.5 mb-0.5">
          <Trophy size={20} color="#c9a227" strokeWidth={1.8} aria-hidden="true" />
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Achievements
          </h1>
        </div>

        <p className="text-sm text-text-secondary mb-3">
          <span className="text-text-primary font-semibold">{unlockedCount}</span>
          <span className="text-text-ghost"> / {totalCount}</span>
          {' '}unlocked
        </p>

        {/* Progress bar */}
        <div
          className="relative h-1.5 max-w-[240px] rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.06)' }}
          role="progressbar"
          aria-valuenow={unlockedCount}
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-label={`${unlockedCount} of ${totalCount} achievements unlocked`}
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            style={{
              background:
                'linear-gradient(90deg, #a07a18 0%, #c9a227 50%, #e8c84a 100%)',
            }}
          />
        </div>
      </motion.div>

      {/* Error state */}
      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-[10px] text-sm"
          style={{
            background: 'rgba(231,76,60,0.08)',
            border: '1px solid rgba(231,76,60,0.2)',
            color: '#f87171',
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Grid */}
      {mergedAchievements.length > 0 ? (
        <motion.div
          variants={{ visible: stagger.medium }}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 sm:grid-cols-3 gap-3"
        >
          {mergedAchievements.map((ach, i) => (
            <AchievementCard
              key={ach.type}
              ach={ach}
              index={i}
              unlockedAt={unlockedMap.get(ach.type)}
            />
          ))}
        </motion.div>
      ) : (
        !error && (
          <div className="text-center py-20 text-text-secondary text-sm">
            No achievements found.
          </div>
        )
      )}
    </div>
  );
}
