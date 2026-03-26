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

const TILE_COLORS = ['#538d4e', '#b59f3b', '#3a3a3c'] as const;
const TITLE_CHARS = 'ELOQUENCE';

function randomizeTitleLetters() {
  return TITLE_CHARS.split('').map((char) => ({
    char,
    color: TILE_COLORS[Math.floor(Math.random() * TILE_COLORS.length)],
  }));
}

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

interface SingleTileProps {
  tile: { char: string; color: string };
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
  const signTowardHover =
    hoveredIndex !== null && index > hoveredIndex ? -1 : 1;

  type TileTarget = { y: number; scale: number; rotateZ: number; opacity: number; rotateX: number };
  let idleTarget: TileTarget = { y: 0, scale: 1, rotateZ: 0, opacity: 1, rotateX: 0 };
  if (isHovered) {
    idleTarget = { y: -12, scale: 1.15, rotateZ: 0, opacity: 1, rotateX: 0 };
  } else if (inRadius) {
    idleTarget = {
      y: neighbourY(dist),
      scale: neighbourScale(dist),
      rotateZ: neighbourRotateZ(dist, signTowardHover),
      opacity: 1,
      rotateX: 0,
    };
  }

  const idleShadow = `0 4px 16px ${tile.color}25`;
  const hoverShadow = `0 8px 40px ${tile.color}40, 0 0 0 1px ${tile.color}30`;

  return (
    <motion.span
      data-tile={index}
      initial={{ rotateX: 90, opacity: 0, scale: 0.85, y: 8 }}
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
        if (!bootDone) onBootComplete();
      }}
      whileHover={{
        y: -12,
        scale: 1.15,
        rotateZ: 0,
        transition: springs.snappy,
      }}
      onHoverStart={() => onHoverStart(index)}
      onHoverEnd={onHoverEnd}
      className="relative w-14 h-14 sm:w-[72px] sm:h-[72px] md:w-[84px] md:h-[84px] flex items-center justify-center rounded-lg text-white text-3xl sm:text-4xl md:text-5xl font-bold select-none cursor-default"
      style={{
        backgroundColor: tile.color,
        transformStyle: 'preserve-3d',
        boxShadow: isHovered ? hoverShadow : idleShadow,
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
  const [tiles] = useState(() => randomizeTitleLetters());
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
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
      className="relative flex gap-2 sm:gap-2.5"
      inherit={false}
      style={{ perspective: 900 }}
    >
      {tiles.map((tile, i) => (
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
      <div className="flex items-center justify-center min-h-dvh bg-[#111113]">
        <div className="w-6 h-6 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-dvh bg-[#111113] px-4">
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
          className="mt-8 text-xl sm:text-2xl font-semibold text-[#ededf0] tracking-tight"
        >
          Competitive Wordle
        </motion.p>

        {/* Sub-tagline */}
        <motion.p
          variants={{
            hidden: { opacity: 0, y: 10 },
            visible: { opacity: 1, y: 0, transition: springs.page },
          }}
          className="mt-2 text-base text-[#9898a0]"
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
            className="inline-flex items-center justify-center px-10 py-3.5 rounded-xl bg-[#538d4e] hover:bg-[#6aaa64] text-white font-semibold text-sm transition-all duration-200 hover:shadow-[0_0_24px_rgba(83,141,78,0.45)] active:scale-[0.97]"
          >
            Play
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-transparent border border-white/[0.09] hover:border-white/[0.15] text-[#9898a0] hover:text-[#ededf0] font-semibold text-sm transition-all duration-200 active:scale-[0.97]"
          >
            Sign In
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
