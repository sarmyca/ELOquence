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

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
        <div className="w-6 h-6 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
      </div>
    );
  }

  // Merge server data with local ACHIEVEMENT_META for icons/descriptions
  const mergedAchievements = allAchievements.map((a) => {
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-1">
          <Trophy size={22} className="text-[#c9a227]" />
          <h1 className="text-2xl font-bold text-text-primary">Achievements</h1>
        </div>
        <p className="text-sm text-text-secondary">
          {unlockedCount} / {totalCount} unlocked
        </p>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full max-w-xs bg-bg-tertiary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#c9a227] rounded-full"
            initial={{ width: 0 }}
            animate={{
              width: totalCount > 0 ? `${(unlockedCount / totalCount) * 100}%` : '0%',
            }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          />
        </div>
      </motion.div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Achievement grid */}
      <motion.div
        variants={{ visible: stagger.medium }}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
      >
        {mergedAchievements.map((ach, i) => {
          const unlockedAt = unlockedMap.get(ach.type);
          const isUnlocked = !!unlockedAt;

          return (
            <motion.div
              key={ach.type}
              variants={{
                hidden: { opacity: 0, y: 16, scale: 0.96 },
                visible: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    type: 'spring',
                    damping: 22,
                    stiffness: 350,
                    delay: i * 0.04,
                  },
                },
              }}
              className={`relative flex flex-col items-center text-center gap-2 rounded-2xl border px-3 py-4 transition-colors ${
                isUnlocked
                  ? 'bg-bg-secondary border-white/[0.1] opacity-100'
                  : 'bg-bg-tertiary/50 border-white/[0.04] opacity-50 grayscale'
              }`}
            >
              {/* Lock icon overlay for locked achievements */}
              {!isUnlocked && (
                <div className="absolute top-2 right-2">
                  <Lock size={12} className="text-text-ghost" />
                </div>
              )}

              {/* Icon */}
              <span className="text-3xl leading-none" role="img" aria-label={ach.name}>
                {ach.icon}
              </span>

              {/* Name */}
              <span className="text-xs font-semibold text-text-primary leading-tight">
                {ach.name}
              </span>

              {/* Description */}
              <span className="text-[10px] text-text-secondary leading-tight">
                {ach.description}
              </span>

              {/* Unlocked date */}
              {isUnlocked && unlockedAt && (
                <span className="text-[10px] text-text-ghost mt-auto">
                  {formatDate(unlockedAt)}
                </span>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      {mergedAchievements.length === 0 && !error && (
        <div className="text-center py-16 text-text-secondary text-sm">
          No achievements found.
        </div>
      )}
    </div>
  );
}
