'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import GameTile from './Tile';
import type { MultipleChoiceChallenge } from './types';

/* Pick the best option among 2-4 cards. Each card optionally shows a
 * mini tile-row preview. Selecting wrong: card shakes red, correct card
 * gets a brief tick. Selecting right: card glows green + confetti
 * triggered by the parent runner. */

export default function MultipleChoice({
  challenge,
  onResolve,
}: {
  challenge: MultipleChoiceChallenge;
  onResolve: (correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const ok = picked === challenge.correctIdx;

  function handlePick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    setTimeout(() => onResolve(i === challenge.correctIdx), i === challenge.correctIdx ? 1100 : 1300);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, padding: '8px 0' }}>
      <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', margin: 0, textAlign: 'center', lineHeight: 1.4 }}>
        {challenge.prompt}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: challenge.options.length <= 2 ? '1fr 1fr' : 'repeat(2, 1fr)',
          gap: 12,
          width: '100%',
          maxWidth: 540,
        }}
      >
        {challenge.options.map((opt, i) => {
          const isPicked = picked === i;
          const isRightlyPicked = isPicked && i === challenge.correctIdx;
          const isWronglyPicked = isPicked && i !== challenge.correctIdx;
          const revealCorrectAfterWrong = picked !== null && i === challenge.correctIdx && !isPicked;

          return (
            <motion.button
              key={i}
              type="button"
              onClick={() => handlePick(i)}
              disabled={picked !== null}
              whileHover={picked === null ? { y: -2 } : undefined}
              whileTap={picked === null ? { scale: 0.97 } : undefined}
              animate={isWronglyPicked ? { x: [0, -4, 4, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                position: 'relative',
                background: 'var(--bg-elevated)',
                border: `2px solid ${
                  isRightlyPicked
                    ? 'var(--tile-correct)'
                    : isWronglyPicked
                      ? 'var(--cls-red)'
                      : revealCorrectAfterWrong
                        ? 'var(--tile-correct)'
                        : 'var(--border-subtle)'
                }`,
                borderRadius: 12,
                padding: '14px 16px',
                cursor: picked === null ? 'pointer' : 'default',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'border-color 250ms ease, background-color 250ms ease',
                opacity: picked !== null && !isPicked && !revealCorrectAfterWrong ? 0.55 : 1,
              }}
            >
              {(opt.word && opt.pattern) && (
                <div style={{ display: 'flex', gap: 4 }}>
                  {opt.word.split('').map((letter, idx) => (
                    <GameTile
                      key={idx}
                      letter={letter}
                      state={opt.pattern![idx]}
                      size={36}
                    />
                  ))}
                </div>
              )}
              {(opt.word && !opt.pattern) && (
                <div style={{ display: 'flex', gap: 4 }}>
                  {opt.word.split('').map((letter, idx) => (
                    <GameTile key={idx} letter={letter} state="empty" size={36} />
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{opt.label}</span>
                {opt.sub && (
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{opt.sub}</span>
                )}
              </div>
              {(isRightlyPicked || revealCorrectAfterWrong) && (
                <span
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'var(--tile-correct)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={14} color="#fff" strokeWidth={3} />
                </span>
              )}
              {isWronglyPicked && (
                <span
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'var(--cls-red)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={14} color="#fff" strokeWidth={3} />
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {picked !== null && challenge.successNote && ok && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              maxWidth: 520,
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            {challenge.successNote}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
