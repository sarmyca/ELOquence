'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { aiApi } from '@/lib/api';

interface Props {
  gameId: string;
  moveNumber: number;
  visible: boolean;
}

function ShimmerLine({ width }: { width: string }) {
  return (
    <div
      className="skeleton rounded bg-bg-elevated animate-pulse"
      style={{ width, height: 12 }}
    />
  );
}

export default function MoveExplanation({ gameId, moveNumber, visible }: Props) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
          <div className="px-3 pb-2 pt-2 bg-[#1565c0]/5 rounded-lg border border-[#1565c0]/10">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-[#6aaa64] block mb-1.5">
              AI Coach
            </span>

            {loading && (
              <div className="flex flex-col gap-1.5">
                <ShimmerLine width="100%" />
                <ShimmerLine width="80%" />
              </div>
            )}

            {error && !loading && (
              <p className="text-xs text-text-ghost">{error}</p>
            )}

            {explanation && !loading && (
              <div className="flex items-start gap-1.5">
                <MessageCircle size={11} className="text-[#6aaa64] mt-0.5 shrink-0" />
                <p className="text-xs text-text-secondary leading-relaxed">{explanation}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
