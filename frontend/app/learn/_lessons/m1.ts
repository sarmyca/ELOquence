import type { Module } from '../_components/challenges/types';

export const MODULE_1: Module = {
  id: 'm1',
  title: 'Openings',
  blurb: 'Pick a strong first guess and commit to it.',
  lessons: [
    {
      id: 'm1l1',
      moduleId: 'm1',
      title: 'Why your opening matters',
      subtitle: 'Strong openers light up more tiles on guess 1.',
      challenges: [
        {
          kind: 'reveal',
          title: 'Guess 1 sets up everything',
          body: 'A great opener narrows the field by half or more in a single move. Let’s see why.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'Which opener extracts more info against the target SOLAR?',
          options: [
            {
              label: 'SALET',
              word: 'SALET',
              pattern: ['correct', 'present', 'correct', 'absent', 'absent'],
              sub: '2 greens + 1 yellow · 5 unique letters',
            },
            {
              label: 'MAMMA',
              word: 'MAMMA',
              pattern: ['absent', 'present', 'absent', 'absent', 'absent'],
              sub: 'Only 1 yellow · 2 unique letters',
            },
          ],
          correctIdx: 0,
          successNote: 'Five unique letters beat two repeats every time.',
        },
        {
          kind: 'tile-tap',
          prompt: 'SALET vs SOLAR — tap a tile that should be GREEN.',
          guess: 'SALET',
          target: 'SOLAR',
          correctIdx: 0,
          correctState: 'correct',
          successNote: 'Either S at pos 1 or L at pos 3 — both lock in.',
        },
        {
          kind: 'reveal',
          title: 'The recipe',
          body: 'Strong openers: 5 unique letters · high-frequency picks (S A E R T O L N) · placed where those letters usually live.',
        },
      ],
    },
    {
      id: 'm1l2',
      moduleId: 'm1',
      title: 'Build your own opener',
      subtitle: 'Pick 5 letters that carry their weight.',
      challenges: [
        {
          kind: 'multiple-choice',
          prompt: 'Which of these is NOT a valid opener? (a valid opener has 5 unique letters)',
          options: [
            { label: 'TARES', word: 'TARES', sub: '5 unique letters' },
            { label: 'POPPY', word: 'POPPY', sub: '3 unique letters — P repeats 3×' },
            { label: 'CRANE', word: 'CRANE', sub: '5 unique letters' },
            { label: 'ROATE', word: 'ROATE', sub: '5 unique letters' },
          ],
          correctIdx: 1,
          successNote: 'POPPY reuses P three times — only 3 unique letters do real work.',
        },
        {
          kind: 'letter-picker',
          prompt: 'Build a top-tier opener. (try TARES, ROATE, ARISE, or any other 5-uniques)',
          absent: [],
          known: [],
          validProbes: ['TARES', 'ROATE', 'ARISE', 'SLATE', 'CRANE', 'CRATE', 'SALET', 'IRATE', 'LATER', 'LARES'],
          successNote: 'Solid. That opener consistently extracts ~5.7+ bits of info.',
        },
        {
          kind: 'sort-buckets',
          prompt: 'Sort these into "strong opener" vs "weak — too many repeats".',
          buckets: [
            { id: 'strong', label: 'Strong (5 unique)' },
            { id: 'weak', label: 'Weak (repeats)' },
          ],
          items: [
            { id: 'tares', label: 'TARES', bucketId: 'strong' },
            { id: 'faffy', label: 'FAFFY', bucketId: 'weak' },
            { id: 'audio', label: 'AUDIO', bucketId: 'strong' },
            { id: 'mamma', label: 'MAMMA', bucketId: 'weak' },
            { id: 'arise', label: 'ARISE', bucketId: 'strong' },
            { id: 'level', label: 'LEVEL', bucketId: 'weak' },
          ],
          successNote: 'Every strong opener tests 5 distinct letters in one go.',
        },
        {
          kind: 'reveal',
          title: 'The roster',
          body: 'Top openers solvers use: TARES, ROATE, SALET, SLATE, CRANE, ARISE. All ~5.7-5.9 bits. Pick one and learn its branches.',
        },
      ],
    },
    {
      id: 'm1l3',
      moduleId: 'm1',
      title: 'One opener, every day',
      subtitle: 'Memorising branches > picking random.',
      challenges: [
        {
          kind: 'reveal',
          title: 'Consistency wins',
          body: 'Players who fire the same opener daily average ~0.5 fewer guesses. The win comes from memorising what to play next for each common result.',
        },
        {
          kind: 'tile-paint',
          prompt: 'You play SLATE against today’s target STAGE. Paint the pattern.',
          guess: 'SLATE',
          target: 'STAGE',
          successNote: 'Three greens! S, A, E all in their slots — STAGE almost solves itself.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'You play SLATE again tomorrow against TRADE. What’s the win from using SLATE both days?',
          options: [
            {
              label: 'You already know SLATE’s common second-guess branches',
              sub: 'Mental library you can’t build by switching openers',
            },
            {
              label: 'SLATE extracts more bits than other openers',
              sub: 'Bits are roughly the same across all top openers',
            },
          ],
          correctIdx: 0,
          successNote: 'Stick with one opener. The bits are equal — the experience is not.',
        },
        {
          kind: 'reveal',
          title: 'Your assignment',
          body: 'Pick one opener from the roster. Play it for a month. Note the 5-7 patterns it produces and your follow-up for each.',
        },
      ],
    },
  ],
};
