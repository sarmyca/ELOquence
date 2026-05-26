'use client';

/**
 * Learn page — Duolingo-style gamified mini-challenges.
 *
 * Two views:
 *   1. Module overview (default) — lesson cards in a grid, progress bar
 *      per lesson, locked-state for lessons that aren’t the next-up.
 *   2. Active lesson — full LessonRunner takes over with a sequence of
 *      mini-challenges. Closing the runner returns to the overview.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, Play } from 'lucide-react';
import LessonRunner from './_components/challenges/LessonRunner';
import ScrollArea from '@/components/ScrollArea';
import { MODULES, TOTAL_LESSONS, findLesson, LESSON_ORDER } from './_lessons';
import { learnApi } from '@/lib/api';

const STORAGE_KEY = 'eloquence.trainer.progress';

/* Progress map: lessonId → number of challenges completed (high-water mark
 * across all sessions). A lesson is "done" when this value ≥ challenges.length. */
type Progress = Record<string, number>;

function loadProgress(): Progress {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: Record<string, unknown> = JSON.parse(raw);
    const result: Progress = {};
    // Migrate old boolean format → use a sentinel large number for "true"
    // so it compares ≥ any lesson.challenges.length and reads as fully done.
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === 'boolean') result[key] = val ? 999 : 0;
      else if (typeof val === 'number') result[key] = val;
    }
    return result;
  } catch {
    return {};
  }
}

function saveProgress(p: Progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore quota */
  }
}

/* Signed-in users get their progress synced to the backend so it follows the
 * account across devices; guests keep using localStorage only. We gate purely
 * on a stored token so a guest visit never triggers the 401→/login redirect
 * baked into the axios interceptor. */
function isSignedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('token');
}

/* Per-lesson high-water-mark merge: take the larger count from each side. */
function mergeProgress(a: Progress, b: Progress): Progress {
  const out: Progress = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = Math.max(out[k] || 0, v);
  }
  return out;
}

/* True when `local` holds progress the server hasn't seen yet (something to
 * push up — e.g. lessons completed on this device before sync existed). */
function localExceedsRemote(local: Progress, remote: Progress): boolean {
  for (const [k, v] of Object.entries(local)) {
    if (v > (remote[k] || 0)) return true;
  }
  return false;
}

