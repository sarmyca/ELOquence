'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import type { SortIntoBucketsChallenge } from './types';

/* Drag-or-tap classification. To keep this simple + mobile-friendly we
 * skip HTML5 drag and use a tap-to-pick-then-tap-bucket interaction:
 *   1. Tap an unsorted item → it becomes "selected" (border highlight).
 *   2. Tap a bucket → the selected item moves there.
 *   3. Tap an already-sorted item to move it back to the unsorted strip.
 * Submit when every item is in some bucket. Compare against canonical.
 */

export default function SortIntoBuckets({
  challenge,
  onResolve,
}: {
  challenge: SortIntoBucketsChallenge;
  onResolve: (correct: boolean) => void;
}) {
  // assignments: itemId → bucketId | null
  const [assignments, setAssignments] = useState<Record<string, string | null>>(
    Object.fromEntries(challenge.items.map((it) => [it.id, null])),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const allAssigned = Object.values(assignments).every((b) => b !== null);

  function tapItem(id: string) {
    if (submitted) return;
    // If item is currently in a bucket, unassign it. Otherwise select it.
    if (assignments[id]) {
      setAssignments((prev) => ({ ...prev, [id]: null }));
      setSelectedId(null);
    } else {
      setSelectedId((prev) => (prev === id ? null : id));
    }
  }

  function tapBucket(bucketId: string) {
    if (submitted || !selectedId) return;
    setAssignments((prev) => ({ ...prev, [selectedId]: bucketId }));
    setSelectedId(null);
  }

  function submit() {
    setSubmitted(true);
    const allCorrect = challenge.items.every((it) => assignments[it.id] === it.bucketId);
    setTimeout(() => onResolve(allCorrect), allCorrect ? 1100 : 1700);
  }

  function reset() {
    setAssignments(Object.fromEntries(challenge.items.map((it) => [it.id, null])));
    setSelectedId(null);
    setSubmitted(false);
  }

  const unsorted = challenge.items.filter((it) => assignments[it.id] === null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0' }}>
      <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', margin: 0, textAlign: 'center', lineHeight: 1.4 }}>
        {challenge.prompt}
      </p>

      {/* Unsorted strip */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 6,
          minHeight: 44,
          padding: '6px 8px',
          borderRadius: 10,
          border: '1.5px dashed var(--border-default)',
          width: '100%',
          maxWidth: 520,
        }}
      >
        {unsorted.length === 0 ? (
          <span style={{ fontSize: 11, color: 'var(--text-ghost)', alignSelf: 'center' }}>
            All sorted — submit when ready
          </span>
        ) : (
          unsorted.map((it) => (
            <ItemChip
              key={it.id}
              item={it}
              selected={selectedId === it.id}
              onClick={() => tapItem(it.id)}
              outcome={null}
            />
          ))
        )}
      </div>

      {/* Buckets */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(challenge.buckets.length, 3)}, minmax(0, 1fr))`,
          gap: 10,
          width: '100%',
          maxWidth: 540,
        }}
      >
        {challenge.buckets.map((b) => {
          const inBucket = challenge.items.filter((it) => assignments[it.id] === b.id);
          return (
            <motion.button
              key={b.id}
              type="button"
              onClick={() => tapBucket(b.id)}
              whileHover={selectedId ? { y: -2 } : undefined}
              whileTap={selectedId ? { scale: 0.97 } : undefined}
              disabled={submitted}
              style={{
                background: 'var(--bg-elevated)',
                border: `2px solid ${selectedId ? 'var(--cls-blue, #3b82f6)' : 'var(--border-subtle)'}`,
                borderRadius: 12,
                padding: '10px 12px',
                cursor: selectedId && !submitted ? 'pointer' : 'default',
                minHeight: 110,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 6,
                transition: 'border-color 200ms ease',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-ghost)',
                  fontWeight: 700,
                }}
              >
                {b.label}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {inBucket.map((it) => (
                  <ItemChip
                    key={it.id}
                    item={it}
                    selected={false}
                    onClick={() => tapItem(it.id)}
                    outcome={submitted ? (it.bucketId === b.id ? 'correct' : 'wrong') : null}
                  />
                ))}
              </div>
            </motion.button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {submitted && (
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '8px 16px',
              borderRadius: 999,
              border: '1px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        )}
        {!submitted && (
          <button
            type="button"
            onClick={submit}
            disabled={!allAssigned}
            style={{
              padding: '8px 22px',
              borderRadius: 999,
              border: 'none',
              background: allAssigned ? 'var(--tile-correct)' : 'var(--bg-muted)',
              color: allAssigned ? '#fff' : 'var(--text-ghost)',
              fontSize: 13,
              fontWeight: 700,
              cursor: allAssigned ? 'pointer' : 'not-allowed',
              transition: 'all 200ms ease',
            }}
          >
            Submit
          </button>
        )}
      </div>

      <AnimatePresence>
        {submitted && challenge.successNote && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              maxWidth: 520,
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            {challenge.successNote}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ItemChip({
  item,
  selected,
  onClick,
  outcome,
}: {
  item: { id: string; label: string };
  selected: boolean;
  onClick: () => void;
  outcome: 'correct' | 'wrong' | null;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.96 }}
      style={{
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid',
        borderColor:
          outcome === 'correct'
            ? 'var(--tile-correct)'
            : outcome === 'wrong'
              ? 'var(--cls-red)'
              : selected
                ? 'var(--cls-blue, #3b82f6)'
                : 'var(--border-default)',
        background:
          outcome === 'correct'
            ? 'color-mix(in srgb, var(--tile-correct) 14%, transparent)'
            : outcome === 'wrong'
              ? 'color-mix(in srgb, var(--cls-red) 14%, transparent)'
              : selected
                ? 'color-mix(in srgb, var(--cls-blue, #3b82f6) 14%, transparent)'
                : 'var(--bg-base)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        cursor: 'pointer',
        transition: 'all 200ms ease',
      }}
    >
      {item.label}
    </motion.button>
  );
}
