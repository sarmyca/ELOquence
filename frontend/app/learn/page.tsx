'use client';
// Layout: left module rail (sticky, 220px) + right lesson pane.
// The lesson pane header, scrollable content area, and nav bar use
// explicit heights so content fills the viewport without page scroll.
// localStorage key: "eloquence.trainer.progress" — { [lessonId]: true }

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  BookOpen,
  Zap,
  Target,
  Lock,
  BarChart2,
  ChevronDown,
} from 'lucide-react';
import clsx from 'clsx';
import { MODULES, LESSON_ORDER, TOTAL_LESSONS } from './_components/lessonData';

import M1L1 from './_components/lessons/M1L1';
import M1L2 from './_components/lessons/M1L2';
import M1L3 from './_components/lessons/M1L3';
import M2L1 from './_components/lessons/M2L1';
import M2L2 from './_components/lessons/M2L2';
import M2L3 from './_components/lessons/M2L3';
import M3L1 from './_components/lessons/M3L1';
import M3L2 from './_components/lessons/M3L2';
import M3L3 from './_components/lessons/M3L3';
import M4L1 from './_components/lessons/M4L1';
import M4L2 from './_components/lessons/M4L2';
import M5L1 from './_components/lessons/M5L1';
import M5L2 from './_components/lessons/M5L2';

const STORAGE_KEY = 'eloquence.trainer.progress';

const MODULE_ICONS: Record<string, React.ReactNode> = {
  m1: <BookOpen size={13} aria-hidden="true" />,
  m2: <BarChart2 size={13} aria-hidden="true" />,
  m3: <Target size={13} aria-hidden="true" />,
  m4: <Lock size={13} aria-hidden="true" />,
  m5: <Zap size={13} aria-hidden="true" />,
};

// One instantiated component per lesson — avoids re-mounting on re-render
const LESSON_COMPONENTS: Record<string, React.ReactNode> = {
  m1l1: <M1L1 />,
  m1l2: <M1L2 />,
  m1l3: <M1L3 />,
  m2l1: <M2L1 />,
  m2l2: <M2L2 />,
  m2l3: <M2L3 />,
  m3l1: <M3L1 />,
  m3l2: <M3L2 />,
  m3l3: <M3L3 />,
  m4l1: <M4L1 />,
  m4l2: <M4L2 />,
  m5l1: <M5L1 />,
  m5l2: <M5L2 />,
};

function loadProgress(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProgress(p: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // ignore quota / private-browsing errors
  }
}

