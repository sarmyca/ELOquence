'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import GameTile from './Tile';
import type { GuessTheNextChallenge } from './types';

/* Same as multiple-choice but with a board history above the options.
 * Used for "given this game state, what should you play next?" challenges
 * which need more context than a stand-alone MC card.
 */

export default function GuessTheNext({
  challenge,
  onResolve,
}: {
  challenge: GuessTheNextChallenge;
  onResolve: (correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);

  function handlePick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    setTimeout(() => onResolve(i === challenge.correctIdx), i === challenge.correctIdx ? 1300 : 1300);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '8px 0' }}>
      <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', margin: 0, textAlign: 'center', lineHeight: 1.4 }}>
        {challenge.prompt}
      </p>

      {/* Game board so far */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: 14,
          borderRadius: 12,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {challenge.history.map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: 4 }}>
            {row.guess.split('').map((letter, idx) => (
              <GameTile key={idx} letter={letter} state={row.pattern[idx]} size={42} />
            ))}
          </div>
        ))}
        {/* Show one empty row as "next guess?" */}
        <div style={{ display: 'flex', gap: 4, opacity: 0.4 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <GameTile key={i} letter="" state="empty" size={42} />
          ))}
        </div>
      </div>

      {/* Candidate next guesses */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
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
                padding: '12px 14px',
                cursor: picked === null ? 'pointer' : 'default',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                transition: 'all 250ms ease',
                opacity: picked !== null && !isPicked && !revealCorrectAfterWrong ? 0.55 : 1,
              }}
            >
              <div style={{ display: 'flex', gap: 3 }}>
                {opt.word.split('').map((letter, idx) => (
                  <GameTile
                    key={idx}
                    letter={letter}
                    state={
                      (isRightlyPicked || revealCorrectAfterWrong) && opt.revealPattern
                        ? opt.revealPattern[idx]
                        : 'empty'
                    }
                    size={32}
                  />
                ))}
              </div>
              {opt.sub && (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{opt.sub}</span>
              )}
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
        {picked !== null && picked === challenge.correctIdx && challenge.successNote && (
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
