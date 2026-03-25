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

const TITLE_LETTERS = [
  { char: 'E', color: '#538d4e' },
  { char: 'L', color: '#b59f3b' },
  { char: 'O', color: '#538d4e' },
  { char: 'Q', color: '#3a3a3c' },
  { char: 'U', color: '#538d4e' },
  { char: 'E', color: '#b59f3b' },
  { char: 'N', color: '#538d4e' },
  { char: 'C', color: '#3a3a3c' },
  { char: 'E', color: '#538d4e' },
] as const;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAGNETIC_RADIUS = 2;


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function neighbourY(distance: number): number {
  if (distance === 1) return -5;
  if (distance === 2) return -2;
  return 0;
}

function neighbourRotateZ(distance: number, signTowardHover: number): number {
  // Tiles lean slightly toward the hovered tile
  if (distance === 1) return signTowardHover * 3;
  if (distance === 2) return signTowardHover * 1;
  return 0;
}

function neighbourScale(distance: number): number {
  if (distance === 1) return 1.04;
  if (distance === 2) return 1.015;
  return 1;
}

// ---------------------------------------------------------------------------
// SingleTile
// ---------------------------------------------------------------------------
// Encapsulates boot animation + hover state for one tile.
// Boot phase: driven by useAnimate so we get fine-grained sequencing.
// Idle / hover / neighbour phase: driven by the `animate` prop after boot.

interface SingleTileProps {
  tile: (typeof TITLE_LETTERS)[number];
  index: number;
  hoveredIndex: number | null;
  bootDone: boolean;
  onHoverStart: (i: number) => void;
  onHoverEnd: () => void;
  onBootComplete: () => void;
  key?: React.Key;
}

function SingleTile({
  tile,
  index,
  hoveredIndex,
  bootDone,
  onHoverStart,
  onHoverEnd,
  onBootComplete,
}: SingleTileProps) {
  const isHovered = hoveredIndex === index;
  const dist =
    hoveredIndex !== null ? Math.abs(index - hoveredIndex) : Infinity;
  const inRadius = dist <= MAGNETIC_RADIUS && !isHovered;
  // +1 if tile is to the RIGHT of hovered (should lean left), -1 if to the left
  const signTowardHover =
    hoveredIndex !== null && index > hoveredIndex ? -1 : 1;

  // Derive the animate target after boot
  type TileTarget = { y: number; scale: number; rotateZ: number; opacity: number; rotateX: number };
  let idleTarget: TileTarget = { y: 0, scale: 1, rotateZ: 0, opacity: 1, rotateX: 0 };
  if (isHovered) {
    idleTarget = { y: -11, scale: 1.15, rotateZ: 0, opacity: 1, rotateX: 0 };
  } else if (inRadius) {
    idleTarget = {
      y: neighbourY(dist),
      scale: neighbourScale(dist),
      rotateZ: neighbourRotateZ(dist, signTowardHover),
      opacity: 1,
      rotateX: 0,
    };
  }

  return (
    <motion.span
      data-tile={index}
      // ---- Boot: start fully hidden, flipped backward
      initial={{ rotateX: 90, opacity: 0, scale: 0.85, y: 8 }}
      // ---- Boot entry animation (runs once on mount)
      animate={
        bootDone
          ? idleTarget
          : {
              rotateX: 0,
              opacity: 1,
              scale: 1,
              y: 0,
            }
      }
      transition={
        bootDone
          ? { ...springs.snappy }
          : {
              ...springs.celebration,
              delay: 0.15 + index * 0.09,
            }
      }
      onAnimationComplete={() => {
        // Only fire the parent callback during the boot phase
        if (!bootDone) onBootComplete();
      }}
      whileHover={{
        y: -11,
        scale: 1.15,
        rotateZ: 0,
        transition: springs.snappy,
      }}
      onHoverStart={() => onHoverStart(index)}
      onHoverEnd={onHoverEnd}
      className="relative w-11 h-11 sm:w-[60px] sm:h-[60px] md:w-[72px] md:h-[72px] flex items-center justify-center rounded-lg text-white text-2xl sm:text-4xl md:text-5xl font-bold select-none cursor-default"
      style={{
        backgroundColor: tile.color,
        transformStyle: 'preserve-3d',
        boxShadow: isHovered
          ? `0 10px 36px ${tile.color}99, 0 0 0 2px ${tile.color}55`
          : `0 4px 20px ${tile.color}33`,
        transition: 'box-shadow 0.15s ease',
        zIndex: isHovered ? 10 : 'auto',
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  // Track how many tiles have completed their boot flip
  const landedCount = useRef(0);
  const [bootDone, setBootDone] = useState(false);

  const [rowScope, animateRow] = useAnimate();

  const handleBootComplete = () => {
    landedCount.current += 1;
    if (landedCount.current === TITLE_LETTERS.length) {
      setBootDone(true);
    }
  };

  // Once all tiles have landed, run the collective post-land sequence
  useEffect(() => {
    if (!bootDone) return;

    const runPostLand = async () => {
      // Small settle pause
      await new Promise<void>((r) => setTimeout(r, 60));

      // Collective scale pop staggered across tiles
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
      {TITLE_LETTERS.map((tile, i) => (
        <SingleTile
          key={i}
          tile={tile}
          index={i}
          hoveredIndex={hoveredIndex}
          bootDone={bootDone}
          onHoverStart={setHoveredIndex}
          onHoverEnd={() => setHoveredIndex(null)}
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
      <div className="flex items-center justify-center min-h-[80dvh]">
        <div className="w-6 h-6 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[calc(100dvh-56px)] px-4 overflow-hidden">
      {/* Background grid */}
      <div className="pointer-events-none absolute inset-0 home-bg-grid" />

      {/* Radial glow behind title */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full home-radial-glow" />

      {/* Hero */}
      <motion.div
        className="relative z-10 flex flex-col items-center text-center gap-8 max-w-2xl"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: stagger.slow },
        }}
      >
        {/* Animated title row */}
        <TitleRow />

        <motion.p
          variants={{
            hidden: { opacity: 0, y: 16 },
            visible: { opacity: 1, y: 0, transition: springs.page },
          }}
          className="text-lg sm:text-xl text-text-secondary max-w-md leading-relaxed"
        >
          Competitive Wordle.
          <br className="hidden sm:block" />
          Compete, analyze, improve.
        </motion.p>

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0, transition: springs.page },
          }}
          className="flex flex-col sm:flex-row gap-3 mt-2"
        >
          <Link
            href="/play"
            className="group relative w-36 py-3.5 rounded-xl bg-[#538d4e] hover:bg-[#6aaa64] text-white font-semibold text-sm text-center transition-all duration-200 shadow-lg shadow-[#538d4e]/25 hover:shadow-[#538d4e]/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            Play
          </Link>
          <Link
            href="/login"
            className="w-36 py-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-text-primary font-semibold text-sm text-center transition-all duration-200 border border-white/[0.1] hover:border-white/[0.2] hover:scale-[1.02] active:scale-[0.98]"
          >
            Sign In
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
