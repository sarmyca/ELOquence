import type { Module } from '../_components/challenges/types';

export const MODULE_6: Module = {
  id: 'm6',
  title: 'Hard mode',
  blurb: 'Play under the forced-reuse constraint.',
  lessons: [
    {
      id: 'm6l1',
      moduleId: 'm6',
      title: 'What hard mode forces',
      subtitle: 'Every confirmed letter must reappear.',
      challenges: [
        {
          kind: 'reveal',
          title: 'The hard-mode rule',
          body: 'Greens stay green at their position. Yellows must reappear somewhere — anywhere except the wrong position they came from. Every subsequent guess respects this.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'After CRANE returned [—, —, —, —, E] (green E at pos 5), which next guess is LEGAL in hard mode?',
          options: [
            {
              label: 'SLATE',
              word: 'SLATE',
              pattern: ['empty', 'empty', 'empty', 'empty', 'correct'],
              sub: 'Has E at pos 5 — reuses the green',
            },
            {
              label: 'SHIRT',
              word: 'SHIRT',
              pattern: ['empty', 'empty', 'empty', 'empty', 'empty'],
              sub: 'No E anywhere — illegal',
            },
          ],
          correctIdx: 0,
          successNote: 'Hard mode requires every green and yellow letter to reappear in your next guess.',
        },
        {
          kind: 'word-survivors',
          prompt: 'CRANE gave a yellow R + green E (pos 5). Which next guesses are HARD-MODE LEGAL?',
          constraints: [
            'Must contain R (yellow from CRANE)',
            'Must have E at position 5 (green from CRANE)',
          ],
          candidates: [
            { word: 'BRINE', survives: true },
            { word: 'STORE', survives: true },
            { word: 'PRIDE', survives: true },
            { word: 'GHOST', survives: false },
            { word: 'SHIRT', survives: false },
            { word: 'BLAME', survives: false },
          ],
          successNote: 'Hard mode legality is a hard filter. Most words drop out.',
        },
      ],
    },
    {
      id: 'm6l2',
      moduleId: 'm6',
      title: 'Openers for hard mode',
      subtitle: 'Not every opener leaves good follow-ups.',
      challenges: [
        {
          kind: 'reveal',
          title: 'Branching matters more in hard mode',
          body: 'TARES and ROATE branch into common consonant clusters. ADIEU traps you in a vowel-only follow-up space.',
        },
        {
          kind: 'sort-buckets',
          prompt: 'Which openers branch well in hard mode?',
          buckets: [
            { id: 'safe', label: 'Strong in hard mode' },
            { id: 'risky', label: 'Risky / traps you' },
          ],
          items: [
            { id: 'tares', label: 'TARES', bucketId: 'safe' },
            { id: 'roate', label: 'ROATE', bucketId: 'safe' },
            { id: 'slate', label: 'SLATE', bucketId: 'safe' },
            { id: 'adieu', label: 'ADIEU', bucketId: 'risky' },
            { id: 'audio', label: 'AUDIO', bucketId: 'risky' },
            { id: 'arise', label: 'ARISE', bucketId: 'safe' },
          ],
          successNote: 'Vowel-heavy openers (ADIEU, AUDIO) force vowel-heavy follow-ups — bad branching in hard mode.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'TARES vs STORM gave [Y, —, Y, —, Y]. What MUST your guess 2 contain?',
          options: [
            {
              label: 'T, R, AND S — at positions different from TARES',
              sub: 'All three yellows must reappear',
            },
            {
              label: 'Only one of T, R, S — pick any',
              sub: 'Hard mode is stricter than that',
            },
            {
              label: 'No constraint — yellows are flexible',
              sub: 'Yellows are constraints too',
            },
          ],
          correctIdx: 0,
          successNote: 'Every yellow tile is a "must include this letter somewhere" rule.',
        },
      ],
    },
    {
      id: 'm6l3',
      moduleId: 'm6',
      title: 'Hard-mode traps',
      subtitle: 'Some endgames are literally unsolvable.',
      challenges: [
        {
          kind: 'reveal',
          title: 'The unsolvable -ATCH',
          body: 'In hard mode, once you’ve locked _ATCH, your next guess MUST reuse A, T, C, H — every legal word is one of the 7 candidates. Best case: 1-in-N coin flips for the rest.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'You hit _ATCH on guess 2 in hard mode. What’s the BEST strategy from here?',
          options: [
            {
              label: 'Guess the most common _ATCH word and pray',
              sub: 'You literally cannot probe — every legal word is a candidate',
            },
            {
              label: 'Play a probe like BUMPY',
              sub: 'Illegal — BUMPY doesn’t reuse the locked letters',
            },
            {
              label: 'Switch to a different family',
              sub: 'The letters are already locked; you can’t un-lock them',
            },
          ],
          correctIdx: 0,
          successNote: 'Some hard-mode runs just fail to 6/6 against ambiguous answer families. It’s not your fault.',
        },
      ],
    },
  ],
};