export default function LearnPage() {
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(['m1']));
  const [railOpen, setRailOpen] = useState(false);

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  const currentLessonId = LESSON_ORDER[currentIdx];
  const currentLesson = MODULES.flatMap((m) => m.lessons).find((l) => l.id === currentLessonId);
  const currentModule = MODULES.find((m) => m.id === currentLesson?.moduleId);
  const lessonNumInModule = currentModule?.lessons.findIndex((l) => l.id === currentLessonId) ?? 0;

  const completedCount = Object.values(progress).filter(Boolean).length;

  const markComplete = useCallback(() => {
    if (!currentLessonId) return;
    setProgress((prev) => {
      const next = { ...prev, [currentLessonId]: true };
      saveProgress(next);
      return next;
    });
  }, [currentLessonId]);

  function goTo(idx: number) {
    setCurrentIdx(idx);
    const targetId = LESSON_ORDER[idx];
    const targetModuleId = MODULES.flatMap((m) => m.lessons).find((l) => l.id === targetId)?.moduleId;
    if (targetModuleId) {
      setExpandedModules((prev) => {
        const arr = Array.from(prev);
        if (!arr.includes(targetModuleId)) arr.push(targetModuleId);
        return new Set(arr);
      });
    }
    setRailOpen(false);
  }

  function toggleModule(moduleId: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }

  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < LESSON_ORDER.length - 1;

  // nav bar is 62px, page header is ~94px, site nav is 52px
  const CONTENT_HEIGHT = 'max(280px, calc(100dvh - 52px - 94px - 62px - 60px))';

  return (
    <div
      style={{
        background: 'var(--bg-base)',
        // Pin the whole page to the viewport (minus the 56px site navbar) so
        // the only scrollbar is the internal one inside the lesson content.
        height: 'calc(100dvh - 56px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-base)',
          padding: '14px 24px 12px',
        }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--tile-correct)',
            }}
          >
            Learn
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 2, flexWrap: 'wrap' }}>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Learn to play better
            </h1>
            <span
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                color: completedCount === TOTAL_LESSONS ? 'var(--tile-correct)' : 'var(--text-tertiary)',
                whiteSpace: 'nowrap',
              }}
            >
              {completedCount} / {TOTAL_LESSONS} complete
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '3px 0 0 0', lineHeight: 1.4 }}>
            Short interactive lessons — no long reads, just hands-on practice.
          </p>
        </div>
      </div>

      {/* ── Body wrapper — fills remaining viewport, no own scroll ──── */}
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          display: 'flex',
          position: 'relative',
          flex: 1,
          minHeight: 0,
          width: '100%',
        }}
      >
        {/* Mobile-only rail toggle — hidden on desktop where the rail is
            always visible alongside the lesson pane */}
        <button
          className="md:hidden flex items-center gap-1.5"
          onClick={() => setRailOpen((v) => !v)}
          style={{
            position: 'absolute',
            top: 14,
            right: 16,
            zIndex: 20,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 12,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
          aria-expanded={railOpen}
          aria-label="Toggle module list"
        >
          <BookOpen size={12} aria-hidden="true" />
          Modules
          <ChevronDown
            size={11}
            style={{ transform: railOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}
            aria-hidden="true"
          />
        </button>

        {/* ── Left rail — fills parent height, scrolls internally ─────── */}
        <nav
          aria-label="Lesson modules"
          className={clsx(railOpen ? 'flex' : 'hidden', 'md:flex')}
          style={{
            width: 220,
            minWidth: 220,
            flexShrink: 0,
            flexDirection: 'column',
            borderRight: '1px solid var(--border-subtle)',
            overflowY: 'auto',
            paddingTop: 12,
            paddingBottom: 12,
            height: '100%',
          }}
        >
          {MODULES.map((mod) => {
            const expanded = expandedModules.has(mod.id);
            const modLessonIds = mod.lessons.map((l) => l.id);
            const modDone = modLessonIds.filter((id) => progress[id]).length;
            const modTotal = modLessonIds.length;
            const isActiveModule = mod.lessons.some((l) => l.id === currentLessonId);

            return (
              <div key={mod.id}>
                <button
                  onClick={() => toggleModule(mod.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 14px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  aria-expanded={expanded}
                >
                  <span style={{ color: isActiveModule ? 'var(--tile-correct)' : 'var(--text-ghost)', flexShrink: 0 }}>
                    {MODULE_ICONS[mod.id]}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontWeight: 600,
                      color: isActiveModule ? 'var(--text-primary)' : 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {mod.title}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: 'var(--font-display)',
                      color: modDone === modTotal ? 'var(--tile-correct)' : 'var(--text-ghost)',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {modDone}/{modTotal}
                  </span>
                  <ChevronDown
                    size={11}
                    style={{
                      color: 'var(--text-ghost)',
                      transform: expanded ? 'rotate(180deg)' : 'none',
                      transition: 'transform 200ms',
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                </button>

                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      {mod.lessons.map((lesson) => {
                        const done = !!progress[lesson.id];
                        const isCurrent = lesson.id === currentLessonId;
                        const lessonIdx = LESSON_ORDER.indexOf(lesson.id);

                        return (
                          <button
                            key={lesson.id}
                            onClick={() => goTo(lessonIdx)}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 8,
                              padding: '5px 14px 5px 28px',
                              background: isCurrent
                                ? 'color-mix(in srgb, var(--tile-correct) 10%, transparent)'
                                : 'transparent',
                              border: 'none',
                              borderLeft: isCurrent
                                ? '2px solid var(--tile-correct)'
                                : '2px solid transparent',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            {done ? (
                              <Check
                                size={11}
                                aria-hidden="true"
                                style={{ color: 'var(--tile-correct)', flexShrink: 0, marginTop: 2 }}
                              />
                            ) : (
                              <span
                                style={{
                                  width: 11,
                                  height: 11,
                                  borderRadius: '50%',
                                  border: '1.5px solid var(--border-default)',
                                  flexShrink: 0,
                                  display: 'inline-block',
                                  marginTop: 2,
                                }}
                              />
                            )}
                            <span
                              style={{
                                fontSize: 12,
                                color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontWeight: isCurrent ? 600 : 400,
                                lineHeight: 1.35,
                              }}
                            >
                              {lesson.title}
                            </span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* ── Main lesson pane ──────────────────────────────────────── */}
        <main
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}
          aria-live="polite"
          aria-label="Current lesson"
        >
          {/* Lesson eyebrow + title */}
          <div
            style={{
              padding: '16px 24px 12px',
              borderBottom: '1px solid var(--border-subtle)',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--text-ghost)',
                fontWeight: 600,
              }}
            >
              {currentModule?.title} &middot; Lesson {lessonNumInModule + 1}
            </span>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: '3px 0 0 0',
                lineHeight: 1.25,
              }}
            >
              {currentLesson?.title}
            </h2>
          </div>

          {/* Scrollable lesson content — fills the space between the
              lesson header and the bottom nav bar */}
          <div
            style={{
              overflowY: 'auto',
              padding: '18px 24px 16px',
              flex: 1,
              minHeight: 0,
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentLessonId}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                {LESSON_COMPONENTS[currentLessonId] ?? (
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>
                    Lesson not found.
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation bar */}
          <div
            style={{
              flexShrink: 0,
              borderTop: '1px solid var(--border-subtle)',
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              height: 62,
              background: 'var(--bg-base)',
            }}
          >
            {/* Prev */}
            <button
              onClick={() => hasPrev && goTo(currentIdx - 1)}
              disabled={!hasPrev}
              aria-label="Previous lesson"
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: hasPrev ? 'var(--text-primary)' : 'var(--text-ghost)',
                fontSize: 13,
                fontWeight: 600,
                cursor: hasPrev ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                opacity: hasPrev ? 1 : 0.35,
                flexShrink: 0,
              }}
            >
              <ChevronLeft size={14} aria-hidden="true" />
              Prev
            </button>

            {/* Dot progress indicator */}
            <div
              role="group"
              aria-label={`Lesson ${currentIdx + 1} of ${LESSON_ORDER.length}`}
              style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}
            >
              {LESSON_ORDER.map((id, i) => (
                <button
                  key={id}
                  onClick={() => goTo(i)}
                  aria-label={`Go to lesson ${i + 1}`}
                  aria-current={i === currentIdx ? 'step' : undefined}
                  style={{
                    width: i === currentIdx ? 20 : 7,
                    height: 7,
                    borderRadius: 4,
                    background: i === currentIdx
                      ? 'var(--tile-correct)'
                      : progress[id]
                      ? 'color-mix(in srgb, var(--tile-correct) 45%, var(--bg-muted))'
                      : 'var(--bg-muted)',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'width 200ms ease, background 200ms ease',
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>

            {/* Got it / Finish */}
            {hasNext ? (
              <button
                onClick={() => { markComplete(); goTo(currentIdx + 1); }}
                aria-label="Mark complete and go to next lesson"
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  background: 'var(--tile-correct)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  flexShrink: 0,
                }}
              >
                Got it
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            ) : (
              <button
                onClick={markComplete}
                aria-label="Mark final lesson complete"
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  background: progress[currentLessonId] ? 'var(--bg-muted)' : 'var(--tile-correct)',
                  border: '1px solid var(--border-subtle)',
                  color: progress[currentLessonId] ? 'var(--text-secondary)' : '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  flexShrink: 0,
                }}
              >
                {progress[currentLessonId] ? (
                  <>
                    <Check size={13} aria-hidden="true" />
                    Done
                  </>
                ) : (
                  'Finish'
                )}
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
