'use client';
import { ReactNode, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { springs } from '@/lib/animations';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  /** Max width Tailwind class, defaults to max-w-sm */
  maxWidth?: string;
  /** Hide the default close button */
  hideClose?: boolean;
  /** aria-label for the dialog */
  label?: string;
}

/**
 * General-purpose modal with AnimatePresence enter/exit.
 * Backdrop: bg-black/60 backdrop-blur-sm.
 * Card: bg-[#1d1d21] rounded-[16px] border border-white/[0.06].
 *
 * Usage:
 *   <Modal open={open} onClose={() => setOpen(false)}>
 *     <p>Content here</p>
 *   </Modal>
 */
export default function Modal({
  open,
  onClose,
  children,
  maxWidth = 'max-w-sm',
  hideClose = false,
  label = 'Dialog',
}: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Trap focus and handle Escape
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => onClose?.()}
          />

          {/* Centered content layer */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <motion.div
              ref={cardRef}
              key="modal-card"
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 10 }}
              transition={springs.modal}
              className={`
                pointer-events-auto relative w-full ${maxWidth}
                bg-[#1d1d21]
                rounded-[16px]
                border border-white/[0.06]
                shadow-modal
                overflow-hidden
              `}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              {!hideClose && onClose && (
                <button
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="
                    absolute top-3.5 right-3.5 z-10
                    p-1.5 rounded-lg
                    text-text-ghost hover:text-text-secondary
                    hover:bg-white/[0.06]
                    transition-colors duration-150
                  "
                >
                  <X size={15} />
                </button>
              )}

              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
