'use client';
import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import MiniTiles from '@/components/MiniTiles';
import { CLASSIFICATION_CONFIG, Classification } from '@/lib/types';

export interface GuessEdgeData {
  guess_word: string;
  pattern: number;
  info_gained: number;
  classification: string;
  is_player_path: boolean;
  is_optimal_path: boolean;
  is_alternative: boolean;
}

function GuessEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  data,
  style,
}: EdgeProps<GuessEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
  });

  const isPlayer = data?.is_player_path;
  const isOptimal = data?.is_optimal_path;
  const isAlt = data?.is_alternative;

  const classification = data?.classification as Classification | undefined;
  const config = classification ? CLASSIFICATION_CONFIG[classification] : null;
  const edgeColor = isPlayer && config ? config.color : isOptimal ? '#538d4e' : 'rgba(255,255,255,0.15)';

  // Edge thickness based on quality
  const strokeWidth = isPlayer ? 3 : isOptimal ? 2 : 1;
  const opacity = isAlt ? 0.35 : 1;
  const strokeDasharray = isOptimal && !isPlayer ? '6 4' : undefined;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: edgeColor,
          strokeWidth,
          opacity,
          strokeDasharray,
          ...style,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            opacity,
          }}
        >
          <div
            className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-md"
            style={{
              backgroundColor: 'rgba(15,16,18,0.9)',
              border: `1px solid ${isPlayer || isOptimal ? edgeColor + '40' : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            {/* Guess word */}
            <span
              className="text-[10px] font-mono font-bold uppercase tracking-wider"
              style={{ color: isPlayer || isOptimal ? edgeColor : '#9ba1a6' }}
            >
              {data?.guess_word}
            </span>
            {/* Mini tiles */}
            {data?.pattern !== undefined && (
              <MiniTiles pattern={data.pattern} size={8} />
            )}
            {/* Info gained */}
            <span className="text-[8px] font-mono text-text-ghost tabular-nums">
              {data?.info_gained?.toFixed(2)}b
            </span>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(GuessEdge);
