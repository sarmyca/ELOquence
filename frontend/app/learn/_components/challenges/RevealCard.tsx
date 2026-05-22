'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import GameTile from './Tile';
import type { RevealCardChallenge } from './types';

/* No question — just an animated reveal of a key idea. User reads it,
 * presses Got it, advances. Used sparingly to deliver a fact between
 * interactive beats. */

export default function RevealCard({
  challenge,
  onResolve,
}: {
  challenge: RevealCardChallenge;
  onResolve: (correct: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, padding: '8px 0' }}>
      <motion.h3
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: 0,
          textAlign: 'center',
        }}
      >
        {challenge.title}
      </motion.h3>

      {challenge.guess && challenge.pattern && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          style={{ display: 'flex', gap: 6 }}
        >
          {challenge.guess.split('').map((letter, i) => (
            <GameTile key={i} letter={letter} state={challenge.pattern![i]} size={56} />
          ))}
        </motion.div>
      )}

      {challenge.target && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{ fontSize: 11, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          {challenge.guess ? `vs ${challenge.target}` : challenge.target}
        </motion.span>
      )}

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        style={{
          fontSize: 14,
          color: 'var(--text-secondary)',
          lineHeight: 1.55,
          textAlign: 'center',
          maxWidth: 480,
          margin: 0,
        }}
      >
        {challenge.body}
      </motion.p>

      <motion.button
        type="button"
        onClick={() => onResolve(true)}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.35 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 22px',
          borderRadius: 999,
          border: 'none',
          background: 'var(--tile-correct)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Got it <ArrowRight size={16} />
      </motion.button>
    </div>
  );
}
