'use client';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { TileState } from '@/lib/types';
import clsx from 'clsx';

interface KeyboardProps {
  onKey: (key: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
  letterStates: Record<string, TileState>;
}

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
];

const KEY_STATE_STYLES: Record<string, string> = {
  correct: 'bg-[#538d4e] text-white',
  present: 'bg-[#b59f3b] text-white',
  absent:  'bg-[#25252a] text-[#5c5c66]',
  unused:  'bg-[#3c3c44] text-white',
};

export default function Keyboard({
  onKey,
  onEnter,
  onBackspace,
  letterStates,
}: KeyboardProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toUpperCase();
      if (key === 'ENTER') {
        onEnter();
      } else if (key === 'BACKSPACE') {
        onBackspace();
      } else if (/^[A-Z]$/.test(key)) {
        onKey(key);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onKey, onEnter, onBackspace]);

  const getKeyStyle = (key: string): string => {
    if (key === 'ENTER' || key === 'BACK') return KEY_STATE_STYLES.unused;
    const state = letterStates[key];
    return KEY_STATE_STYLES[state] ?? KEY_STATE_STYLES.unused;
  };

  return (
    <div className="flex flex-col items-center w-full max-w-[500px]" style={{ gap: '5px' }}>
      {ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="flex w-full justify-center" style={{ gap: '5px' }}>
          {row.map((key) => {
            const isSpecial = key === 'ENTER' || key === 'BACK';
            return (
              <motion.button
                key={key}
                whileHover={{ filter: 'brightness(1.10)' }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', damping: 30, stiffness: 700, mass: 0.3 }}
                onClick={() => {
                  if (key === 'ENTER') onEnter();
                  else if (key === 'BACK') onBackspace();
                  else onKey(key);
                }}
                className={clsx(
                  'flex items-center justify-center rounded-[6px] font-bold text-sm select-none cursor-pointer transition-colors duration-100',
                  isSpecial ? 'flex-[1.5] text-xs' : 'flex-1',
                  getKeyStyle(key)
                )}
                style={{
                  height: 'var(--key-height)',
                  minWidth: isSpecial ? '54px' : '30px',
                }}
                aria-label={key === 'BACK' ? 'Backspace' : key}
              >
                {key === 'BACK' ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                    <line x1="18" y1="9" x2="13" y2="14" />
                    <line x1="13" y1="9" x2="18" y2="14" />
                  </svg>
                ) : (
                  key
                )}
              </motion.button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
