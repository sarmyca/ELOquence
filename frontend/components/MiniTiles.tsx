'use client';
import { patternToTiles, TileState } from '@/lib/types';

interface MiniTilesProps {
  pattern: number;
  size?: number;
}

const STATE_STYLE: Record<TileState, string> = {
  correct: 'var(--tile-correct)',
  present: 'var(--tile-present)',
  absent:  'var(--tile-absent)',
  empty:   'var(--tile-empty-bg)',
  tbd:     'var(--tile-empty-bg)',
};

const BORDER_STYLE: Record<TileState, string | undefined> = {
  correct: undefined,
  present: undefined,
  absent:  undefined,
  empty:   'var(--tile-empty-border)',
  tbd:     'var(--tile-empty-border)',
};

export default function MiniTiles({ pattern, size = 14 }: MiniTilesProps) {
  const tiles = patternToTiles(pattern);

  return (
    <div className="flex gap-0.5">
      {tiles.map((state, i) => (
        <div
          key={i}
          style={{
            width: size,
            height: size,
            backgroundColor: STATE_STYLE[state],
            border: BORDER_STYLE[state] ? `1px solid ${BORDER_STYLE[state]}` : undefined,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}
