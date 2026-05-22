'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { Game, Move, patternToTiles, CLASSIFICATION_CONFIG, Classification } from '@/lib/types';
import AdminNav from '@/components/admin/AdminNav';

interface AdminGameDetail extends Game {
  username: string | null;
}

function TileMini({ state, letter }: { state: 'correct' | 'present' | 'absent'; letter: string }) {
  const colors = {
    correct: 'var(--tile-correct)',
    present: 'var(--tile-present)',
    absent: 'var(--tile-absent)',
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: 3,
        backgroundColor: colors[state],
        color: '#fff',
        fontSize: 11,
        fontWeight: 700,
        fontFamily: 'var(--font-mono, monospace)',
        textTransform: 'uppercase',
        flexShrink: 0,
      }}
    >
      {letter}
    </span>
  );
}

function GuessRow({ move }: { move: Move }) {
  const tiles = patternToTiles(move.pattern);
  const letters = move.guess_word.split('');

  const classConf = move.classification
    ? CLASSIFICATION_CONFIG[move.classification as Classification]
    : null;

  return (
    <div
      className="flex items-center gap-3 py-2.5 border-b border-border-subtle last:border-0"
    >
      {/* Move number */}
      <span
        className="font-mono text-text-tertiary tabular-nums flex-shrink-0"
        style={{ fontSize: 11, width: 14, textAlign: 'right' }}
      >
        {move.move_number}
      </span>

      {/* Tiles */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {letters.map((ch, i) => (
          <TileMini
            key={i}
            letter={ch}
            state={tiles[i] === 'empty' || tiles[i] === 'tbd' ? 'absent' : (tiles[i] as 'correct' | 'present' | 'absent')}
          />
        ))}
      </div>

      {/* Classification badge */}
      {classConf && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-sans font-semibold flex-shrink-0"
          style={{
            fontSize: 9,
            color: classConf.color,
            backgroundColor: `color-mix(in srgb, ${classConf.color} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${classConf.color} 25%, transparent)`,
          }}
        >
          {classConf.label}
        </span>
      )}

      {/* Metrics */}
      <div className="flex items-center gap-3 ml-auto text-right flex-wrap justify-end">
        {move.optimal_word && move.optimal_word !== move.guess_word && (
          <span className="font-sans text-text-tertiary" style={{ fontSize: 10 }}>
            opt: <span className="font-mono text-text-secondary uppercase">{move.optimal_word}</span>
          </span>
        )}
        {move.info_gained !== null && (
          <span className="font-mono tabular-nums text-text-secondary" style={{ fontSize: 10 }}>
            {move.info_gained.toFixed(2)} bits
          </span>
        )}
        {move.bits_lost !== null && move.bits_lost > 0 && (
          <span className="font-mono tabular-nums" style={{ fontSize: 10, color: 'var(--red)' }}>
            -{move.bits_lost.toFixed(2)} lost
          </span>
        )}
        {move.remaining_words !== null && (
          <span className="font-mono tabular-nums text-text-tertiary" style={{ fontSize: 10 }}>
            {move.remaining_words} left
          </span>
        )}
      </div>
    </div>
  );
}

