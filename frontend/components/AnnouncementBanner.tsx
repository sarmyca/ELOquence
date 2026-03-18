'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { announcementsApi } from '@/lib/api';

interface ActiveAnnouncement {
  id: string;
  text: string;
}

const SESSION_KEY = 'eloquence_announcements_dismissed';

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<ActiveAnnouncement[]>([]);
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check sessionStorage dismissal
    if (typeof window !== 'undefined') {
      const storedDismissed = sessionStorage.getItem(SESSION_KEY);
      if (storedDismissed === 'true') {
        setDismissed(true);
        return;
      }
    }
    announcementsApi
      .active()
      .then((res) => {
        const data: ActiveAnnouncement[] = res.data;
        if (data && data.length > 0) {
          setAnnouncements(data);
          setVisible(true);
        }
      })
      .catch(() => {
        // Silent fail — banner is non-critical
      });
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, 'true');
    }
    // Remove from state after exit animation
    setTimeout(() => setDismissed(true), 300);
  }, []);

  const handlePrev = () => {
    setIndex((i) => (i - 1 + announcements.length) % announcements.length);
  };

  const handleNext = () => {
    setIndex((i) => (i + 1) % announcements.length);
  };

  if (dismissed || announcements.length === 0) return null;

  const currentText = announcements[index]?.text ?? '';
  const showNav = announcements.length > 1;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          className="overflow-hidden"
        >
          <div className="bg-[#1565c0]/10 border-b border-[#1565c0]/20 px-4 py-2 flex items-center gap-3">
            {/* Icon */}
            <Info size={13} className="text-[#6aaa64] flex-shrink-0" />

            {/* Text */}
            <AnimatePresence mode="wait">
              <motion.p
                key={index}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="flex-1 text-xs text-[#6aaa64] leading-relaxed"
              >
                {currentText}
              </motion.p>
            </AnimatePresence>

            {/* Nav arrows (multiple announcements) */}
            {showNav && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={handlePrev}
                  className="p-0.5 rounded text-[#6aaa64]/60 hover:text-[#6aaa64] transition-colors"
                  aria-label="Previous announcement"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[10px] text-[#6aaa64]/60 tabular-nums">
                  {index + 1}/{announcements.length}
                </span>
                <button
                  onClick={handleNext}
                  className="p-0.5 rounded text-[#6aaa64]/60 hover:text-[#6aaa64] transition-colors"
                  aria-label="Next announcement"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-0.5 rounded text-[#6aaa64]/50 hover:text-[#6aaa64] transition-colors"
              aria-label="Dismiss announcement"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
