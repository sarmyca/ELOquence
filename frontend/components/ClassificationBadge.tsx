'use client';
import { motion } from 'framer-motion';
import { Classification, CLASSIFICATION_CONFIG } from '@/lib/types';
import clsx from 'clsx';

interface ClassificationBadgeProps {
  classification: Classification;
  size?: 'sm' | 'md';
  animate?: boolean;
}

/**
 * Returns relative luminance of an sRGB hex color (0–1).
 * Used to pick white vs dark text for WCAG contrast.
 */
function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const linearize = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Picks white (#fff) or dark (#1a1a1b) text to maintain >= 4.5:1 contrast
 * against the given background hex color.
 */
function accessibleTextColor(bgHex: string): string {
  const lum = relativeLuminance(bgHex);
  // Contrast ratio vs white: (1 + 0.05) / (lum + 0.05)
  // Contrast ratio vs dark:  (lum + 0.05) / (0.008 + 0.05) [~#1a1a1b]
  const contrastWhite = (1.05) / (lum + 0.05);
  const contrastDark  = (lum + 0.05) / (0.058);
  return contrastWhite >= contrastDark ? '#ffffff' : '#1a1a1b';
}

export default function ClassificationBadge({
  classification,
  size = 'md',
  animate = false,
}: ClassificationBadgeProps) {
  const config = CLASSIFICATION_CONFIG[classification];
  const textColor = accessibleTextColor(config.color);

  const badge = (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap uppercase tracking-wider',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      )}
      style={{
        color: textColor,
        backgroundColor: config.color,
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
