'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ChevronRight, RefreshCcw, X } from 'lucide-react';
import TileTap from './TileTap';
import TilePaint from './TilePaint';
import MultipleChoice from './MultipleChoice';
import GuessTheNext from './GuessTheNext';
import RevealCard from './RevealCard';
import WordSurvivors from './WordSurvivors';
import SortIntoBuckets from './SortIntoBuckets';
import PoolShrink from './PoolShrink';
import LetterPicker from './LetterPicker';
import Confetti from './Confetti';
import type { Challenge, Lesson } from './types';

/* Orchestrates a sequence of mini-challenges that make up one lesson.
 *
 * Flow:
 *   1. User sees the first challenge.
 *   2. Each challenge calls `onResolve(correct: boolean)`.
 *   3. If correct → confetti + advance to next.
 *   4. If wrong → child handles its own feedback; we wait for it to
 *      re-resolve. Optional "hearts" mechanic: each wrong burns a heart;
 *      0 hearts → lesson restarts (TODO future).
 *   5. After last challenge → success screen with XP gain + Continue.
 */

interface Props {
  lesson: Lesson;
  onComplete: () => void;
  /** Called after every successful challenge with the new high-water mark
   *  of completed challenges in this lesson. Parent persists for colour-coding. */
  onProgress?: (challengesCompleted: number) => void;
}

function ChallengeView({ challenge, onResolve }: { challenge: Challenge; onResolve: (correct: boolean) => void }) {
  switch (challenge.kind) {
    case 'tile-tap':
      return <TileTap challenge={challenge} onResolve={onResolve} />;
    case 'tile-paint':
      return <TilePaint challenge={challenge} onResolve={onResolve} />;
    case 'multiple-choice':
      return <MultipleChoice challenge={challenge} onResolve={onResolve} />;
    case 'guess-next':
      return <GuessTheNext challenge={challenge} onResolve={onResolve} />;
    case 'reveal':
      return <RevealCard challenge={challenge} onResolve={onResolve} />;
    case 'word-survivors':
      return <WordSurvivors challenge={challenge} onResolve={onResolve} />;
    case 'sort-buckets':
      return <SortIntoBuckets challenge={challenge} onResolve={onResolve} />;
    case 'pool-shrink':
      return <PoolShrink challenge={challenge} onResolve={onResolve} />;
    case 'letter-picker':
      return <LetterPicker challenge={challenge} onResolve={onResolve} />;
  }
}

export default function LessonRunner({ lesson, onComplete, onProgress }: Props) {
  const [idx, setIdx] = useState(0);
  const [confettiTick, setConfettiTick] = useState(0);
  const [done, setDone] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const total = lesson.challenges.length;
  const current = lesson.challenges[idx];

  // Reset state when the lesson changes (e.g. navigation back to it).
  useEffect(() => {
    setIdx(0);
    setDone(false);
    setCorrectCount(0);
  }, [lesson.id]);

  const handleResolve = useCallback(
    (correct: boolean) => {
      if (correct) {
        setConfettiTick((t) => t + 1);
        setCorrectCount((c) => {
          const next = c + 1;
          // Report to parent so it can persist partial progress for colouring.
          onProgress?.(next);
          return next;
        });
        // Advance after a brief beat — long enough to read confetti
        setTimeout(() => {
          if (idx + 1 >= total) {
            setDone(true);
          } else {
            setIdx((i) => i + 1);
          }
        }, 850);
      }
      // Wrong: child handles its own retry UI; runner does nothing.
    },
    [idx, total, onProgress],
  );

  function restart() {
    setIdx(0);
    setDone(false);
    setCorrectCount(0);
  }

  // ── Done screen ────────────────────────────────────────────────
  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          padding: '24px 8px',
          textAlign: 'center',
        }}
      >
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1], delay: 0.1 }}
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'var(--tile-correct)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px color-mix(in srgb, var(--tile-correct) 40%, transparent)',
          }}
        >
          <Trophy size={40} color="#fff" />
        </motion.div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, margin: 0 }}>
          Lesson complete
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, maxWidth: 360 }}>
          {correctCount} / {total} on first try
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            type="button"
            onClick={restart}
            style={{
              padding: '8px 18px',
              borderRadius: 999,
              border: '1px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RefreshCcw size={14} /> Practice again
          </button>
          <button
            type="button"
            onClick={onComplete}
            style={{
              padding: '8px 22px',
              borderRadius: 999,
              border: 'none',
              background: 'var(--tile-correct)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Next lesson <ChevronRight size={16} />
          </button>
        </div>
      </motion.div>
    );
  }

  // ── Active challenge ──────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'relative' }}>
      {/* Top bar — progress + streak + close */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onComplete}
          aria-label="Close lesson"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-ghost)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
          }}
        >
          <X size={20} />
        </button>
        <div
          style={{
            flex: 1,
            height: 10,
            borderRadius: 999,
            background: 'var(--bg-muted)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${((idx + (done ? 1 : 0)) / total) * 100}%` }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{
              height: '100%',
              background: 'var(--tile-correct)',
              borderRadius: 999,
            }}
          />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-ghost)', fontFamily: 'var(--font-display)', fontWeight: 700, minWidth: 36, textAlign: 'right' }}>
          {idx + 1}/{total}
        </span>
      </div>

      {/* Challenge body */}
      <div style={{ position: 'relative', minHeight: 360 }}>
        <Confetti trigger={confettiTick} />
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <ChallengeView challenge={current} onResolve={handleResolve} />
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  );
}
