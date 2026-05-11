'use client';
import { useEffect, useRef } from 'react';
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
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const timer = setTimeout(() => dismissRef.current(), 4000 + index * 400);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ ...springs.snappy, delay: index * 0.12 }}
      className="relative overflow-hidden flex items-center gap-3 rounded-card-lg cursor-pointer select-none bg-bg-base border border-border-default"
      onClick={onDismiss}
      role="status"
      aria-live="polite"
      style={{
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        padding: '12px 16px 12px 0',
      }}
    >
      {/* Gold left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-card-lg"
        style={{ backgroundColor: 'var(--gold)' }}
      />

      {/* Shimmer sweep */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{ x: ['-110%', '200%'] }}
        transition={{ duration: 1.6, ease: 'easeInOut', delay: 0.25 }}
        style={{
          background:
            'linear-gradient(105deg, transparent 35%, rgba(201,162,39,0.06) 50%, transparent 65%)',
        }}
        aria-hidden="true"
      />

      {/* Spacer for left bar */}
      <div className="w-4 flex-shrink-0" aria-hidden="true" />

      {/* Icon */}
      <span
        className="text-[22px] leading-none flex-shrink-0"
        role="img"
        aria-label={achievement.name}
      >
        {achievement.icon}
      </span>

      {/* Text */}
      <div className="flex flex-col min-w-0">
        <span
          className="text-[10px] uppercase tracking-widest font-bold"
          style={{ color: 'var(--gold)' }}
        >
          Achievement Unlocked
        </span>
        <span className="font-display font-bold text-sm text-text-primary leading-tight truncate">
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
        <div
          className="pointer-events-none fixed top-[72px] left-1/2 -translate-x-1/2 z-[65] flex flex-col items-center gap-2"
          style={{ width: 288 }}
        >
          {achievements.map((ach, i) => (
            <div key={ach.type} className="pointer-events-auto w-full">
              <SingleToast achievement={ach} index={i} onDismiss={onDismiss} />
            </div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
