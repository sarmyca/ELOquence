import type { Module } from '../_components/challenges/types';

export const MODULE_7: Module = {
  id: 'm7',
  title: 'Position awareness',
  blurb: 'Where a letter sits matters as much as which letter.',
  lessons: [
    {
      id: 'm7l1',
      moduleId: 'm7',
      title: 'Position frequency',
      subtitle: 'Same letters, different slots, different info.',
      challenges: [
        {
          kind: 'reveal',
          title: 'Letters cluster',
          body: 'S starts ~16% of Wordle answers but ends only ~2%. E ends ~16% but starts ~3%. Pick openers that put letters where they actually live.',
        },
        {
          kind: 'tile-paint',
          prompt: 'PEARS vs PEARL — paint the pattern (positions match!).',
          guess: 'PEARS',
          target: 'PEARL',
          successNote: 'Four greens. The letters AND positions both match.',
        },
        {
          kind: 'tile-paint',
          prompt: 'SPEAR vs PEARL — same letters as PEARS, but rearranged.',
          guess: 'SPEAR',
          target: 'PEARL',
          successNote: 'Four yellows. Same letters, but each lands one slot off.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'Same five letters, two different positions. Which is the better opener?',
          options: [
            {
              label: 'PEARS (positions matching where letters usually live)',
              sub: 'Letters at the slots they typically occupy',
            },
            {
              label: 'SPEAR (same letters, scrambled positions)',
              sub: 'Same info about letters, less about position',
            },
          ],
          correctIdx: 0,
          successNote: 'A great opener IS its letters + positions. Both axes matter.',
        },
      ],
    },
    {
      id: 'm7l2',
      moduleId: 'm7',
      title: 'Upgrade yellows to greens',
      subtitle: 'Move known letters into new positions to lock them.',
      challenges: [
        {
          kind: 'reveal',
          title: 'Yellow → green',
          body: 'A yellow tells you "this letter is in the word, NOT at this position". Your next guess should try a different position for that letter.',
        },
        {
          kind: 'guess-next',
          prompt: 'SLATE returned a yellow L (pos 2) and yellow T (pos 4). Pick guess 2.',
          history: [
            { guess: 'SLATE', pattern: ['absent', 'present', 'absent', 'present', 'absent'] },
          ],
          options: [
            {
              word: 'PILOT',
              revealPattern: ['absent', 'correct', 'present', 'absent', 'correct'],
              sub: 'L at new spot (pos 3), T at new spot (pos 5) — both upgrade',
            },
            {
              word: 'SLATE',
              sub: 'Identical guess — re-tests yellows at the same wrong slots',
            },
          ],
          correctIdx: 0,
          successNote: 'PILOT moved L and T to new positions. T upgrades to green. L narrows further.',
        },
        {
          kind: 'tile-paint',
          prompt: 'Paint PILOT vs LIGHT.',
          guess: 'PILOT',
          target: 'LIGHT',
          successNote: 'I locks green at pos 2, L stays yellow (still in word, not at pos 3 either), T locks green at pos 5.',
        },
      ],
    },
  ],
};
