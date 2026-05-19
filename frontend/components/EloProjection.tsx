'use client';

import clsx from 'clsx';
import { projectEloByOutcome } from '@/lib/elo';
import type { Game } from '@/lib/types';

/**
 * Renders a 7-cell grid showing the ELO delta the player WOULD have
 * received for each possible game outcome (solved in 1..6 guesses, or
 * failed = X/6), holding their actual accuracy and time fixed. The cell
 * matching the actual result is highlighted.
 *
 * Only sensible for rated games where we have a player ELO + word ELO;
 * the parent should gate the render on `game.rated` and the presence
 * of those fields. We accept the Game object directly to keep the
 * call-site minimal.
 */
export default function EloProjection({
  game,
  accuracy,
}: {
  game: Game;
  accuracy: number;
}) {
  if (
    !game.rated ||
    game.elo_before == null ||
    game.word_difficulty == null
  ) {
    return null;
  }

  const rows = projectEloByOutcome({
    playerElo: game.elo_before,
    wordElo: game.word_difficulty,
    accuracy,
    timeSeconds: game.time_seconds ?? null,
    includeTime: game.mode === 'competitive',
    isPlacement: game.is_placement,
    actualNumGuesses: game.num_guesses,
    actualWon: game.status === 'won',
  });

  return (
    <section
      aria-label="ELO distribution"
      className="rounded-card-lg overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-base)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div
        className="px-4 pt-3 pb-2 flex items-baseline justify-between"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-wider font-display"
          style={{ color: 'var(--text-secondary)' }}
        >
          ELO distribution
        </span>
        <span
          className="text-[10px] font-sans"
          style={{ color: 'var(--text-tertiary)' }}
        >
          accuracy held at {Math.round(accuracy)}%
        </span>
      </div>

      <div className="grid grid-cols-7 gap-0">
        {rows.map((row) => {
          const positive = row.delta > 0;
          const negative = row.delta < 0;
          const fillColor = positive
            ? 'var(--tile-correct)'
            : negative
            ? 'var(--red)'
            : 'var(--text-secondary)';

          return (
            <div
              key={row.label}
              className={clsx('flex flex-col items-center justify-center py-2.5')}
              style={{
                backgroundColor: row.isActual
                  ? 'color-mix(in srgb, var(--tile-correct) 8%, transparent)'
                  : 'transparent',
                borderLeft: row.label === '1/6' ? 'none' : '1px solid var(--border-subtle)',
                borderTop: row.isActual ? '2px solid var(--tile-correct)' : '2px solid transparent',
              }}
            >
              <span
                className="text-[10px] font-mono tabular-nums"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {row.label}
              </span>
              <span
                className="text-sm font-mono font-bold tabular-nums mt-0.5"
                style={{ color: fillColor }}
              >
                {positive ? '+' : ''}
                {row.delta}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