export default function LearnPage() {
  const [progress, setProgress] = useState<Progress>({});
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  useEffect(() => {
    // 1. Show the local cache immediately so there's no flash of empty state.
    const local = loadProgress();
    setProgress(local);

    // 2. If signed in, reconcile with the server: pull remote progress, merge
    //    it with local as a high-water mark, adopt the result, and push up any
    //    progress the server is missing (one-time migration of localStorage
    //    that predates sync). Failures are swallowed — we keep the local cache.
    if (!isSignedIn()) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await learnApi.getProgress();
        if (cancelled) return;
        const remote: Progress = data?.progress ?? {};
        const merged = mergeProgress(local, remote);
        setProgress(merged);
        saveProgress(merged);
        if (localExceedsRemote(local, remote)) {
          await learnApi.saveProgress(merged);
        }
      } catch {
        /* offline / token expired — keep using the local cache */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lesson is fully complete when the stored count ≥ its challenges length.
  const lessonDone = useCallback(
    (lessonId: string): boolean => {
      const lesson = findLesson(lessonId)?.lesson;
      if (!lesson) return false;
      return (progress[lessonId] || 0) >= lesson.challenges.length;
    },
    [progress],
  );

  const completedCount = LESSON_ORDER.filter((id) => lessonDone(id)).length;

  const handleStart = useCallback((lessonId: string) => {
    setActiveLessonId(lessonId);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleProgress = useCallback(
    (count: number) => {
      if (!activeLessonId) return;
      setProgress((prev) => {
        const current = prev[activeLessonId] || 0;
        if (count <= current) return prev;
        const next = { ...prev, [activeLessonId]: count };
        saveProgress(next);
        // Fire-and-forget sync of just this lesson's new high-water mark; the
        // server merges it (GREATEST), so a dropped request just retries on the
        // next save and the local cache stays authoritative meanwhile.
        if (isSignedIn()) {
          learnApi.saveProgress({ [activeLessonId]: count }).catch(() => {});
        }
        return next;
      });
    },
    [activeLessonId],
  );

  const handleComplete = useCallback(() => {
    if (!activeLessonId) return;
    // Auto-advance to the next lesson; if none, return to overview.
    const currentIdx = LESSON_ORDER.indexOf(activeLessonId);
    const nextId = LESSON_ORDER[currentIdx + 1];
    if (nextId) {
      setActiveLessonId(nextId);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setActiveLessonId(null);
    }
  }, [activeLessonId]);

  const activeLesson = activeLessonId ? findLesson(activeLessonId) : null;

  // First lesson in LESSON_ORDER that isn't fully done. Everything past it is
  // locked. If everything is done, this is null.
  const firstIncompleteId = LESSON_ORDER.find((id) => !lessonDone(id)) ?? null;
  const firstIncompleteIdx = firstIncompleteId
    ? LESSON_ORDER.indexOf(firstIncompleteId)
    : LESSON_ORDER.length;

  // A lesson is unlocked if it's the first incomplete OR something before it
  // in the global order. (Done lessons are always replayable.)
  const isLessonUnlocked = useCallback(
    (lessonId: string): boolean => {
      const idx = LESSON_ORDER.indexOf(lessonId);
      if (idx === -1) return false;
      return idx <= firstIncompleteIdx;
    },
    [firstIncompleteIdx],
  );

  // Active lesson view — the scroll container is the inner bounded column,
  // not the outer page, so the scrollbar sits at the right edge of the
  // content (next to the cards) rather than at the far right of the viewport.
  if (activeLesson) {
    return (
      <div
        style={{
          background: 'var(--bg-base)',
          height: 'calc(100dvh - 52px)',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <ScrollArea
          style={{
            width: '100%',
            maxWidth: 680,
            height: '100%',
            scrollbarGutter: 'stable',
            padding: '24px 16px 48px',
          }}
        >
          <LessonRunner
            lesson={activeLesson.lesson}
            onComplete={handleComplete}
            onProgress={handleProgress}
          />
        </ScrollArea>
      </div>
    );
  }

  // Overview view — same trick: scroll happens on the bounded inner column
  // so the scrollbar is anchored to the right of the card grid.
  return (
    <div
      style={{
        background: 'var(--bg-base)',
        height: 'calc(100dvh - 52px)',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <ScrollArea
        style={{
          width: '100%',
          maxWidth: 760,
          height: '100%',
          scrollbarGutter: 'stable',
          padding: '24px 16px 60px',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--text-primary)',
              margin: 0,
              lineHeight: 1.15,
            }}
          >
            Train your Wordle instincts
          </h1>
          <div style={{ display: 'flex', gap: 14, marginTop: 14, alignItems: 'center' }}>
            <div
              style={{
                flex: 1,
                maxWidth: 280,
                height: 10,
                borderRadius: 999,
                background: 'var(--bg-muted)',
                overflow: 'hidden',
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(completedCount / TOTAL_LESSONS) * 100}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                style={{ height: '100%', background: 'var(--tile-correct)' }}
              />
            </div>
            <span
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                color: 'var(--text-tertiary)',
              }}
            >
              {completedCount} / {TOTAL_LESSONS}
            </span>
          </div>
        </div>

        {/* Modules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          {MODULES.map((mod, mi) => {
            // Aggregate challenge counts across the module: how many done, how many total.
            const modChallengesDone = mod.lessons.reduce(
              (sum, l) => sum + Math.min(progress[l.id] || 0, l.challenges.length),
              0,
            );
            const modChallengesTotal = mod.lessons.reduce((sum, l) => sum + l.challenges.length, 0);
            const lessonsFullyDone = mod.lessons.filter(
              (l) => (progress[l.id] || 0) >= l.challenges.length,
            ).length;
            const totalInMod = mod.lessons.length;

            // A module is locked when its *first* lesson is past the first
            // incomplete one — i.e. the previous module isn't fully done.
            const moduleLocked = !isLessonUnlocked(mod.lessons[0].id);

            // Module label colour: gray = nothing done / locked, yellow = some
            // done, green = all done.
            const modColor =
              modChallengesDone === 0
                ? 'var(--text-ghost)'
                : modChallengesDone >= modChallengesTotal
                  ? 'var(--tile-correct)'
                  : 'var(--tile-present)';

            return (
              <div key={mod.id} style={{ opacity: moduleLocked ? 0.55 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: modColor,
                      }}
                    >
                      Module {mi + 1}
                    </span>
                    <h2
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 19,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        margin: '2px 0 0 0',
                      }}
                    >
                      {mod.title}
                    </h2>
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0 0' }}>
                      {mod.blurb}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      color: modColor,
                    }}
                  >
                    {lessonsFullyDone}/{totalInMod}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {mod.lessons.map((l, li) => {
                    const challengesDone = Math.min(progress[l.id] || 0, l.challenges.length);
                    const total = l.challenges.length;
                    const done = challengesDone >= total;
                    const inProgress = challengesDone > 0 && !done;
                    const locked = !isLessonUnlocked(l.id);

                    // Wordle colour convention based on challenges completed:
                    //   gray   = 0 challenges done (or locked)
                    //   yellow = some but not all
                    //   green  = all done
                    const stateColor = done
                      ? 'var(--tile-correct)'
                      : inProgress
                        ? 'var(--tile-present)'
                        : 'var(--border-subtle)';
                    const circleBg = done
                      ? 'var(--tile-correct)'
                      : inProgress
                        ? 'var(--tile-present)'
                        : locked
                          ? 'var(--bg-muted)'
                          : 'var(--tile-present)'; // unlocked, not started yet
                    const circleIconColor = locked && !done && !inProgress ? 'var(--text-ghost)' : '#fff';

                    return (
                      <motion.button
                        key={l.id}
                        type="button"
                        onClick={() => !locked && handleStart(l.id)}
                        disabled={locked}
                        whileHover={!locked ? { y: -3 } : undefined}
                        whileTap={!locked ? { scale: 0.97 } : undefined}
                        style={{
                          background: 'var(--bg-elevated)',
                          border: `2px solid ${stateColor}`,
                          borderRadius: 14,
                          padding: '14px 16px',
                          textAlign: 'left',
                          cursor: locked ? 'not-allowed' : 'pointer',
                          opacity: locked ? 0.6 : 1,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                          position: 'relative',
                          transition: 'border-color 200ms ease, opacity 200ms ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span
                            style={{
                              fontSize: 10,
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              color: 'var(--text-ghost)',
                              fontWeight: 700,
                            }}
                          >
                            Lesson {li + 1}
                          </span>
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: circleBg,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: circleIconColor,
                            }}
                          >
                            {done ? (
                              <Check size={14} strokeWidth={3} />
                            ) : locked ? (
                              <Lock size={12} />
                            ) : (
                              <Play size={12} fill="#fff" strokeWidth={0} />
                            )}
                          </span>
                        </div>
                        <div>
                          <h3
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              margin: 0,
                              lineHeight: 1.3,
                            }}
                          >
                            {l.title}
                          </h3>
                          {l.subtitle && (
                            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                              {l.subtitle}
                            </p>
                          )}
                        </div>
                        {/* Per-challenge progress dots */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-ghost)' }}>
                          <div style={{ display: 'flex', gap: 3 }}>
                            {l.challenges.map((_, ci) => (
                              <span
                                key={ci}
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: 999,
                                  background:
                                    ci < challengesDone
                                      ? 'var(--tile-correct)'
                                      : 'var(--border-default)',
                                  transition: 'background-color 200ms ease',
                                }}
                              />
                            ))}
                          </div>
                          <span style={{ marginLeft: 4 }}>
                            {challengesDone}/{total}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
