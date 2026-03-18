'use client';
import { motion } from 'framer-motion';
import Tile from './Tile';
import { TileState, patternToTiles } from '@/lib/types';

interface GameBoardProps {
  guesses: string[];
  patterns: number[];
  currentGuess: string;
  shakeRow: number;
  /** Index of the row that is currently performing its flip reveal (-1 means none) */
  revealRow: number;
  maxGuesses?: number;
}

export default function GameBoard({
  guesses,
  patterns,
  currentGuess,
  shakeRow,
  revealRow,
  maxGuesses = 6,
}: GameBoardProps) {
  type RowData = {
    letters: string[];
    states: TileState[];
    isSubmitted: boolean;
    isFlippingRow: boolean;
  };

  const rows: RowData[] = [];

  for (let i = 0; i < maxGuesses; i++) {
    if (i < guesses.length) {
      // Submitted row — show revealed colors
      const tiles = patternToTiles(patterns[i]);
      rows.push({
        letters: guesses[i].split(''),
        states: tiles,
        isSubmitted: true,
        // Only the revealRow is currently in its flip animation
        isFlippingRow: i === revealRow,
      });
    } else if (i === guesses.length) {
      // Current input row
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
      // Empty future row
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
      {rows.map((row, rowIndex) => (
        <motion.div
          key={rowIndex}
          role="row"
          className="flex"
          style={{ gap: 'var(--tile-gap)' }}
          animate={shakeRow === rowIndex ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
          transition={
            shakeRow === rowIndex
              ? { duration: 0.45, ease: 'easeInOut' }
              : { duration: 0 }
          }
        >
          {row.letters.map((letter, colIndex) => (
            <div key={colIndex} role="gridcell">
              <Tile
                letter={letter}
                state={row.states[colIndex]}
                position={colIndex}
                isFlipping={row.isFlippingRow}
                flipDelay={row.isFlippingRow ? colIndex * 0.15 : 0}
              />
            </div>
          ))}
        </motion.div>
      ))}
    </div>
  );
}
