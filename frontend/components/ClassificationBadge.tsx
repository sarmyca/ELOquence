'use client';
import { motion } from 'framer-motion';
import { Classification, CLASSIFICATION_CONFIG } from '@/lib/types';
import clsx from 'clsx';

interface ClassificationBadgeProps {
  classification: Classification;
  size?: 'sm' | 'md';
  animate?: boolean;
}

export default function ClassificationBadge({
  classification,
  size = 'md',
  animate = false,
}: ClassificationBadgeProps) {
  const config = CLASSIFICATION_CONFIG[classification];

  const badge = (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      )}
      style={{
        color: config.color,
        backgroundColor: `${config.color}22`,
      }}
    >
      <span className="font-mono text-[10px] leading-none">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 12, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 22, stiffness: 400, mass: 0.5 }}
      >
        {badge}
      </motion.div>
    );
  }

  return badge;
}
