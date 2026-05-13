export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  moduleId: string;
}

export const MODULES: Module[] = [
  {
    id: 'm1',
    title: 'Openings',
    lessons: [
      { id: 'm1l1', title: 'Why your opening matters', moduleId: 'm1' },
      { id: 'm1l2', title: 'Pick a strong opener', moduleId: 'm1' },
      { id: 'm1l3', title: 'Stick with one opener', moduleId: 'm1' },
    ],
  },
  {
    id: 'm2',
    title: 'Reading patterns',
    lessons: [
      { id: 'm2l1', title: 'Greens, yellows, grays', moduleId: 'm2' },
      { id: 'm2l2', title: 'Yellows are gold', moduleId: 'm2' },
      { id: 'm2l3', title: 'Pattern recognition drill', moduleId: 'm2' },
    ],
  },
  {
    id: 'm3',
    title: 'Choosing the next guess',
    lessons: [
      { id: 'm3l1', title: 'Info over commitment', moduleId: 'm3' },
      { id: 'm3l2', title: 'Endgame: candidate vs. probe', moduleId: 'm3' },
      { id: 'm3l3', title: 'Spot the trap', moduleId: 'm3' },
    ],
  },
  {
    id: 'm4',
    title: 'Hard mode',
    lessons: [
      { id: 'm4l1', title: 'What hard mode forces', moduleId: 'm4' },
      { id: 'm4l2', title: 'Openers that work in hard mode', moduleId: 'm4' },
    ],
  },
  {
    id: 'm5',
    title: 'The math, briefly',
    lessons: [
      { id: 'm5l1', title: "What's a bit?", moduleId: 'm5' },
      { id: 'm5l2', title: 'More groups = more info', moduleId: 'm5' },
    ],
  },
];

export const TOTAL_LESSONS = MODULES.reduce((n, m) => n + m.lessons.length, 0);

export const LESSON_ORDER: string[] = MODULES.flatMap((m) =>
  m.lessons.map((l) => l.id)
);
