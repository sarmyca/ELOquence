'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Swords,
  Trophy,
  Share2,
  Check,
  Crown,
  ExternalLink,
  Users,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { challengesApi } from '@/lib/api';
import { springs, stagger } from '@/lib/animations';
import clsx from 'clsx';

interface ChallengeInfo {
  code: string;
  creator_id: string;
  word_difficulty: number | null;
  already_played: boolean;
  game_id: string | null;
}

interface ChallengeResult {
  rank: number | null;
  username: string;
  status: string;
  num_guesses: number;
  accuracy_score: number | null;
  time_seconds: number | null;
  is_creator: boolean;
  completed_at: string | null;
}

/* ------------------------------------------------------------------ */
/*  Atoms — guess dots, accuracy bar / pill                            */
/* ------------------------------------------------------------------ */

// 6-dot row encoding both count and quality. The colour gradient runs
// from brilliant (single bright green) to risky (red on 6/6), mirroring
// the in-app Wordle tile vocabulary.
function GuessDots({
  num,
  status,
  size = 'sm',
}: {
  num: number;
  status: string;
  size?: 'sm' | 'md';
}) {
  const lost = status === 'lost';
  const dim = size === 'md' ? 7 : 5;
  const gap = size === 'md' ? 2 : 1;

  // Color for filled dots based on num_guesses — fewer = better.
  const fillColor = (() => {
    if (lost) return 'var(--tile-absent)';
    if (num <= 2) return 'var(--tile-correct)';
    if (num === 3) return 'color-mix(in srgb, var(--tile-correct) 75%, var(--tile-present))';
    if (num === 4) return 'var(--tile-present)';
    if (num === 5) return 'var(--cls-orange)';
    return 'color-mix(in srgb, var(--red) 80%, transparent)';
  })();

  // Lost games render all 6 dots in --tile-absent (the in-app "absent"
  // gray, more saturated than --border-default) at full opacity so they
  // read clearly against any card background.
  return (
    <div
      className="flex items-center"
      style={{ gap: `${gap}px` }}
      role="img"
      aria-label={lost ? 'Did not solve in 6 guesses' : `Solved in ${num} of 6 guesses`}
    >
      {Array.from({ length: 6 }).map((_, i) => {
        const filled = !lost && i < num;
        return (
          <span
            key={i}
            className="rounded-full"
            style={{
              width: dim,
              height: dim,
              backgroundColor: lost
                ? 'var(--tile-absent)'
                : filled
                ? fillColor
                : 'var(--border-default)',
            }}
          />
        );
      })}
    </div>
  );
}

function accuracyFill(pct: number): string {
  if (pct >= 75) return 'var(--tile-correct)';
  if (pct >= 40) return 'var(--tile-present)';
  return 'var(--tile-absent)';
}

function AccuracyBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[10px] text-text-tertiary font-mono">—</span>;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="rounded-full overflow-hidden shrink-0"
        style={{
          width: 64,
          height: 6,
          backgroundColor: 'var(--border-subtle)',
        }}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${clamped}%`,
            backgroundColor: accuracyFill(clamped),
          }}
        />
      </div>
      <span
        className="text-[10px] font-mono tabular-nums text-right shrink-0"
        style={{ color: 'var(--text-secondary)', width: 28 }}
      >
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

function AccuracyPill({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const clamped = Math.max(0, Math.min(100, pct));
  const c = accuracyFill(clamped);
  return (
    <span
      className="px-1.5 py-0.5 text-[10px] rounded-pill font-mono tabular-nums border"
      style={{
        color: c,
        backgroundColor: `color-mix(in srgb, ${c} 12%, transparent)`,
        borderColor: `color-mix(in srgb, ${c} 30%, transparent)`,
      }}
    >
      {Math.round(clamped)}%
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Podium                                                              */
/* ------------------------------------------------------------------ */

// Podium colors follow the Wordle tile palette (correct / present / absent)
// rather than gold/silver/bronze medals — keeps the page visually anchored
// in the same vocabulary as the rest of the app.
const PODIUM_META: Record<
  1 | 2 | 3,
  { color: string; height: number; rankIcon: 'trophy' | 'numeral' }
> = {
  1: { color: 'var(--tile-correct)', height: 176, rankIcon: 'trophy' },
  2: { color: 'var(--tile-present)', height: 144, rankIcon: 'numeral' },
  3: { color: 'var(--tile-absent)', height: 112, rankIcon: 'numeral' },
};

function PodiumCell({
  entry,
  place,
  isMe,
}: {
  entry: ChallengeResult;
  place: 1 | 2 | 3;
  isMe: boolean;
}) {
  const meta = PODIUM_META[place];
  const lost = entry.status === 'lost';
  const accentColor = isMe ? 'var(--tile-correct)' : meta.color;

  return (
    <motion.div
      initial={{ opacity: 0, y: place === 1 ? -8 : place === 2 ? 0 : 0, x: place === 2 ? -8 : place === 3 ? 8 : 0 }}
      animate={{ opacity: lost ? 0.72 : 1, x: 0, y: 0 }}
      transition={{ delay: place === 2 ? 0.08 : place === 3 ? 0.16 : 0.24, ...springs.celebration }}
      className="relative rounded-card overflow-hidden flex flex-col justify-end p-3"
      style={{
        height: meta.height,
        backgroundColor: 'var(--bg-base)',
        border: '2px solid',
        borderColor: lost ? 'var(--border-default)' : accentColor,
        borderLeftWidth: 4,
      }}
    >
      {/* radial glow only for 1st */}
      {place === 1 && !lost && (
        <div
          className="absolute inset-x-0 top-0 pointer-events-none"
          style={{
            height: '60%',
            background: `radial-gradient(ellipse at 50% 0%, color-mix(in srgb, ${accentColor} 16%, transparent), transparent 70%)`,
          }}
          aria-hidden="true"
        />
      )}

      {/* rank ornament (top-center) */}
      <div className="absolute left-0 right-0 flex justify-center" style={{ top: place === 1 ? 10 : 8 }}>
        {meta.rankIcon === 'trophy' ? (
          <Trophy size={16} style={{ color: lost ? 'var(--text-tertiary)' : accentColor }} />
        ) : (
          <span
            className={clsx(
              'font-display font-black',
              place === 2 ? 'text-lg' : 'text-base',
            )}
            style={{ color: lost ? 'var(--text-tertiary)' : accentColor, lineHeight: 1 }}
          >
            {place}
          </span>
        )}
      </div>

      {/* Content (bottom-anchored) */}
      <div className="relative z-10 flex flex-col gap-1.5">
        <div className="flex items-center gap-1 min-w-0">
          {entry.is_creator && (
            <Crown
              size={10}
              role="img"
              aria-label="Challenge creator"
              style={{ color: 'var(--gold)', flexShrink: 0 }}
            />
          )}
          <span
            className={clsx(
              'font-display font-bold truncate',
              place === 1 ? 'text-xs' : 'text-[11px]',
            )}
            style={{
              color: lost ? 'var(--text-secondary)' : 'var(--text-primary)',
            }}
          >
            {entry.username}
          </span>
          {isMe && (
            <span className="text-[9px] font-sans" style={{ color: 'var(--text-tertiary)' }}>
              (you)
            </span>
          )}
        </div>

        <GuessDots num={entry.num_guesses} status={entry.status} size={place === 1 ? 'md' : 'sm'} />

        {entry.accuracy_score !== null && <AccuracyPill pct={entry.accuracy_score} />}
      </div>
    </motion.div>
  );
}

function Podium({
  entries,
  myUsername,
}: {
  entries: ChallengeResult[];
  myUsername: string | null;
}) {
  const top3 = entries.slice(0, 3);
  if (top3.length === 0) return null;

  // Build a fixed 3-column layout: [2nd-slot, 1st-slot, 3rd-slot]. The
  // 1st-place card always lives in the middle column, even when there
  // are only 1 or 2 entries — empty side columns just hold a sized
  // placeholder so the centre tile stays centred.
  const layout: ({ entry: ChallengeResult; place: 1 | 2 | 3 } | null)[] = [
    top3[1] ? { entry: top3[1], place: 2 } : null,
    top3[0] ? { entry: top3[0], place: 1 } : null,
    top3[2] ? { entry: top3[2], place: 3 } : null,
  ];

  return (
    <div
      className="rounded-card-lg p-3"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="grid grid-cols-3 gap-2 items-end">
        {layout.map((cell, idx) => {
          if (!cell) {
            // Placeholder height matches the slot's intrinsic height
            // (left=144 for 2nd, center=176 for 1st, right=112 for 3rd)
            // so the alignment of any filled cells stays correct.
            const phHeight = idx === 0 ? 144 : idx === 1 ? 176 : 112;
            return <div key={`ph-${idx}`} style={{ height: phHeight }} aria-hidden="true" />;
          }
          return (
            <PodiumCell
              key={`${cell.entry.username}-${cell.entry.rank}`}
              entry={cell.entry}
              place={cell.place}
              isMe={cell.entry.username === myUsername}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rows 4+                                                            */
/* ------------------------------------------------------------------ */

function LeaderboardRow({
  entry,
  isMe,
  index,
}: {
  entry: ChallengeResult;
  isMe: boolean;
  index: number;
}) {
  const lost = entry.status === 'lost';
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: lost ? 0.85 : 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.05, ...springs.snappy }}
      className="flex items-center gap-3 px-4 py-2.5"
      style={{
        backgroundColor: isMe
          ? 'color-mix(in srgb, var(--tile-correct) 6%, transparent)'
          : 'transparent',
        borderLeft: isMe ? '2px solid var(--tile-correct)' : '2px solid transparent',
      }}
      aria-label={lost ? `${entry.username} did not solve the puzzle` : undefined}
    >
      <span
        className="font-mono font-bold text-xs w-5 text-right shrink-0 tabular-nums"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {entry.rank ?? '—'}
      </span>

      <div className="flex items-center gap-1 min-w-0 flex-1">
        {entry.is_creator && (
          <Crown
            size={10}
            style={{ color: 'var(--gold)', flexShrink: 0 }}
            aria-label="Challenge creator"
          />
        )}
        <span
          className="text-sm truncate"
          style={{
            color: lost ? 'var(--text-secondary)' : 'var(--text-primary)',
            fontWeight: isMe ? 600 : 500,
          }}
        >
          {entry.username}
        </span>
        {isMe && (
          <span className="text-[10px] font-sans shrink-0" style={{ color: 'var(--text-tertiary)' }}>
            (you)
          </span>
        )}
      </div>

      <div className="shrink-0">
        <GuessDots num={entry.num_guesses} status={entry.status} size="sm" />
      </div>

      <div className="shrink-0">
        <AccuracyBar pct={entry.accuracy_score} />
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading / error                                                    */
/* ------------------------------------------------------------------ */

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin border-tile-correct" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ChallengePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [challenge, setChallenge] = useState<ChallengeInfo | null>(null);
  const [results, setResults] = useState<ChallengeResult[]>([]);
  const [challengeWord, setChallengeWord] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // Initialise the share URL on the client only, to avoid a hydration flash
  // where the input renders empty during SSR / first paint.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShareUrl(`${window.location.origin}/challenge/${code}`);
    }
  }, [code]);

  useEffect(() => {
    if (!code || authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    // Both fetches are committed together so the page never shows results
    // while `challenge` is still null (avoids a late layout shift).
    Promise.all([
      challengesApi.get(code),
      challengesApi.results(code).catch(() => ({
        data: { results: [], word: null } as { results: ChallengeResult[]; word: string | null },
      })),
    ])
      .then(([infoRes, resultsRes]) => {
        setChallenge(infoRes.data);
        setResults(resultsRes.data.results || []);
        setChallengeWord(resultsRes.data.word ?? null);
      })
      .catch(() => setError('Challenge not found'))
      .finally(() => setLoading(false));
  }, [code, user, authLoading, router]);

  const handlePlay = async () => {
    if (!code || starting) return;
    setStarting(true);
    setError('');
    try {
      const res = await challengesApi.play(code);
      router.push(`/game/${res.data.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Could not start challenge';
      setError(msg);
      setStarting(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/challenge/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: do nothing
    }
  };

  if (authLoading || loading) return <LoadingSpinner />;

  if (error && !challenge) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-56px)] px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.slide}
          className="text-center"
        >
          <div className="w-16 h-16 rounded-card-lg bg-bg-elevated border border-border-subtle flex items-center justify-center mx-auto mb-5">
            <Swords size={28} className="text-text-secondary" />
          </div>
          <h1 className="font-display font-bold text-xl text-text-primary mb-2">
            Challenge not found
          </h1>
          <p className="font-sans text-text-secondary text-sm mb-6">{error}</p>
          <button
            onClick={() => router.push('/play')}
            className="px-5 py-2.5 rounded-card bg-tile-correct text-white font-bold uppercase tracking-wider text-sm hover:brightness-110 transition-[filter,transform] active:scale-[0.98]"
          >
            Play a Game
          </button>
        </motion.div>
      </div>
    );
  }

  const finishedResults = results.filter((r) => r.status !== 'in_progress');
  const inProgressResults = results.filter((r) => r.status === 'in_progress');
  const hasResults = finishedResults.length > 0;
  const showLeaderboard = hasResults && challenge?.already_played;
  const remainingRows = finishedResults.slice(3);
  const myUsername = user?.username ?? null;

  return (
    <div className="flex flex-col items-center min-h-[calc(100dvh-56px)] px-4 py-8">
      <motion.div
        className="w-full max-w-md flex flex-col gap-4"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: stagger.medium },
        }}
      >
        {/* ── Hero — slim header card ─────────────────────────────────── */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0, transition: springs.slide },
          }}
          className="rounded-card-lg overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-base)',
            border: '1px solid var(--border-default)',
            borderLeft: '3px solid var(--tile-correct)',
          }}
        >
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className="font-sans text-[10px] uppercase tracking-[0.1em]"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Challenge · {code}
                </p>
                <h1
                  className="font-display font-black tracking-tight mt-0.5"
                  style={{
                    fontSize: '1.5rem',
                    color: 'var(--text-primary)',
                    lineHeight: 1.1,
                  }}
                >
                  {challenge?.already_played ? 'Results' : "You've been challenged"}
                </h1>
              </div>
              {challengeWord && challenge?.already_played && (
                <span
                  className="text-[11px] px-2.5 py-1 rounded-pill font-mono uppercase tracking-widest border shrink-0"
                  style={{
                    color: 'var(--tile-correct)',
                    backgroundColor: 'color-mix(in srgb, var(--tile-correct) 12%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--tile-correct) 30%, transparent)',
                  }}
                >
                  {challengeWord}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {challenge?.word_difficulty != null && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-pill border font-mono tabular-nums"
                  style={{
                    color: 'var(--cls-blue)',
                    backgroundColor: 'color-mix(in srgb, var(--cls-blue) 12%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--cls-blue) 30%, transparent)',
                  }}
                >
                  Word ELO {Math.round(challenge.word_difficulty)}
                </span>
              )}
              {/* Player count is hidden until the user has played, so the
                  hero card doesn't pre-leak engagement metadata to a fresh
                  visitor — mirrors the spoiler-protection on the leaderboard. */}
              {results.length > 0 && challenge?.already_played && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-pill border flex items-center gap-1"
                  style={{
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <Users size={9} />
                  {results.length} {results.length === 1 ? 'player' : 'players'}
                </span>
              )}
              {inProgressResults.length > 0 && challenge?.already_played && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-pill border"
                  style={{
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  {inProgressResults.length} still playing
                </span>
              )}
            </div>

            {!challenge?.already_played ? (
              <motion.button
                whileHover={{ scale: starting ? 1 : 1.02 }}
                whileTap={{ scale: starting ? 1 : 0.98 }}
                onClick={handlePlay}
                disabled={starting}
                className="w-full py-3 rounded-card disabled:opacity-60 text-white font-bold text-sm tracking-wide hover:brightness-110 transition-[filter,transform] flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--tile-correct)' }}
              >
                {starting ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <>
                    <Swords size={16} />
                    Accept challenge
                    <ChevronRight size={16} className="ml-auto opacity-60" />
                  </>
                )}
              </motion.button>
            ) : (
              challenge.game_id && (
                <button
                  onClick={() => router.push(`/review/${challenge.game_id}`)}
                  className="w-full py-2.5 rounded-card text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <ExternalLink size={14} />
                  Review your game
                </button>
              )
            )}
          </div>
        </motion.div>

        <AnimatePresence>
          {error && challenge && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-sm rounded-card px-4 py-2 text-center"
              style={{
                color: 'var(--red)',
                backgroundColor: 'rgba(231,76,60,0.08)',
                border: '1px solid rgba(231,76,60,0.18)',
              }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* ── Podium + rest of leaderboard ──────────────────────────── */}
        {showLeaderboard && (
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 12 },
              visible: { opacity: 1, y: 0, transition: springs.slide },
            }}
            className="flex flex-col gap-2"
          >
            <Podium entries={finishedResults} myUsername={myUsername} />

            {remainingRows.length > 0 && (
              <div
                className="rounded-card-lg overflow-hidden"
                style={{
                  backgroundColor: 'var(--bg-base)',
                  border: '1px solid var(--border-default)',
                }}
              >
                <div
                  className="flex items-center gap-2 px-4 pt-3 pb-2"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <Trophy size={11} style={{ color: 'var(--gold)' }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider font-display"
                        style={{ color: 'var(--text-secondary)' }}>
                    Standings
                  </span>
                  <span className="ml-auto text-[10px] tabular-nums"
                        style={{ color: 'var(--text-tertiary)' }}>
                    {remainingRows.length} more
                  </span>
                </div>
                <div className="flex flex-col">
                  {remainingRows.map((entry, idx) => (
                    <div
                      key={`${entry.username}-${entry.rank}`}
                      style={
                        idx > 0
                          ? { borderTop: '1px solid var(--border-subtle)' }
                          : undefined
                      }
                    >
                      <LeaderboardRow
                        entry={entry}
                        isMe={entry.username === myUsername}
                        index={idx}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Share ────────────────────────────────────────────────── */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0, transition: springs.slide },
          }}
          className="rounded-card-lg p-3.5"
          style={{
            backgroundColor: 'var(--bg-base)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <Share2 size={12} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-[10px] font-bold uppercase tracking-wider font-display"
                  style={{ color: 'var(--text-secondary)' }}>
              Share Challenge
            </span>
          </div>

          <div className="flex gap-2">
            <div
              className="flex-1 min-w-0 py-2 px-3 rounded-md text-xs font-mono truncate"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              {shareUrl}
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleCopyLink}
              className="shrink-0 px-3 py-2 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
              }}
            >
              {copied ? (
                <>
                  <Check size={13} style={{ color: 'var(--tile-correct)' }} />
                  Copied!
                </>
              ) : (
                <>
                  <Share2 size={13} />
                  Copy
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
