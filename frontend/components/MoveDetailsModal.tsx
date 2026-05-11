'use client';
import Modal from '@/components/Modal';
import { TopPick, MoveAnalysis } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  move: MoveAnalysis | null;
}

/**
 * MoveDetailsModal — lists remaining candidates with probability bars.
 * Uses existing Modal component. Light-theme token colours throughout.
 */
export default function MoveDetailsModal({ open, onClose, move }: Props) {
  if (!move) return null;

  const candidates: TopPick[] = (move.candidates_top_n ?? move.top_picks ?? []).slice(0, 20);
  const maxProb = candidates.length > 0
    ? Math.max(...candidates.map(c => c.probability ?? c.expected_remaining))
    : 1;

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-md" label="Move Details">
      <div className="px-5 py-4">
        {/* Header */}
        <div className="mb-3">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider mb-0.5"
            style={{ color: 'var(--text-ghost)' }}
          >
            Move {move.move_number}
          </p>
          <h2
            className="text-lg font-mono font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-primary)' }}
          >
            {move.guess_word}
          </h2>
        </div>

        {/* Key metrics row */}
        <div
          className="grid grid-cols-3 gap-2 mb-4 p-3 rounded-xl"
          style={{ backgroundColor: 'var(--bg-muted)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex flex-col gap-0.5">
            <span
              className="text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-ghost)' }}
            >
              Skill
            </span>
            <span
              className="text-base font-display font-bold tabular-nums"
              style={{
                color: (move.skill_score ?? 0) >= 80
                  ? 'var(--tile-correct)'
                  : (move.skill_score ?? 0) >= 50
                  ? 'var(--tile-present)'
                  : 'var(--red)',
              }}
            >
              {move.skill_score ?? '—'}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span
              className="text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-ghost)' }}
            >
              Luck
            </span>
            <span
              className="text-base font-display font-bold tabular-nums"
              style={{
                color: (move.luck_score ?? 50) >= 80
                  ? '#1565c0'
                  : (move.luck_score ?? 50) >= 30
                  ? 'var(--text-secondary)'
                  : 'var(--red)',
              }}
            >
              {move.luck_score ?? 50}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span
              className="text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-ghost)' }}
            >
              Remaining
            </span>
            <span
              className="text-base font-display font-bold tabular-nums"
              style={{ color: 'var(--text-primary)' }}
            >
              {move.remaining_before ?? move.remaining_words ?? '—'} → {move.remaining_after}
            </span>
          </div>
        </div>

        {/* Bot pick */}
        {move.bot_pick && (
          <div
            className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg"
            style={{ backgroundColor: 'var(--bg-muted)', border: '1px solid var(--border-subtle)' }}
          >
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-ghost)' }}
            >
              Bot Pick
            </span>
            <span
              className="font-mono font-bold uppercase text-sm"
              style={{
                color: move.bot_pick === move.guess_word
                  ? 'var(--tile-correct)'
                  : 'var(--text-secondary)',
              }}
            >
              {move.bot_pick}
            </span>
            {move.bot_pick_rationale && (
              <span
                className="text-xs flex-1 text-right"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {move.bot_pick_rationale}
              </span>
            )}
          </div>
        )}

        {/* Remaining candidates list */}
        {candidates.length > 0 && (
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--text-ghost)' }}
            >
              Top Remaining Candidates
            </p>

            {/* Column headers */}
            <div
              className="grid grid-cols-[1.5rem_1fr_3.5rem_4rem] px-2 py-1 text-[9px] font-semibold uppercase tracking-wider mb-1"
              style={{
                color: 'var(--text-ghost)',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <span>#</span>
              <span>Word</span>
              <span className="text-right">Prob.</span>
              <span className="text-right">Exp. Rem.</span>
            </div>

            <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto">
              {candidates.map((c, idx) => {
                const prob = c.probability ?? 0;
                const barPct = maxProb > 0 ? (prob / maxProb) * 100 : 0;
                const isPlayer = c.word === move.guess_word;

                return (
                  <div
                    key={c.word}
                    className="grid grid-cols-[1.5rem_1fr_3.5rem_4rem] items-center px-2 py-1 rounded-md"
                    style={{
                      backgroundColor: idx === 0 ? 'rgba(106,170,100,0.08)' : 'transparent',
                    }}
                  >
                    <span
                      className="text-[10px] font-mono tabular-nums"
                      style={{ color: 'var(--text-ghost)' }}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="font-mono font-semibold uppercase text-xs"
                        style={{
                          color: idx === 0
                            ? 'var(--tile-correct)'
                            : isPlayer
                            ? 'var(--tile-present)'
                            : 'var(--text-primary)',
                        }}
                      >
                        {c.word}
                      </span>
                      {isPlayer && (
                        <span
                          className="text-[9px]"
                          style={{ color: 'var(--text-ghost)' }}
                        >
                          (you)
                        </span>
                      )}
                      {/* Probability bar */}
                      <div
                        className="flex-1 rounded-full overflow-hidden"
                        style={{ height: 3, backgroundColor: 'var(--border-subtle)' }}
                      >
                        <div
                          style={{
                            width: `${barPct}%`,
                            height: '100%',
                            backgroundColor: idx === 0 ? 'var(--tile-correct)' : 'var(--tile-present)',
                            borderRadius: 9999,
                          }}
                        />
                      </div>
                    </div>
                    <span
                      className="font-mono tabular-nums text-[10px] text-right"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {prob > 0 ? `${(prob * 100).toFixed(1)}%` : '—'}
                    </span>
                    <span
                      className="font-mono tabular-nums text-[10px] text-right"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      ~{c.expected_remaining.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {candidates.length === 0 && (
          <p
            className="text-sm text-center py-4"
            style={{ color: 'var(--text-ghost)' }}
          >
            No candidate data available.
          </p>
        )}
      </div>
    </Modal>
  );
}
