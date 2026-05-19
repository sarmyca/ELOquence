'use client';

/**
 * Branded loading indicator: a row of small Wordle tiles whose colors
 * pulse through the in-game palette (absent → present → correct) in a
 * staggered wave. Visually anchors loading states in the same vocabulary
 * the player uses to read game results, so the screen never goes "blank"
 * with a generic spinner.
 *
 * The animation respects `prefers-reduced-motion` via the
 * `[data-reduce-motion]` / `.reduce-motion` flags that the app's layout
 * bootstrap script sets when the user opts out of motion in Settings.
 */

interface TileSpinnerProps {
  /** sm: ~14px tiles (inline / button), md: ~22px (default panel), lg: ~34px (full-page) */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible label announced by screen readers. Defaults to "Loading". */
  label?: string;
  /** Number of tiles (default 5 — matches Wordle row length). */
  count?: number;
}

const SIZE_MAP: Record<NonNullable<TileSpinnerProps['size']>, { tile: number; gap: number; radius: number }> = {
  sm: { tile: 12, gap: 3, radius: 2 },
  md: { tile: 22, gap: 4, radius: 3 },
  lg: { tile: 34, gap: 6, radius: 4 },
};

export default function TileSpinner({
  size = 'md',
  label = 'Loading',
  count = 5,
}: TileSpinnerProps) {
  const dim = SIZE_MAP[size];
  return (
    <div
      role="status"
      aria-label={label}
      className="inline-flex"
      style={{ gap: dim.gap }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="tile-spinner-cell"
          aria-hidden="true"
          style={{
            width: dim.tile,
            height: dim.tile,
            borderRadius: dim.radius,
            animationDelay: `${i * 0.14}s`,
          }}
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
