import type { Module } from '../_components/challenges/types';

export const MODULE_5: Module = {
  id: 'm5',
  title: 'Pattern traps',
  blurb: 'Word families that look solved but aren’t.',
  lessons: [
    {
      id: 'm5l1',
      moduleId: 'm5',
      title: 'The -ATCH trap',
      subtitle: 'Seven words share the same four letters.',
      challenges: [
        {
          kind: 'reveal',
          title: 'You locked -ATCH. Now what?',
          body: 'Once you have green tiles at positions 2-5 spelling ATCH, seven candidates fit: BATCH, CATCH, HATCH, LATCH, MATCH, PATCH, WATCH.',
        },
        {
          kind: 'sort-buckets',
          prompt: 'Sort these into "fits _ATCH" and "doesn’t".',
          buckets: [
            { id: 'atch', label: 'Fits _ATCH' },
            { id: 'no', label: 'Doesn’t' },
          ],
          items: [
            { id: 'batch', label: 'BATCH', bucketId: 'atch' },
            { id: 'patch', label: 'PATCH', bucketId: 'atch' },
            { id: 'march', label: 'MARCH', bucketId: 'no' },
            { id: 'hatch', label: 'HATCH', bucketId: 'atch' },
            { id: 'beach', label: 'BEACH', bucketId: 'no' },
            { id: 'watch', label: 'WATCH', bucketId: 'atch' },
            { id: 'reach', label: 'REACH', bucketId: 'no' },
            { id: 'latch', label: 'LATCH', bucketId: 'atch' },
          ],
          successNote: 'Seven _ATCH words exist. A naive re-guess from the family is at best 1-in-7.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'BUMPY tests B, M, and P at once. After playing it, how many candidates can stay ambiguous?',
          options: [
            {
              label: 'Up to 4 — CATCH, HATCH, LATCH, WATCH all give all-gray',
              sub: 'BUMPY has no C/H/L/W',
            },
            {
              label: 'Exactly 1 — the probe always solves',
              sub: 'BUMPY shares no letters with C/H/L/W',
            },
          ],
          correctIdx: 0,
          successNote: 'BUMPY narrows 7 candidates to either 1 (if B/M/P pings) or 4 (if all gray). Then probe again.',
        },
      ],
    },
    {
      id: 'm5l2',
      moduleId: 'm5',
      title: 'Common families',
      subtitle: 'Memorise three rosters and save a guess.',
      challenges: [
        {
          kind: 'reveal',
          title: 'Three families to memorise',
          body: '-OUND, -IGHT, -ATCH. When greens lock the suffix, only the first letter is open. Recognise fast and jump straight to a multi-letter probe.',
        },
        {
          kind: 'sort-buckets',
          prompt: 'Drop each word into its family.',
          buckets: [
            { id: 'ound', label: '_OUND' },
            { id: 'ight', label: '_IGHT' },
            { id: 'atch', label: '_ATCH' },
          ],
          items: [
            { id: 'sound', label: 'SOUND', bucketId: 'ound' },
            { id: 'light', label: 'LIGHT', bucketId: 'ight' },
            { id: 'batch', label: 'BATCH', bucketId: 'atch' },
            { id: 'round', label: 'ROUND', bucketId: 'ound' },
            { id: 'fight', label: 'FIGHT', bucketId: 'ight' },
            { id: 'match', label: 'MATCH', bucketId: 'atch' },
            { id: 'mound', label: 'MOUND', bucketId: 'ound' },
            { id: 'night', label: 'NIGHT', bucketId: 'ight' },
            { id: 'watch', label: 'WATCH', bucketId: 'atch' },
          ],
          successNote: 'Memorise the rosters. The moment you see a suffix lock in, you’re halfway done.',
        },
        {
          kind: 'word-survivors',
          prompt: 'You’ve locked _IGHT. Which of these fits the family?',
          constraints: ['Pattern: _IGHT (positions 2-5)', 'Position 1 is the unknown letter'],
          candidates: [
            { word: 'FIGHT', survives: true },
            { word: 'LIGHT', survives: true },
            { word: 'NIGHT', survives: true },
            { word: 'GHOST', survives: false },
            { word: 'RIGHT', survives: true },
            { word: 'MOUND', survives: false },
          ],
          successNote: 'The _IGHT family has 8 members: EIGHT, FIGHT, LIGHT, MIGHT, NIGHT, RIGHT, SIGHT, TIGHT.',
        },
      ],
    },
  ],
};
