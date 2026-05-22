'use client';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { springs } from '@/lib/animations';

export const ACHIEVEMENT_META: Record<
  string,
  { name: string; description: string; icon: string }
> = {
  // Solving
  first_win:    { name: 'First Win',    description: 'Solve your first puzzle',       icon: '🏁' },
  quick_solve:  { name: 'Quick Solve',  description: 'Win in 3 guesses or fewer',     icon: '⚡' },
  bullseye:     { name: 'Bullseye',     description: 'Win in 2 guesses',              icon: '🎯' },
  hole_in_one:  { name: 'Hole in One',  description: 'Win in 1 guess',                icon: '🏆' },
  last_chance:  { name: 'Last Chance',  description: 'Win on your 6th guess',         icon: '🛡' },

  // Accuracy
  sharpshooter: { name: 'Sharpshooter', description: 'Hit 90%+ accuracy in a game',   icon: '🎯' },
  precision:    { name: 'Precision',    description: 'Hit 95%+ accuracy in a game',   icon: '💎' },
  perfect_game: { name: 'Perfect Game', description: 'Hit 100% accuracy in a game',   icon: '✨' },

  // Streaks
  streak_7:     { name: 'On Fire',     description: '7-day daily streak',             icon: '🔥' },
  streak_30:    { name: 'Dedicated',   description: '30-day daily streak',            icon: '📅' },
  streak_100:   { name: 'Unstoppable', description: '100-day daily streak',           icon: '🏆' },

  // Rating
  reach_veteran:     { name: 'Veteran',     description: 'Reach 1200 ELO',                 icon: '⚔️' },
  reach_master:      { name: 'Master',      description: 'Reach 1400 ELO',                 icon: '🏅' },
  reach_grandmaster: { name: 'Grandmaster', description: 'Reach 1600 ELO',                 icon: '👑' },
  upset:             { name: 'Upset',       description: 'Beat a word 200+ ELO above you', icon: '📈' },

  // Variety
  regular:        { name: 'Regular',        description: 'Play 25 games',                                icon: '🎮' },
  dedicated_100:  { name: 'Centurion',      description: 'Play 100 games',                               icon: '💯' },
  marathon:       { name: 'Marathon',       description: 'Play 200 games',                               icon: '🏃' },
  legend_500:     { name: 'Legend',         description: 'Play 500 games',                               icon: '🌟' },
  triathlete:     { name: 'Triathlete',     description: 'Play Daily, Competitive, and Practice',        icon: '🎲' },
  all_modes_won:  { name: 'Complete Set',   description: 'Win in every game mode',                       icon: '🃏' },
  trendsetter:    { name: 'Trendsetter',    description: 'Create 5 challenges',                          icon: '📤' },
  daily_devotee:  { name: 'Daily Devotee',  description: 'Solve 30 daily puzzles',                       icon: '📆' },
  daily_marathon: { name: 'Daily Marathon', description: 'Solve 100 daily puzzles',                      icon: '🗓️' },
  three_master:   { name: 'Three Master',   description: 'Win in exactly 3 guesses 25 times',            icon: '3️⃣' },

  // Mastery
  brilliant_play:     { name: 'Brilliant',         description: 'Land a brilliant move in a win',           icon: '🌠' },
  flawless:           { name: 'Flawless',          description: 'Win with no blunders or mistakes',         icon: '🪶' },
  clean_play:         { name: 'Clean Play',        description: 'Win with no constraint violations',        icon: '🧹' },
  hardcore:           { name: 'Hardcore',          description: 'Win 10 hard-mode games',                   icon: '🛡️' },
  iron_will:          { name: 'Iron Will',         description: 'Win 50 hard-mode games',                   icon: '⚒️' },
  challenge_winner:   { name: 'Challenge Master',  description: 'Win 10 challenges',                        icon: '🤝' },
  hardword_hunter:    { name: 'Hardword Hunter',   description: 'Beat 10 words rated 1600+',                icon: '🗡️' },
  placement_complete: { name: 'Calibrated',        description: 'Finish all 5 placement games',             icon: '🎓' },
  accuracy_iron:      { name: 'Iron Accuracy',     description: 'Score 85%+ in 5 games in a row',           icon: '📐' },

  // Timing
  speedster:   { name: 'Speedster',  description: 'Win a game in under 60 seconds', icon: '⚡' },
  blitz:       { name: 'Blitz',      description: 'Win a game in under 30 seconds', icon: '💨' },
  early_bird:  { name: 'Early Bird', description: 'Win 10 games before 9 AM',       icon: '🌅' },
  night_owl:   { name: 'Night Owl',  description: 'Win 10 games after 9 PM',        icon: '🌙' },
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
