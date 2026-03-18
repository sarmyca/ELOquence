'use client';
import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

export interface GameStateNodeData {
  id: string;
  remaining_count: number;
  entropy: number;
  example_words: string[];
  is_start: boolean;
  is_accept: boolean;
  is_critical_decision: boolean;
  depth: number;
  isPlayerPath: boolean;
  isOptimalPath: boolean;
  onExplore?: (nodeId: string) => void;
}

function GameStateNode({ data, selected }: NodeProps<GameStateNodeData>) {
  const [showExplore, setShowExplore] = useState(false);

  // Node size proportional to remaining words (log scale)
  const logSize = Math.max(1, Math.log2(data.remaining_count + 1));
  const maxLog = Math.log2(2400); // ~11.2
  const sizeRatio = logSize / maxLog;
  const nodeWidth = 90 + sizeRatio * 60;  // 90-150px
  const nodeHeight = 56 + sizeRatio * 30; // 56-86px

  const isOnPath = data.isPlayerPath || data.isOptimalPath;

  // Accept state: double-ring + pulsing green glow
  if (data.is_accept) {
    return (
      <div className="relative">
        <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 10, stiffness: 200, delay: 0.3 }}
          className="flex items-center justify-center"
          style={{ width: 48, height: 48 }}
        >
          {/* Outer ring */}
          <div
            className="absolute rounded-full border-2 border-[#538d4e]"
            style={{ width: 48, height: 48, boxShadow: '0 0 16px rgba(83,141,78,0.4), 0 0 32px rgba(83,141,78,0.15)' }}
          />
          {/* Inner ring */}
          <div
            className="absolute rounded-full border-2 border-[#538d4e] flex items-center justify-center"
            style={{ width: 36, height: 36 }}
          >
            <span className="text-[10px] font-mono font-bold text-[#6aaa64]">1</span>
          </div>
          {/* Pulsing glow */}
          <motion.div
            className="absolute rounded-full"
            style={{ width: 48, height: 48, border: '2px solid rgba(83,141,78,0.5)' }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
        <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
      </div>
    );
  }

  return (
    <div
      className="relative group"
      onMouseEnter={() => setShowExplore(true)}
      onMouseLeave={() => setShowExplore(false)}
    >
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />

      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className={clsx(
          'rounded-xl border px-3 py-2 flex flex-col items-center justify-center transition-all cursor-pointer',
          isOnPath
            ? 'bg-bg-secondary border-white/[0.15]'
            : 'bg-bg-tertiary/60 border-white/[0.06]',
          data.is_critical_decision && 'ring-1 ring-[#b59f3b]/40',
          selected && 'ring-2 ring-[#538d4e]/60',
        )}
        style={{ width: nodeWidth, height: nodeHeight }}
      >
        {/* Remaining count */}
        <span
          className={clsx(
            'font-mono font-bold tabular-nums leading-none',
            data.remaining_count > 100 ? 'text-lg' : 'text-xl',
            isOnPath ? 'text-text-primary' : 'text-text-secondary',
          )}
        >
          {data.remaining_count.toLocaleString()}
        </span>

        {/* Entropy */}
        <span className="text-[9px] font-mono text-text-ghost mt-0.5 tabular-nums">
          {data.entropy.toFixed(2)} bits
        </span>

        {/* Critical decision indicator */}
        {data.is_critical_decision && (
          <span className="text-[8px] text-[#b59f3b] mt-0.5 font-medium">
            CRITICAL
          </span>
        )}

        {/* Start label */}
        {data.is_start && (
          <span className="text-[8px] text-text-ghost mt-0.5 uppercase tracking-wider">
            START
          </span>
        )}
      </motion.div>

      {/* Hover panel: example words + explore */}
      <AnimatePresence>
        {showExplore && !data.is_accept && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 bg-[#2a2a2c] border border-[#4a4a4c] rounded-lg shadow-xl px-3 py-2 min-w-[140px]"
          >
            {data.example_words.length > 0 && (
              <div className="mb-1.5">
                <p className="text-[8px] text-text-ghost uppercase tracking-wider mb-1">Examples</p>
                <div className="flex flex-wrap gap-1">
                  {data.example_words.slice(0, 4).map((w) => (
                    <span key={w} className="text-[10px] font-mono text-text-secondary uppercase px-1 py-0.5 rounded bg-bg-tertiary">
                      {w}
                    </span>
                  ))}
                  {data.remaining_count > 4 && (
                    <span className="text-[10px] text-text-ghost">
                      +{data.remaining_count - 4} more
                    </span>
                  )}
                </div>
              </div>
            )}
            {data.onExplore && !data.is_accept && data.remaining_count > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  data.onExplore?.(data.id);
                }}
                className="w-full text-[10px] font-medium text-[#6aaa64] hover:text-[#538d4e] bg-[#538d4e]/10 hover:bg-[#538d4e]/20 rounded px-2 py-1 transition-colors mt-1"
              >
                Explore from here
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
    </div>
  );
}

export default memo(GameStateNode);
