'use client';
import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, FastForward } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  totalMoves: number;
  currentMove: number;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSetMove: (n: number) => void;
  speed: number;
  onSpeedChange: (s: number) => void;
}

const SPEEDS = [0.5, 1, 2];

export default function AutoPlayControls({
  totalMoves,
  currentMove,
  isPlaying,
  onPlay,
  onPause,
  onReset,
  onSetMove,
  speed,
  onSpeedChange,
}: Props) {
  const progressRef = useRef<HTMLDivElement>(null);

  const pct = totalMoves > 0 ? (currentMove / totalMoves) * 100 : 0;

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect) return;
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSetMove(Math.round(frac * totalMoves));
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-[#1e1f23] border border-white/[0.08] px-3 py-2">
      {/* Reset */}
      <motion.button
        onClick={onReset}
        whileTap={{ scale: 0.88 }}
        className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-white/[0.06] transition-colors"
        aria-label="Reset to beginning"
      >
        <RotateCcw size={14} />
      </motion.button>

      {/* Play / Pause */}
      <motion.button
        onClick={isPlaying ? onPause : onPlay}
        whileTap={{ scale: 0.88 }}
        className="p-1.5 rounded-md bg-[#538d4e] hover:bg-[#6aaa64] text-white transition-colors"
        aria-label={isPlaying ? 'Pause auto-play' : 'Start auto-play'}
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
      </motion.button>

      {/* Progress bar */}
      <div
        ref={progressRef}
        className="flex-1 h-1.5 rounded-full bg-bg-tertiary overflow-visible relative cursor-pointer"
        onClick={handleProgressClick}
        role="slider"
        aria-valuenow={currentMove}
        aria-valuemin={0}
        aria-valuemax={totalMoves}
        aria-label="Playback position"
      >
        <motion.div
          className="h-full rounded-full bg-[#538d4e] relative"
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          {/* Thumb */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#6aaa64] border-2 border-[#1e1f23] shadow" />
        </motion.div>
      </div>

      {/* Move counter */}
      <span className="font-mono tabular-nums text-[11px] text-text-ghost shrink-0">
        {currentMove}/{totalMoves}
      </span>

      {/* Speed selector */}
      <div className="flex items-center gap-0.5">
        <FastForward size={12} className="text-text-ghost mr-0.5" />
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={clsx(
              'px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors',
              speed === s
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-ghost hover:text-text-secondary'
            )}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
