'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, ChevronDown } from 'lucide-react';
import { aiApi } from '@/lib/api';
import { TopPick } from '@/lib/types';

interface Props {
  gameId: string;
  moveNumber: number;
  visible: boolean;
  /** Top candidate words with probabilities from backend */
  candidatesTopN?: TopPick[];
}

function ShimmerLine({ width }: { width: string }) {
  return (
    <div
      className="skeleton rounded animate-pulse"
      style={{ width, height: 12, backgroundColor: 'var(--bg-muted)' }}
    />
  );
}

export default function MoveExplanation({ gameId, moveNumber, visible, candidatesTopN }: Props) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCandidates, setShowCandidates] = useState(false);

  useEffect(() => {
    if (!visible || explanation) return;
    fetchExplanation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function fetchExplanation() {
    setLoading(true);
    setError('');
    try {
      const res = await aiApi.explainMove(gameId, moveNumber);
      setExplanation(res.data.explanation);
    } catch {
      setError('Explanation unavailable');
    } finally {
      setLoading(false);
    }
  }

  const topCandidates = (candidatesTopN ?? []).slice(0, 20);
  const maxProb = topCandidates.length > 0
    ? Math.max(...topCandidates.map(c => c.probability ?? c.expected_remaining))
    : 1;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="move-explanation"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden mx-3 mb-2"
        >
          <div
            className="px-3 pb-2 pt-2 rounded-lg"
            style={{
              backgroundColor: 'rgba(21, 101, 192, 0.05)',
              border: '1px solid rgba(21, 101, 192, 0.1)',
            }}
          >
            <span
              className="text-[9px] font-semibold uppercase tracking-wider block mb-1.5"
              style={{ color: 'var(--tile-correct)' }}
            >
              AI Coach
            </span>

            {loading && (
              <div className="flex flex-col gap-1.5">
                <ShimmerLine width="100%" />
                <ShimmerLine width="80%" />
              </div>
            )}

            {error && !loading && (
              <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>{error}</p>
            )}

            {explanation && !loading && (
              <div className="flex items-start gap-1.5">
                <MessageCircle size={11} className="mt-0.5 shrink-0" style={{ color: 'var(--tile-correct)' }} />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{explanation}</p>
              </div>
            )}

            {/* Show Details expander — top remaining candidates */}
            {topCandidates.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => setShowCandidates(!showCandidates)}
                  className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-expanded={showCandidates}
                >
                  Show Details
                  <ChevronDown
                    size={10}
                    style={{
                      transform: showCandidates ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.15s',
                    }}
                  />
                </button>

                <AnimatePresence>
                  {showCandidates && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden mt-1.5"
                    >
                      <div
                        className="rounded-lg p-2"
                        style={{ backgroundColor: 'var(--bg-muted)' }}
                      >
                        <p
                          className="text-[9px] font-semibold uppercase tracking-wider mb-1.5"
                          style={{ color: 'var(--text-ghost)' }}
                        >
                          Top Remaining Candidates
                        </p>
                        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                          {topCandidates.map((c, i) => {
                            const prob = c.probability ?? 0;
                            const barPct = maxProb > 0 ? (prob / maxProb) * 100 : 0;
                            return (
                              <div key={c.word} className="flex items-center gap-2">
                                <span
                                  className="text-[10px] font-mono w-4 tabular-nums"
                                  style={{ color: 'var(--text-ghost)' }}
                                >
                                  {i + 1}
                                </span>
                                <span
                                  className="text-[11px] font-mono font-semibold uppercase w-12 shrink-0"
                                  style={{ color: i === 0 ? 'var(--tile-correct)' : 'var(--text-primary)' }}
                                >
                                  {c.word}
                                </span>
                                <div
                                  className="flex-1 rounded-full overflow-hidden"
                                  style={{ height: 4, backgroundColor: 'var(--border-subtle)' }}
                                >
                                  <div
                                    style={{
                                      width: `${barPct}%`,
                                      height: '100%',
                                      backgroundColor: i === 0 ? 'var(--tile-correct)' : 'var(--tile-present)',
                                      borderRadius: 9999,
                                    }}
                                  />
                                </div>
                                <span
                                  className="text-[10px] font-mono tabular-nums w-10 text-right shrink-0"
                                  style={{ color: 'var(--text-secondary)' }}
                                >
                                  {(prob * 100).toFixed(1)}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
