'use client';

export type TileState = 'correct' | 'present' | 'absent' | 'empty';

interface TileProps {
  letter: string;
  state: TileState;
  size?: 'sm' | 'md' | 'lg';
  revealed?: boolean;
  delay?: number;
}

function bgForState(state: TileState): string {
  if (state === 'correct') return 'var(--tile-correct)';
  if (state === 'present') return 'var(--tile-present)';
  if (state === 'absent') return 'var(--tile-absent)';
  return 'transparent';
}

function borderForState(state: TileState): string {
  if (state === 'empty') return '2px solid var(--tile-empty-border)';
  return 'none';
}

const SIZE_MAP = {
  sm: { width: 32, height: 32, fontSize: 12 },
  md: { width: 40, height: 40, fontSize: 15 },
  lg: { width: 48, height: 48, fontSize: 18 },
};

export function Tile({ letter, state, size = 'md', revealed = true }: TileProps) {
  const s = SIZE_MAP[size];
  return (
    <div
      style={{
        width: s.width,
        height: s.height,
        backgroundColor: revealed ? bgForState(state) : 'var(--bg-muted)',
        border: revealed ? borderForState(state) : '2px solid var(--border-default)',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 300ms ease, border-color 300ms ease',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: s.fontSize,
          fontWeight: 700,
          color: revealed && state !== 'empty' ? '#fff' : 'var(--text-primary)',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-sans)',
          lineHeight: 1,
        }}
      >
        {letter}
      </span>
    </div>
  );
}

interface TileRowProps {
  word: string;
  pattern: TileState[];
  size?: 'sm' | 'md' | 'lg';
  revealedCount?: number;
}

export function TileRow({ word, pattern, size = 'md', revealedCount }: TileRowProps) {
  const count = revealedCount ?? word.length;
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {word.split('').map((ch, i) => (
        <Tile
          key={i}
          letter={ch}
          state={i < count ? pattern[i] : 'empty'}
          size={size}
          revealed={i < count}
        />
      ))}
    </div>
  );
}
