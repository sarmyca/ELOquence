'use client';
import { motion } from 'framer-motion';
import Tile from './Tile';
import { TileState, patternToTiles } from '@/lib/types';

interface GameBoardProps {
  guesses: string[];
  patterns: number[];
  currentGuess: string;
  shakeRow: number;
  /** Index of the row currently performing its flip reveal (-1 means none) */
  revealRow: number;
  /**
   * True while a submitted guess is in flight to the server (before the reveal
   * starts). Pulses the active row so the guess visibly "registers" instantly
   * instead of sitting frozen until the response lands.
   */
  isAwaiting?: boolean;
  maxGuesses?: number;
}

export default function GameBoard({
  guesses,
  patterns,
  currentGuess,
  shakeRow,
  revealRow,
  isAwaiting = false,
  maxGuesses = 6,
}: GameBoardProps) {
  type RowData = {
    letters: string[];
    states: TileState[];
    isSubmitted: boolean;
    isFlippingRow: boolean;
  };

  // Determine if a submitted row is a win row (all 5 tiles correct)
  const isWinRow = (rowIndex: number): boolean => {
    if (rowIndex >= guesses.length) return false;
    const tiles = patternToTiles(patterns[rowIndex]);
    return tiles.every((t) => t === 'correct');
  };

  const rows: RowData[] = [];

  for (let i = 0; i < maxGuesses; i++) {
    if (i < guesses.length) {
      const tiles = patternToTiles(patterns[i]);
      rows.push({
        letters: guesses[i].split(''),
        states: tiles,
        isSubmitted: true,
        isFlippingRow: i === revealRow,
      });
    } else if (i === guesses.length) {
      const letters = currentGuess.split('');
      const states: TileState[] = Array(5)
        .fill('empty')
        .map((_, j) => (letters[j] ? 'tbd' : 'empty'));
      rows.push({
        letters: [...letters, ...Array(5 - letters.length).fill('')],
        states,
        isSubmitted: false,
        isFlippingRow: false,
      });
    } else {
      rows.push({
        letters: Array(5).fill(''),
        states: Array(5).fill('empty') as TileState[],
        isSubmitted: false,
        isFlippingRow: false,
      });
    }
  }

  return (
    <div
      role="grid"
      aria-label="Wordle game board"
      className="flex flex-col items-center"
      style={{ gap: 'var(--tile-gap)' }}
    >
      {rows.map((row, rowIndex) => {
        // The active (just-submitted, not-yet-revealed) row pulses while the
        // guess is in flight. Shake and pulse never overlap, so a single
        // animate/transition pair covers both.
        const isAwaitingRow = isAwaiting && rowIndex === guesses.length;
        return (
        <motion.div
          key={rowIndex}
          role="row"
          className="flex"
          style={{ gap: 'var(--tile-gap)' }}
          animate={
            shakeRow === rowIndex
              ? { x: [0, -8, 8, -6, 6, -3, 3, 0] }
              : isAwaitingRow
              ? { opacity: [1, 0.4, 1] }
              : { x: 0, opacity: 1 }
          }
          transition={
            shakeRow === rowIndex
              ? { duration: 0.45, ease: 'easeInOut' }
              : isAwaitingRow
              ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0 }
          }
        >
          {row.letters.map((letter, colIndex) => {
            const winReady = isWinRow(rowIndex) && revealRow < rowIndex;
            return (
              <div
                key={colIndex}
                role="gridcell"
                style={
                  winReady
                    ? {
                        animation: 'win-bounce 600ms ease',
                        animationDelay: `${colIndex * 100}ms`,
                        animationFillMode: 'both',
                      }
                    : undefined
                }
              >
                <Tile
                  letter={letter}
                  state={row.states[colIndex]}
                  position={colIndex}
                  isFlipping={row.isFlippingRow}
                  flipDelay={row.isFlippingRow ? colIndex * 0.15 : 0}
                />
              </div>
            );
          })}
        </motion.div>
        );
      })}
    </div>
  );
}
