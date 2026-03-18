'use client';
import { patternToTiles, TileState } from '@/lib/types';

interface MiniTilesProps {
  pattern: number;
  size?: number;
}

const STATE_COLORS: Record<TileState, string> = {
  correct: '#538d4e',
  present: '#b59f3b',
  absent: '#3a3a3c',
  empty: '#1e1f23',
  tbd: '#1e1f23',
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
            backgroundColor: STATE_COLORS[state],
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}
