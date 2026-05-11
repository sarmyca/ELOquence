export const springs = {
  snappy: { type: 'spring' as const, damping: 26, stiffness: 500, mass: 0.5 },
  celebration: { type: 'spring' as const, damping: 8, stiffness: 180, mass: 1 },
  modal: { type: 'spring' as const, damping: 25, stiffness: 300, mass: 1 },
  page: { type: 'spring' as const, damping: 30, stiffness: 200, mass: 1.2 },
  slide: { type: 'spring' as const, damping: 28, stiffness: 350, mass: 0.8 },
};

export const easings = {
  fade: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const },
};

export const stagger = {
  fast: { staggerChildren: 0.05, delayChildren: 0.1 },
  medium: { staggerChildren: 0.08, delayChildren: 0.15 },
  slow: { staggerChildren: 0.12, delayChildren: 0.2 },
};
