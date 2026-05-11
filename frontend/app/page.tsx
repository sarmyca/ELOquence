'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useAnimate } from 'framer-motion';
import { useAuth } from '@/lib/hooks/useAuth';
import { springs, stagger } from '@/lib/animations';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

// Light-mode Wordle colors for the animated title tiles
const TILE_COLORS = ['#6aaa64', '#c9b458', '#787c7e'] as const;
const TITLE_CHARS = 'ELOQUENCE';

function randomizeTitleLetters() {
  return TITLE_CHARS.split('').map((char) => ({
    char,
    color: TILE_COLORS[Math.floor(Math.random() * TILE_COLORS.length)],
  }));
}

// ---------------------------------------------------------------------------
// SingleTile — animates in once on load, then is static (no perpetual hover)
// ---------------------------------------------------------------------------

interface SingleTileProps {
  tile: { char: string; color: string };
  index: number;
  bootDone: boolean;
  onBootComplete: () => void;
}

function SingleTile({ tile, index, bootDone, onBootComplete }: SingleTileProps) {
  return (
    <motion.span
      data-tile={index}
      initial={{ rotateX: 90, opacity: 0, scale: 0.85, y: 8 }}
      animate={{ rotateX: 0, opacity: 1, scale: 1, y: 0 }}
      transition={{
        ...springs.celebration,
        delay: 0.15 + index * 0.09,
      }}
      onAnimationComplete={() => {
        if (!bootDone) onBootComplete();
      }}
      className="relative flex items-center justify-center rounded-lg text-white select-none cursor-default font-display font-black"
      style={{
        width: 'clamp(2.75rem, 8vw, 5.25rem)',
        height: 'clamp(2.75rem, 8vw, 5.25rem)',
        fontSize: 'clamp(1.4rem, 4vw, 2.75rem)',
        backgroundColor: tile.color,
        letterSpacing: '-0.02em',
        transformStyle: 'preserve-3d',
        boxShadow: `0 4px 16px ${tile.color}30`,
      }}
    >
      {tile.char}
    </motion.span>
  );
}

// ---------------------------------------------------------------------------
// TitleRow
// ---------------------------------------------------------------------------

function TitleRow() {
  const [tiles] = useState(() => randomizeTitleLetters());
  const landedCount = useRef(0);
  const [bootDone, setBootDone] = useState(false);
  const [rowScope, animateRow] = useAnimate();

  const handleBootComplete = () => {
    landedCount.current += 1;
    if (landedCount.current === tiles.length) {
      setBootDone(true);
    }
  };

  useEffect(() => {
    if (!bootDone) return;
    const runPostLand = async () => {
      await new Promise<void>((r) => setTimeout(r, 60));
      await animateRow(
        'span[data-tile]',
        { scale: [1, 1.07, 1] },
        {
          duration: 0.4,
          ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
          delay: (i: number) => i * 0.035,
        },
      );
    };
    runPostLand();
  }, [bootDone, animateRow]);

  return (
    <motion.div
      ref={rowScope}
      className="relative flex gap-1.5 sm:gap-2"
      inherit={false}
      style={{ perspective: 900 }}
    >
      {tiles.map((tile, i) => (
        <SingleTile
          key={i}
          tile={tile}
          index={i}
          bootDone={bootDone}
          onBootComplete={handleBootComplete}
        />
      ))}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/play');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh" style={{ backgroundColor: 'var(--bg-base)' }}>
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center min-h-dvh px-4"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      <motion.div
        className="flex flex-col items-center text-center"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: stagger.slow },
        }}
      >
        {/* Animated title tiles */}
        <TitleRow />

        {/* Tagline */}
        <motion.p
          variants={{
            hidden: { opacity: 0, y: 14 },
            visible: { opacity: 1, y: 0, transition: springs.page },
          }}
          className="mt-8 text-xl sm:text-2xl font-semibold font-sans tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Competitive Wordle
        </motion.p>

        {/* Sub-tagline */}
        <motion.p
          variants={{
            hidden: { opacity: 0, y: 10 },
            visible: { opacity: 1, y: 0, transition: springs.page },
          }}
          className="mt-2 text-base font-sans"
          style={{ color: 'var(--text-secondary)' }}
        >
          Compete. Analyze. Improve.
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 10 },
            visible: { opacity: 1, y: 0, transition: springs.page },
          }}
          className="mt-10 flex flex-row gap-4"
        >
          <Link
            href="/play"
            className="inline-flex items-center justify-center px-10 py-3.5 rounded-xl text-white font-semibold text-sm transition-colors duration-200 active:scale-[0.97]"
            style={{ backgroundColor: 'var(--tile-correct)' }}
          >
            Play
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-transparent font-semibold text-sm transition-all duration-200 active:scale-[0.97]"
            style={{
              border: '2px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
          >
            Sign In
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
