import type { Module } from '../_components/challenges/types';

export const MODULE_3: Module = {
  id: 'm3',
  title: 'The first branch',
  blurb: 'Turn opener results into a sharper guess 2.',
  lessons: [
    {
      id: 'm3l1',
      moduleId: 'm3',
      title: 'After your opener',
      subtitle: 'Read the constraints, narrow the pool.',
      challenges: [
        {
          kind: 'reveal',
          title: 'Every row is a filter',
          body: 'A single guess gives 5 constraints. Stack them and the pool collapses fast.',
        },
        {
          kind: 'word-survivors',
          prompt: 'STARE returned [—, —, —, R→, —]. Which words survive?',
          constraints: [
            'No S, T, A, E',
            'R is in the word — but NOT at position 4',
          ],
          candidates: [
            { word: 'CRUMB', survives: true },
            { word: 'BRINK', survives: true },
            { word: 'PROUD', survives: true },
            { word: 'BLURB', survives: true },
            { word: 'TIGER', survives: false },
            { word: 'GRAPE', survives: false },
          ],
          successNote: 'Each constraint compounds. After one row, ~120 candidates remain.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'You have a yellow R from STARE. What does it tell you?',
          options: [
            {
              label: 'R is in the word, at any position except 4',
              sub: 'Tells you 2 facts at once',
            },
            {
              label: 'R is at position 4',
              sub: 'That would be green, not yellow',
            },
            {
              label: 'R might or might not be in the word',
              sub: 'Yellow always means the letter IS in the word',
            },
          ],
          correctIdx: 0,
          successNote: 'Yellow = present (in word) AND not at this position.',
        },
      ],
    },
    {
      id: 'm3l2',
      moduleId: 'm3',
      title: 'Build guess 2',
      subtitle: 'Test fresh letters that respect what you know.',
      challenges: [
        {
          kind: 'reveal',
          title: 'Fresh letters > re-tests',
          body: 'Your second guess should test letters you haven’t tried yet. Reusing known letters wastes slots.',
        },
        {
          kind: 'letter-picker',
          prompt: 'After STARE (R yellow), build a 5-letter probe with all FRESH letters.',
          absent: ['S', 'T', 'A', 'E'],
          known: ['R'],
          validProbes: ['CLOUD', 'BRINK', 'PROUD', 'BLIMP', 'CROWN', 'BLOND', 'CHIMP', 'CRUMB', 'GROIN', 'MOUND', 'WORLD', 'BROIL'],
          successNote: 'Any probe with new letters works. Avoid S/T/A/E which are already ruled out.',
        },
        {
          kind: 'guess-next',
          prompt: 'After STARE’s yellow R, what should you play next?',
          history: [
            { guess: 'STARE', pattern: ['absent', 'absent', 'absent', 'present', 'absent'] },
          ],
          options: [
            {
              word: 'CLOUD',
              revealPattern: ['correct', 'absent', 'absent', 'present', 'absent'],
              sub: 'Fresh letters — strong probe',
            },
            {
              word: 'AROSE',
              revealPattern: ['absent', 'present', 'absent', 'absent', 'absent'],
              sub: 'Wastes 3 slots on already-known A, S, E',
            },
          ],
          correctIdx: 0,
          successNote: 'CLOUD tests 5 untested letters in one row. AROSE re-tests letters you’ve already ruled out.',
        },
      ],
    },
  ],
};
