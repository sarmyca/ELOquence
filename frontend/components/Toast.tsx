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
          key="toast"
          initial={{ opacity: 0, y: -14, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ type: 'spring', damping: 26, stiffness: 500, mass: 0.5 }}
          className="pointer-events-none fixed top-[72px] left-1/2 -translate-x-1/2 z-[60]"
          role="alert"
          aria-live="assertive"
        >
          <div
            className="
              px-5 py-2.5
              rounded-full
              bg-[#27272e]
              border border-white/[0.06]
              shadow-elevated
              text-sm font-semibold text-text-primary
              whitespace-nowrap
              select-none
            "
          >
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
