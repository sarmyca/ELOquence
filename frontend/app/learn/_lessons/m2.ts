import type { Module } from '../_components/challenges/types';

export const MODULE_2: Module = {
  id: 'm2',
  title: 'Reading tiles',
  blurb: 'Decode what each colour actually tells you.',
  lessons: [
    {
      id: 'm2l1',
      moduleId: 'm2',
      title: 'Greens, yellows, grays',
      subtitle: 'The three colours and what they really mean.',
      challenges: [
        {
          kind: 'reveal',
          title: 'Three tiles, three facts',
          body: 'Green = right letter, right spot. Yellow = right letter, wrong spot. Gray = letter not in the answer.',
        },
        {
          kind: 'tile-paint',
          prompt: 'Paint the pattern: guess CRANE vs target ARISE.',
          guess: 'CRANE',
          target: 'ARISE',
          successNote: 'R at pos 2 (green), A is in ARISE at pos 1 (yellow), E at pos 5 (green).',
        },
        {
          kind: 'tile-tap',
          prompt: 'CRANE vs ARISE — tap a tile that ends up GREEN.',
          guess: 'CRANE',
          target: 'ARISE',
          correctIdx: 1,
          correctState: 'correct',
          successNote: 'R locks in at position 2.',
        },
        {
          kind: 'word-survivors',
          prompt: 'CRANE returned [—, R, A→, —, E]. Tap every word that still fits.',
          constraints: [
            'No C',
            'R locked at position 2',
            'A is in the word — but NOT at position 3',
            'No N',
            'E locked at position 5',
          ],
          candidates: [
            { word: 'ARISE', survives: true },
            { word: 'AROSE', survives: true },
            { word: 'ARGUE', survives: true },
            { word: 'BRAVE', survives: false },
            { word: 'DRIVE', survives: false },
            { word: 'TRACE', survives: false },
          ],
          successNote: 'Stacking five constraints from one row cuts the pool from 2300 to ~30.',
        },
      ],
    },
    {
      id: 'm2l2',
      moduleId: 'm2',
      title: 'Yellows are gold',
      subtitle: 'Each yellow encodes two facts at once.',
      challenges: [
        {
          kind: 'reveal',
          title: 'Why yellows matter',
          body: 'A yellow tile says: this letter IS in the answer, AND it is NOT at this position. Two constraints from one tile.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'Which pattern narrows the answer pool MORE — even though it looks worse?',
          options: [
            {
              label: 'Mostly gray',
              word: 'CRANE',
              pattern: ['absent', 'absent', 'absent', 'absent', 'present'],
              sub: '1 yellow · 4 grays · ~178 words remain',
            },
            {
              label: 'Mostly yellow',
              word: 'CRANE',
              pattern: ['present', 'present', 'present', 'present', 'absent'],
              sub: '4 yellows · 1 gray · ~3 words remain',
            },
          ],
          correctIdx: 1,
          successNote: 'Four yellows pin down four letters of the answer. Massive cut.',
        },
        {
          kind: 'tile-paint',
          prompt: 'Paint CRANE vs RANCH — yellows for letters in the wrong slot.',
          guess: 'CRANE',
          target: 'RANCH',
          successNote: 'C, R, A, N all in RANCH at different slots — four yellows, one gray E.',
        },
        {
          kind: 'reveal',
          title: 'Takeaway',
          body: 'Don’t dismiss a board full of yellows. It’s often more powerful than a board full of grays.',
        },
      ],
    },
    {
      id: 'm2l3',
      moduleId: 'm2',
      title: 'Duplicate letters',
      subtitle: 'The trickiest part of Wordle scoring.',
      challenges: [
        {
          kind: 'reveal',
          title: 'The duplicate rule',
          body: 'If your guess has a letter twice but the target only has it once, only ONE of yours gets coloured. The other goes gray — even though that letter IS in the word.',
        },
        {
          kind: 'tile-paint',
          prompt: 'SPEED vs PRICE — the target has only one E. Paint it.',
          guess: 'SPEED',
          target: 'PRICE',
          successNote: 'P yellow, leftmost E yellow, rightmost E gray. The gray E does NOT mean E is absent.',
        },
        {
          kind: 'tile-paint',
          prompt: 'SPEED vs SHEEP — this target has TWO E’s. Paint it.',
          guess: 'SPEED',
          target: 'SHEEP',
          successNote: 'Both E’s colour now. Duplicate behaviour depends entirely on the target.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'POPPY vs POSED returns [G, G, ., ., .]. What do the gray P’s tell you?',
          options: [
            {
              label: 'POSED has just one P — already claimed by the green',
              sub: 'No more P’s available to colour',
            },
            {
              label: 'There’s no P anywhere in the target',
              sub: 'Sounds intuitive, but wrong',
            },
            {
              label: 'POSED has P at positions 3 and 4',
              sub: 'No — those tiles are gray',
            },
          ],
          correctIdx: 0,
          successNote: 'Greens consume target letters first. Extra duplicates in your guess go gray.',
        },
      ],
    },
  ],
};
