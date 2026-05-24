'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { springs } from '@/lib/animations';

// One-time "how to play Wordle" intro for people who've never seen the game.
// Shown once per device the first time someone lands on the play screen, then
// silenced via localStorage. Reuses the app's modal aesthetic.
const SEEN_KEY = 'eloquence_tutorial_seen';

type TileState = 'correct' | 'present' | 'absent';

function Tile({ ch, state, size = 40 }: { ch: string; state: TileState; size?: number }) {
  const bg =
    state === 'correct'
      ? 'var(--tile-correct)'
      : state === 'present'
      ? 'var(--tile-present)'
      : 'var(--tile-absent)';
  return (
    <span
      className="inline-flex items-center justify-center rounded-md font-display font-black text-white select-none"
      style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.5 }}
    >
      {ch}
    </span>
  );
}

interface Step {
  title: string;
  body: string;
  visual: React.ReactNode;
}

const STEPS: Step[] = [
  {
    title: 'Guess the word',
    body: 'ELOquence is Wordle. Find the hidden 5-letter word in 6 tries. Type any real word to make a guess.',
    visual: (
      <div className="flex gap-1.5">
        {'GUESS'.split('').map((c, i) => (
          <span
            key={i}
            className="inline-flex items-center justify-center rounded-md font-display font-black"
            style={{
              width: 40,
              height: 40,
              fontSize: 20,
              border: '2px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
          >
            {c}
          </span>
        ))}
      </div>
    ),
  },
  {
    title: 'Read the colours',
    body: 'After each guess the tiles change colour to tell you how close you are.',
    visual: (
      <div className="flex flex-col gap-3 w-full">
        {([
          ['R', 'correct', 'Right letter, right spot.'],
          ['O', 'present', 'In the word — but wrong spot.'],
          ['T', 'absent', 'Not in the word at all.'],
        ] as [string, TileState, string][]).map(([ch, state, label]) => (
          <div key={ch} className="flex items-center gap-3">
            <Tile ch={ch} state={state} />
            <span className="text-sm font-sans" style={{ color: 'var(--text-secondary)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Narrow it down',
    body: 'Use the clues to rule words out, then land the answer before your six guesses run out. That’s the whole game.',
    visual: (
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-1.5">
          {([
            ['S', 'absent'], ['L', 'absent'], ['A', 'present'], ['T', 'absent'], ['E', 'correct'],
          ] as [string, TileState][]).map(([c, s], i) => (
            <Tile key={i} ch={c} state={s} size={36} />
          ))}
        </div>
        <div className="flex gap-1.5">
          {([
            ['A', 'present'], ['B', 'absent'], ['I', 'correct'], ['D', 'absent'], ['E', 'correct'],
          ] as [string, TileState][]).map(([c, s], i) => (
            <Tile key={i} ch={c} state={s} size={36} />
          ))}
        </div>
      </div>
    ),
  },
];

export default function FirstTimeTutorial() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY) == null) setOpen(true);
    } catch {
      // private mode / quota — just don't show
    }
  }, []);

  const close = useCallback(() => {
    try {
      localStorage.setItem(SEEN_KEY, String(Date.now()));
    } catch {
      // best effort
    }
    setOpen(false);
  }, []);

  const isLast = step >= STEPS.length - 1;
  const next = () => (isLast ? close() : setStep((s) => s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const current = STEPS[step];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
            onClick={close}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={springs.modal}
              role="dialog"
              aria-modal="true"
              aria-label="How to play"
              className="w-full max-w-sm rounded-card-lg border border-border-default bg-bg-base shadow-modal overflow-hidden"
            >
              {/* Wordle-green top rule */}
              <div className="h-[3px] w-full bg-tile-correct" />

              <div className="p-6 flex flex-col gap-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                      New to Wordle? · {step + 1}/{STEPS.length}
                    </p>
                    <h2 className="text-lg font-bold font-display text-text-primary mt-1">
                      {current.title}
                    </h2>
                  </div>
                  <button
                    onClick={close}
                    className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-muted transition-colors"
                    aria-label="Skip tutorial"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Visual + body (keyed so it animates between steps) */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.18 }}
                    className="flex flex-col gap-4"
                  >
                    <div className="flex items-center justify-center py-3 rounded-card bg-bg-elevated border border-border-subtle min-h-[96px]">
                      {current.visual}
                    </div>
                    <p className="text-sm font-sans leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {current.body}
                    </p>
                  </motion.div>
                </AnimatePresence>

                {/* Footer: progress dots + nav */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5">
                    {STEPS.map((_, i) => (
                      <span
                        key={i}
                        className="rounded-full transition-all"
                        style={{
                          width: i === step ? 18 : 6,
                          height: 6,
                          backgroundColor: i === step ? 'var(--tile-correct)' : 'var(--border-default)',
                        }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    {step > 0 && (
                      <button
                        onClick={back}
                        className="px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
                      >
                        <ArrowLeft size={13} />
                        Back
                      </button>
                    )}
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={next}
                      className="px-4 py-2 rounded-card bg-tile-correct text-white text-sm font-semibold hover:brightness-110 transition-[filter] flex items-center gap-1.5"
                    >
                      {isLast ? 'Got it — play' : 'Next'}
                      {!isLast && <ArrowRight size={14} />}
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