function InfoGrid({ items }: { items: Array<{ label: string; value: string | number | null | undefined }> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
      {items.map(({ label, value }) => (
        <div key={label}>
          <span className="block text-xs uppercase tracking-wider text-text-tertiary font-semibold font-sans mb-0.5">{label}</span>
          <span className="font-mono text-text-primary text-sm">{value ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  let bg = 'var(--bg-elevated)';
  let color = 'var(--text-secondary)';
  if (status === 'won') { bg = 'rgba(106,170,100,0.12)'; color = 'var(--tile-correct)'; }
  else if (status === 'lost') { bg = 'rgba(231,76,60,0.10)'; color = 'var(--red)'; }
  else if (status === 'abandoned') { bg = 'rgba(150,150,150,0.10)'; color = 'var(--text-tertiary)'; }
  else if (status === 'in_progress') { bg = 'rgba(201,162,39,0.10)'; color = 'var(--gold)'; }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded font-sans text-xs font-semibold capitalize" style={{ backgroundColor: bg, color }}>
      {status.replace('_', ' ')}
    </span>
  );
}

export default function AdminGameDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const gameId = params.id;

  const [game, setGame] = useState<AdminGameDetail | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      router.replace('/play');
      return;
    }
    adminApi.game(gameId)
      .then((res) => setGame(res.data))
      .catch(() => setError('Failed to load game.'))
      .finally(() => setFetching(false));
  }, [user, loading, router, gameId]);

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user?.is_admin) return null;

  if (error || !game) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="px-4 py-3 rounded-card border text-sm" style={{ background: 'rgba(231,76,60,0.08)', borderColor: 'rgba(231,76,60,0.25)', color: 'var(--red)' }}>
          {error || 'Game not found.'}
        </div>
      </div>
    );
  }

  const sortedMoves = [...(game.moves ?? [])].sort((a, b) => a.move_number - b.move_number);

  const duration =
    game.created_at && game.completed_at
      ? Math.round(
          (new Date(game.completed_at).getTime() - new Date(game.created_at).getTime()) / 1000
        )
      : null;
  const durationStr = duration !== null
    ? duration < 60
      ? `${duration}s`
      : `${Math.floor(duration / 60)}m ${duration % 60}s`
    : null;

  const eloDeltaStr = game.elo_delta !== null
    ? `${game.elo_delta > 0 ? '+' : ''}${game.elo_delta}`
    : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/admin" className="font-sans text-text-secondary hover:text-text-primary text-sm transition-colors">Admin</Link>
          <span className="text-text-tertiary text-sm">/</span>
          <Link href="/admin/games" className="font-sans text-text-secondary hover:text-text-primary text-sm transition-colors">Games</Link>
          <span className="text-text-tertiary text-sm">/</span>
          <span className="font-sans text-sm text-text-primary font-mono uppercase">{game.target_word ?? gameId.slice(0, 8)}</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {game.username && game.user_id ? (
            <Link href={`/admin/users/${game.user_id}`} className="font-display font-black text-3xl text-text-primary hover:underline">
              {game.username}
            </Link>
          ) : (
            <h1 className="font-display font-black text-3xl text-text-primary">Guest</h1>
          )}
          <span className="font-mono text-text-secondary text-lg font-bold uppercase">{game.target_word ?? '—'}</span>
          <StatusBadge status={game.status} />
          <span className="inline-flex items-center px-2 py-0.5 rounded font-sans text-xs font-semibold capitalize" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            {game.mode}
          </span>
        </div>
      </motion.div>

      <AdminNav />

      {/* Game info panel */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }} className="bg-bg-base border border-border-default rounded-card-lg p-5 mb-6">
        <h2 className="font-display font-bold text-text-primary mb-4">Game Info</h2>
        <InfoGrid items={[
          { label: 'Target Word', value: game.target_word?.toUpperCase() },
          { label: 'Mode', value: game.mode },
          { label: 'Status', value: game.status.replace('_', ' ') },
          { label: 'Difficulty', value: game.word_difficulty },
          { label: 'Hard Mode', value: game.hard_mode ? 'Yes' : 'No' },
          { label: 'Rated', value: game.rated ? 'Yes' : 'No' },
          { label: 'Placement', value: game.is_placement ? 'Yes' : 'No' },
          { label: 'Guesses', value: game.num_guesses > 0 ? game.num_guesses : '—' },
          { label: 'Created', value: new Date(game.created_at).toLocaleString() },
          { label: 'Completed', value: game.completed_at ? new Date(game.completed_at).toLocaleString() : '—' },
          { label: 'Duration', value: durationStr },
          { label: 'ELO Before', value: game.elo_before },
          { label: 'ELO After', value: game.elo_after },
          { label: 'ELO Delta', value: eloDeltaStr },
          { label: 'Accuracy', value: game.accuracy_score !== null ? `${game.accuracy_score.toFixed(1)}%` : null },
          { label: 'Luck Factor', value: game.luck_factor !== null ? game.luck_factor?.toFixed(2) : null },
        ]} />
      </motion.div>

      {/* Moves timeline */}
      {sortedMoves.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3 }} className="bg-bg-base border border-border-default rounded-card-lg p-5">
          <h2 className="font-display font-bold text-text-primary mb-4">Moves</h2>
          <div className="font-sans">
            {sortedMoves.map((move) => (
              <GuessRow key={move.id} move={move} />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
