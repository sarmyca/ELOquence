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
 * Backdrop: rgba(255,255,255,0.5) light / rgba(0,0,0,0.6) dark + backdrop-blur.
 * Card: bg-bg-base, 1px border-subtle, heavy shadow.
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
          {/* Backdrop — light: translucent white blur, dark: dark blur */}
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-50 backdrop-blur-sm"
            style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}
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
              exit={{ opacity: 0, scale: 0.93, y: 14 }}
              transition={springs.modal}
              className={`pointer-events-auto relative w-full ${maxWidth} rounded-card-lg overflow-hidden`}
              style={{
                backgroundColor: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              {!hideClose && onClose && (
                <button
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="absolute top-3.5 right-3.5 z-10 p-1.5 rounded-lg transition-colors duration-150"
                  style={{
                    color: 'var(--text-tertiary)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-muted)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)';
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }}
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
