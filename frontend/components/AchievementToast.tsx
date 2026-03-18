'use client';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { springs } from '@/lib/animations';

export const ACHIEVEMENT_META: Record<
  string,
  { name: string; description: string; icon: string }
> = {
  first_90_accuracy: {
    name: 'Sharpshooter',
    description: 'Achieve 90%+ accuracy',
    icon: '🎯',
  },
  first_95_accuracy: {
    name: 'Precision',
    description: 'Achieve 95%+ accuracy',
    icon: '💎',
  },
  first_100_accuracy: {
    name: 'Perfect',
    description: 'Achieve 100% accuracy',
    icon: '👑',
  },
  first_brilliant: {
    name: 'Eureka',
    description: 'First Brilliant move',
    icon: '💡',
  },
  ten_brilliants: {
    name: 'Mastermind',
    description: '10 Brilliant moves',
    icon: '🧠',
  },
  perfectionist: {
    name: 'Perfectionist',
    description: 'All Best/Brilliant game',
    icon: '⭐',
  },
  streak_7: {
    name: 'On Fire',
    description: '7-day streak',
    icon: '🔥',
  },
  streak_30: {
    name: 'Dedicated',
    description: '30-day streak',
    icon: '📅',
  },
  streak_100: {
    name: 'Unstoppable',
    description: '100-day streak',
    icon: '🏆',
  },
  reach_veteran: {
    name: 'Veteran',
    description: 'Reach 1200 ELO',
    icon: '⚔️',
  },
  reach_master: {
    name: 'Master',
    description: 'Reach 1400 ELO',
    icon: '🏅',
  },
  reach_grandmaster: {
    name: 'Grandmaster',
    description: 'Reach 1600 ELO',
    icon: '👊',
  },
  underdog: {
    name: 'Underdog',
    description: 'Beat word 300+ above',
    icon: '💪',
  },
  climber: {
    name: 'Climber',
    description: '+200 ELO gained',
    icon: '📈',
  },
};

interface AchievementToastProps {
  achievements: Array<{ type: string; name: string; icon: string }>;
  onDismiss: () => void;
}

function SingleToast({
  achievement,
  index,
  onDismiss,
}: {
  achievement: { type: string; name: string; icon: string };
  index: number;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -24, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.95 }}
      transition={{ ...springs.snappy, delay: index * 0.12 }}
      className="relative overflow-hidden flex items-center gap-3 bg-bg-elevated border border-[#c9a227]/30 rounded-xl px-4 py-3 shadow-2xl cursor-pointer"
      onClick={onDismiss}
      role="status"
      aria-live="polite"
      style={{
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(201,162,39,0.15)',
      }}
    >
      {/* Gold shimmer overlay */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-xl"
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 1.8, ease: 'easeInOut', delay: 0.2 }}
        style={{
          background:
            'linear-gradient(105deg, transparent 40%, rgba(201,162,39,0.12) 50%, transparent 60%)',
        }}
      />

      {/* Icon */}
      <span className="text-2xl leading-none flex-shrink-0" role="img" aria-label={achievement.name}>
        {achievement.icon}
      </span>

      {/* Text */}
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-[#c9a227]">
          Achievement Unlocked!
        </span>
        <span className="text-sm font-bold text-text-primary leading-tight truncate">
          {achievement.name}
        </span>
      </div>
    </motion.div>
  );
}

export default function AchievementToast({
  achievements,
  onDismiss,
}: AchievementToastProps) {
  return (
    <AnimatePresence>
      {achievements.length > 0 && (
        <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 w-72">
          {achievements.map((ach, i) => (
            <div key={ach.type} className="pointer-events-auto w-full">
              <SingleToast
                achievement={ach}
                index={i}
                onDismiss={onDismiss}
              />
            </div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
