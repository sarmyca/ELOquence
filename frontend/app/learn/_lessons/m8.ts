import type { Module } from '../_components/challenges/types';

export const MODULE_8: Module = {
  id: 'm8',
  title: 'The math, briefly',
  blurb: 'Where the "bits" numbers come from.',
  lessons: [
    {
      id: 'm8l1',
      moduleId: 'm8',
      title: 'What’s a bit?',
      subtitle: 'Each bit halves the candidate pool.',
      challenges: [
        {
          kind: 'reveal',
          title: 'A bit is one halving',
          body: 'If 2300 answers are possible and your guess narrows to 1150, you gained 1 bit. SALET averages ~6 bits — that’s six halvings.',
        },
        {
          kind: 'pool-shrink',
          prompt: 'Watch the pool shrink. Each step = 1 bit of info gained.',
          startCount: 64,
          steps: [
            { label: '1 bit', remaining: 32, note: 'Half the pool eliminated.' },
            { label: '2 bits', remaining: 16, note: 'Halved again.' },
            { label: '3 bits', remaining: 8, note: 'Pool down to a handful.' },
            { label: '4 bits', remaining: 4, note: 'Almost there.' },
            { label: '5 bits', remaining: 2, note: 'Two candidates left — splitter time.' },
            { label: '6 bits', remaining: 1, note: 'Solved.' },
          ],
          successNote: 'Six bits = six halvings = 2^6 = 64x narrower pool.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'SALET extracts ~6 bits on average. Roughly what fraction of the answer pool stays after playing it?',
          options: [
            {
              label: 'About 1/64 of the pool',
              sub: '6 bits = 6 halvings ≈ 64x narrower',
            },
            {
              label: 'About 1/6 of the pool',
              sub: 'Bits multiply, not divide',
            },
            {
              label: 'About half the pool',
              sub: 'That’s only 1 bit',
            },
          ],
          correctIdx: 0,
          successNote: 'From ~2300 candidates → ~36 after one strong opener.',
        },
      ],
    },
    {
      id: 'm8l2',
      moduleId: 'm8',
      title: 'Expected guesses',
      subtitle: 'Why solving in 3-4 is realistic.',
      challenges: [
        {
          kind: 'reveal',
          title: 'The solve curve',
          body: 'Guess 1: ~6 bits → 2300 to ~50 candidates. Guess 2: ~3.5 bits → ~5 candidates. Guess 3: ~2 bits → 1 candidate.',
        },
        {
          kind: 'pool-shrink',
          prompt: 'A full solve — three guesses against a real pool.',
          startCount: 100,
          steps: [
            { label: 'Guess 1: opener', remaining: 20, note: 'Strong opener (~6 bits) — pool collapses.' },
            { label: 'Guess 2: probe', remaining: 5, note: 'Fresh letters narrow to a handful.' },
            { label: 'Guess 3: solve', remaining: 1, note: 'Splitter or candidate guess lands the answer.' },
          ],
          successNote: 'The math says ~3.4 average guesses with optimal play. Strong humans average 3.6.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'What’s the difference between "optimal" and "fun" play?',
          options: [
            {
              label: 'Optimal probes ignore candidate guesses early; fun play takes shots',
              sub: 'Probes maximise info; candidate gambles trade info for the thrill of solving',
            },
            {
              label: 'There’s no difference',
              sub: 'There is — optimal play and fun play diverge by ~0.5 guesses on average',
            },
          ],
          correctIdx: 0,
          successNote: 'Optimal: ~3.42 avg. Strong human: ~3.6. The gap is the cost of swinging early.',
        },
      ],
    },
  ],
};
