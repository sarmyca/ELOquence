'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Delete } from 'lucide-react';
import GameTile from './Tile';
import type { LetterPickerChallenge } from './types';

/* Build-a-probe game. The user assembles a 5-letter sequence by tapping
 * letters on a keyboard. Letters known absent are disabled-gray. We grade
 * by checking whether their final string is in `validProbes` (a list of
 * acceptable probe words for the lesson).
 */

const ROW1 = 'QWERTYUIOP'.split('');
const ROW2 = 'ASDFGHJKL'.split('');
const ROW3 = 'ZXCVBNM'.split('');

export default function LetterPicker({
  challenge,
  onResolve,
}: {
  challenge: LetterPickerChallenge;
  onResolve: (correct: boolean) => void;
}) {
  const [draft, setDraft] = useState<string>('');
  const [outcome, setOutcome] = useState<'correct' | 'wrong' | null>(null);

  const absentSet = new Set(challenge.absent.map((c) => c.toUpperCase()));
  const knownSet = new Set(challenge.known.map((c) => c.toUpperCase()));

  function tapLetter(letter: string) {
    if (outcome === 'correct') return;
    if (draft.length >= 5) return;
    if (absentSet.has(letter)) return;
    setOutcome(null);
    setDraft((d) => d + letter);
  }

  function backspace() {
    if (outcome === 'correct') return;
    setOutcome(null);
    setDraft((d) => d.slice(0, -1));
  }

  function submit() {
    if (draft.length < 5) return;
    const valid = challenge.validProbes.map((w) => w.toUpperCase());
    const ok = valid.includes(draft);
    setOutcome(ok ? 'correct' : 'wrong');
    if (ok) setTimeout(() => onResolve(true), 1100);
  }

  function reset() {
    setDraft('');
    setOutcome(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0' }}>
      <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', margin: 0, textAlign: 'center', lineHeight: 1.4 }}>
        {challenge.prompt}
      </p>

      {/* Draft tiles */}
      <motion.div
        style={{ display: 'flex', gap: 6 }}
        animate={outcome === 'wrong' ? { x: [0, -6, 6, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
      >
        {Array.from({ length: 5 }).map((_, i) => {
          const letter = draft[i] || '';
          const state = outcome === 'correct' ? 'correct' : letter ? 'absent' : 'empty';
          return (
            <GameTile
              key={i}
              letter={letter}
              state={outcome === 'correct' ? 'correct' : 'empty'}
              size={54}
              highlight={Boolean(letter) && outcome !== 'correct'}
            />
          );
        })}
      </motion.div>

      {/* Keyboard */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', maxWidth: 480 }}>
        {[ROW1, ROW2, ROW3].map((row, ri) => (
          <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
            {ri === 2 && (
              <KeyButton onClick={backspace} dim>
                <Delete size={14} />
              </KeyButton>
            )}
            {row.map((letter) => {
              const isAbsent = absentSet.has(letter);
              const isKnown = knownSet.has(letter);
              const isUsed = draft.includes(letter);
              return (
                <KeyButton
                  key={letter}
                  onClick={() => tapLetter(letter)}
                  disabled={isAbsent}
                  state={
                    isAbsent ? 'absent' : isUsed ? 'used' : isKnown ? 'known' : 'normal'
                  }
                >
                  {letter}
                </KeyButton>
              );
            })}
            {ri === 2 && (
              <KeyButton onClick={submit} dim={draft.length < 5}>
                ✓
              </KeyButton>
            )}
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-ghost)', margin: 0 }}>
        Build any 5-letter probe. Grayed-out letters are already ruled out.
      </p>

      <AnimatePresence>
        {outcome && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 999,
              background:
                outcome === 'correct'
                  ? 'color-mix(in srgb, var(--tile-correct) 18%, transparent)'
                  : 'color-mix(in srgb, var(--cls-red) 18%, transparent)',
              color: outcome === 'correct' ? 'var(--tile-correct)' : 'var(--cls-red)',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {outcome === 'correct' ? <Check size={16} /> : <X size={16} />}
            {outcome === 'correct'
              ? challenge.successNote || 'Nice probe.'
              : 'That probe doesn’t score well — try one that tests more fresh letters'}
          </motion.div>
        )}
      </AnimatePresence>

      {outcome === 'wrong' && (
        <button
          type="button"
          onClick={reset}
          style={{
            padding: '8px 16px',
            borderRadius: 999,
            border: '1px solid var(--border-default)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

function KeyButton({
  children,
  onClick,
  disabled,
  dim,
  state = 'normal',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  dim?: boolean;
  state?: 'normal' | 'absent' | 'known' | 'used';
}) {
  let bg = 'var(--bg-elevated)';
  let color = 'var(--text-primary)';
  if (state === 'absent') {
    bg = 'var(--tile-absent)';
    color = '#fff';
  } else if (state === 'known') {
    bg = 'color-mix(in srgb, var(--tile-present) 30%, transparent)';
  } else if (state === 'used') {
    bg = 'color-mix(in srgb, var(--cls-blue, #3b82f6) 22%, transparent)';
  }
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={!disabled ? { scale: 0.92 } : undefined}
      style={{
        minWidth: 30,
        height: 38,
        padding: '0 6px',
        borderRadius: 6,
        border: 'none',
        background: bg,
        color,
        fontSize: 13,
        fontWeight: 700,
        fontFamily: 'var(--font-sans)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: dim ? 0.55 : 1,
        transition: 'all 200ms ease',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </motion.button>
  );
}
