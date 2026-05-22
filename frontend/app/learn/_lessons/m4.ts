import type { Module } from '../_components/challenges/types';

export const MODULE_4: Module = {
  id: 'm4',
  title: 'Probes vs candidates',
  blurb: 'When to gather info, when to swing.',
  lessons: [
    {
      id: 'm4l1',
      moduleId: 'm4',
      title: 'Info over commitment',
      subtitle: '47 candidates left. Probe or commit?',
      challenges: [
        {
          kind: 'reveal',
          title: 'The probe-or-commit choice',
          body: 'When dozens of candidates fit, guessing one is a coin flip. A probe testing fresh letters narrows the pool dramatically.',
        },
        {
          kind: 'guess-next',
          prompt: 'CRANE returned a yellow A + yellow N (~47 candidates left). Probe or commit?',
          history: [
            { guess: 'CRANE', pattern: ['absent', 'absent', 'present', 'present', 'absent'] },
          ],
          options: [
            {
              word: 'SHIRT',
              sub: 'Fresh letters S, H, I, T — pure info probe',
            },
            {
              word: 'NASAL',
              sub: 'A valid candidate — but only tests S and L as new info',
            },
          ],
          correctIdx: 0,
          successNote: 'SHIRT tests four fresh letters. NASAL might be the answer — but it’s a 1-in-47 gamble.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'Why does a probe usually win when the pool is large?',
          options: [
            {
              label: 'It narrows the pool faster than a candidate guess',
              sub: 'Trades a small chance of solving now for a much higher chance of solving next',
            },
            {
              label: 'Probes are guaranteed to solve',
              sub: 'They can’t — probes aren’t answer candidates',
            },
          ],
          correctIdx: 0,
          successNote: 'Probes maximise expected information. Candidates only win at the very end.',
        },
      ],
    },
    {
      id: 'm4l2',
      moduleId: 'm4',
      title: 'Splitter probes',
      subtitle: 'Two candidates? Find a word that breaks the tie.',
      challenges: [
        {
          kind: 'reveal',
          title: 'The endgame splitter',
          body: 'When only 2 candidates remain, find a probe with exactly ONE of the disputed letters. Its result tells you which is right.',
        },
        {
          kind: 'guess-next',
          prompt: 'Two candidates: BATCH and CATCH. What splits them?',
          history: [
            { guess: 'BATCH', pattern: ['empty', 'correct', 'correct', 'correct', 'correct'] },
          ],
          options: [
            {
              word: 'BLIMP',
              revealPattern: ['correct', 'absent', 'absent', 'absent', 'absent'],
              sub: 'Has B but not C — clean splitter',
            },
            {
              word: 'MIGHT',
              sub: 'Shares no letters with either — can’t distinguish them',
            },
            {
              word: 'CATCH',
              sub: 'It’s a candidate — a coin flip',
            },
          ],
          correctIdx: 0,
          successNote: 'Green B at position 1 = BATCH. All gray = CATCH. Guess 3 guaranteed.',
        },
        {
          kind: 'word-survivors',
          prompt: 'Which of these would also work as splitters for BATCH vs CATCH?',
          constraints: [
            'Need: contains B but NOT C — OR — contains C but NOT B',
            'Other letters should not overlap with the candidates',
          ],
          candidates: [
            { word: 'BLOND', survives: true },
            { word: 'CHIMP', survives: true },
            { word: 'BLIMP', survives: true },
            { word: 'CABIN', survives: false },
            { word: 'BACON', survives: false },
            { word: 'CLIMB', survives: false },
          ],
          successNote: 'Cabin, bacon, climb all contain BOTH B and C — they can’t distinguish.',
        },
      ],
    },
    {
      id: 'm4l3',
      moduleId: 'm4',
      title: 'When to commit',
      subtitle: 'Probe wins until the last guess.',
      challenges: [
        {
          kind: 'reveal',
          title: 'The commit rule',
          body: 'Commit ONLY when (a) you have 1 guess left, or (b) no probe can split the candidates. Otherwise, probe.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'Guess 6 is up. Three candidates remain: HASTE, PASTE, TASTE. What now?',
          options: [
            {
              label: 'Pick one — you have no other guess',
              sub: '1 in 3 chance, but you’re out of probes',
            },
            {
              label: 'Play a splitter probe like HAPPY',
              sub: 'Sounds smart, but you don’t get guess 7',
            },
          ],
          correctIdx: 0,
          successNote: 'On the last guess, you commit. No probe earns you anything if you can’t use the info.',
        },
        {
          kind: 'guess-next',
          prompt: 'Guess 5 is up — TWO guesses left. Same 3 candidates: HASTE, PASTE, TASTE.',
          history: [
            { guess: 'HASTE', pattern: ['empty', 'correct', 'correct', 'correct', 'correct'] },
            { guess: 'PASTE', pattern: ['empty', 'correct', 'correct', 'correct', 'correct'] },
          ],
          options: [
            {
              word: 'HAPPY',
              revealPattern: ['correct', 'correct', 'absent', 'absent', 'absent'],
              sub: 'Tests H and P — distinguishes all three',
            },
            {
              word: 'HASTE',
              sub: 'Commits to one candidate — 1/3 chance',
            },
          ],
          correctIdx: 0,
          successNote: 'With 2 guesses left, HAPPY guarantees the solve. Commit later.',
        },
      ],
    },
  ],
};
