'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, AlertTriangle, Info, CheckCircle, RefreshCw } from 'lucide-react';
import { aiApi } from '@/lib/api';
import { AnalysisResult } from '@/lib/types';
import clsx from 'clsx';

interface Pattern {
  pattern_type: string;
  description: string;
  severity: 'positive' | 'warning' | 'info';
  move_number?: number;
}

interface Props {
  gameId: string;
  analysis: AnalysisResult | null;
}

function ShimmerLine({ width }: { width: string }) {
  return (
    <div
      className="skeleton rounded bg-bg-tertiary animate-pulse"
      style={{ width, height: 12 }}
    />
  );
}

const SEVERITY_STYLES: Record<
  Pattern['severity'],
  { bg: string; border: string; text: string; Icon: typeof CheckCircle }
> = {
  positive: {
    bg: 'bg-[#538d4e]/10',
    border: 'border-[#538d4e]/20',
    text: 'text-[#6aaa64]',
    Icon: CheckCircle,
  },
  warning: {
    bg: 'bg-[#b59f3b]/10',
    border: 'border-[#b59f3b]/20',
    text: 'text-[#b59f3b]',
    Icon: AlertTriangle,
  },
  info: {
    bg: 'bg-[#1565c0]/10',
    border: 'border-[#1565c0]/20',
    text: 'text-[#6aaa64]',
    Icon: Info,
  },
};

export default function AiSummary({ gameId, analysis }: Props) {
  const [summary, setSummary] = useState<string | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [noKey, setNoKey] = useState(false);

  useEffect(() => {
    if (!gameId || !analysis) return;
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, analysis]);

  async function fetchSummary() {
    setLoading(true);
    setError('');
    setNoKey(false);
    try {
      const res = await aiApi.gameSummary(gameId);
      setSummary(res.data.summary);
      setPatterns(res.data.patterns || []);
    } catch (err: unknown) {
      const status =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 503 || status === 422) {
        setNoKey(true);
      } else {
        setError('AI summary unavailable');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="w-full rounded-2xl bg-bg-secondary border border-white/[0.08] p-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles size={14} color="#6aaa64" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
              AI Analysis
            </span>
          </div>
          {!loading && (summary || error) && !noKey && (
            <button
              onClick={fetchSummary}
              className="p-1 rounded-md text-text-ghost hover:text-text-secondary transition-colors"
              aria-label="Refresh AI analysis"
            >
              <RefreshCw size={11} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="mt-2">
          {loading && (
            <div className="flex flex-col gap-2 mt-1">
              <ShimmerLine width="100%" />
              <ShimmerLine width="85%" />
              <ShimmerLine width="70%" />
            </div>
          )}

          {noKey && !loading && (
            <p className="text-xs text-text-ghost mt-1">
              AI features require configuration.
            </p>
          )}

          {error && !loading && !noKey && (
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-[#e74c3c]">{error}</p>
              <button
                onClick={fetchSummary}
                className="text-xs text-text-secondary hover:text-text-primary transition-colors underline underline-offset-2 ml-2 shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {summary && !loading && (
            <>
              <p className="text-sm text-text-accent leading-relaxed">{summary}</p>

              {patterns.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {patterns.map((p, i) => {
                    const style = SEVERITY_STYLES[p.severity] ?? SEVERITY_STYLES.info;
                    const { Icon } = style;
                    return (
                      <span
                        key={i}
                        className={clsx(
                          'text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5',
                          style.bg,
                          style.border,
                          style.text
                        )}
                      >
                        <Icon size={10} />
                        {p.description}
                        {p.move_number !== undefined && (
                          <span className="opacity-60 font-mono">#{p.move_number}</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
