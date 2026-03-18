'use client';
import { AnimatePresence, motion } from 'framer-motion';

interface ToastProps {
  message: string;
  visible: boolean;
}

export default function Toast({ message, visible }: ToastProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ type: 'spring', damping: 26, stiffness: 500, mass: 0.5 }}
          className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-lg bg-bg-elevated border border-white/[0.12] shadow-xl text-sm font-medium text-text-primary"
          role="alert"
          aria-live="assertive"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
