'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/hooks/useAuth';
import { springs, stagger } from '@/lib/animations';

const FEATURE_ITEMS = [
  {
    icon: '♟',
    title: 'ELO Rating System',
    desc: 'Earn and lose rating based on game performance and word difficulty.',
  },
  {
    icon: '🔬',
    title: 'Information Theory Analysis',
    desc: 'Every guess graded with entropy, efficiency ratio, and optimal alternatives.',
  },
  {
    icon: '★',
    title: 'Move Classification',
    desc: 'Brilliant, Best, Good, Inaccuracy, Mistake, Blunder — just like chess.',
  },
];

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
    <div className="flex flex-col items-center min-h-[calc(100dvh-56px)] px-4">
      {/* Hero */}
      <motion.div
        className="flex flex-col items-center text-center mt-20 mb-16 gap-6 max-w-2xl"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: stagger.slow },
        }}
      >
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: springs.page },
          }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#538d4e]/10 border border-[#538d4e]/20 text-[#6aaa64] text-xs font-medium"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#6aaa64] animate-pulse" />
          Now with information-theory analysis
        </motion.div>

        <motion.h1
          variants={{
            hidden: { opacity: 0, y: 24 },
            visible: { opacity: 1, y: 0, transition: springs.page },
          }}
          className="text-5xl sm:text-7xl font-bold tracking-tight"
        >
          ELO<span className="text-[#6aaa64]">quence</span>
        </motion.h1>

        <motion.p
          variants={{
            hidden: { opacity: 0, y: 16 },
            visible: { opacity: 1, y: 0, transition: springs.page },
          }}
          className="text-lg sm:text-xl text-text-secondary max-w-lg"
        >
          The chess.com of Wordle. Compete, analyze, improve.
        </motion.p>

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0, transition: springs.page },
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <Link
            href="/register"
            className="px-8 py-3 rounded-xl bg-[#538d4e] hover:bg-[#6aaa64] text-white font-semibold text-sm transition-colors shadow-lg shadow-[#538d4e]/20"
          >
            Get Started Free
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 rounded-xl bg-bg-secondary hover:bg-bg-tertiary text-text-primary font-semibold text-sm transition-colors border border-white/[0.1]"
          >
            Sign In
          </Link>
        </motion.div>
      </motion.div>

      {/* Demo tile row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.page, delay: 0.5 }}
        className="flex gap-2 mb-16"
      >
        {[
          { l: 'C', c: '#538d4e' },
          { l: 'R', c: '#b59f3b' },
          { l: 'A', c: '#538d4e' },
          { l: 'N', c: '#3a3a3c' },
          { l: 'E', c: '#538d4e' },
        ].map((tile, i) => (
          <motion.div
            key={i}
            initial={{ rotateX: -90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            transition={{ delay: 0.6 + i * 0.12, ...springs.bouncy }}
            className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded text-white text-2xl font-bold"
            style={{ backgroundColor: tile.c }}
          >
            {tile.l}
          </motion.div>
        ))}
      </motion.div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.page, delay: 0.8 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full mb-20"
      >
        {FEATURE_ITEMS.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.slide, delay: 0.9 + i * 0.1 }}
            className="flex flex-col gap-2 p-5 rounded-xl bg-bg-secondary border border-white/[0.08] hover:border-white/[0.14] transition-all duration-150"
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-sm font-semibold text-text-primary">{item.title}</span>
            <span className="text-xs text-text-secondary leading-relaxed">{item.desc}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* Bottom CTA */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="text-xs text-text-ghost mb-10"
      >
        Free to play. No ads. No nonsense.
      </motion.p>
    </div>
  );
}
