'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dailyApi } from '@/lib/api';
import { useAuth } from '@/lib/hooks/useAuth';
import clsx from 'clsx';

interface ArchiveEntry {
  date: string;
  puzzle_number: number | null;
  played: boolean;
  status: 'won' | 'lost' | 'in_progress' | null;
  guesses: number | null;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function isFutureDate(dateStr: string): boolean {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return dateStr > todayStr;
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Inline style for a cell based on its status. Uses only CSS variables. */
function getCellStyle(entry: ArchiveEntry | undefined, future: boolean): React.CSSProperties {
  if (!entry || future) {
    return {
      backgroundColor: 'var(--tile-empty-bg)',
      border: '2px solid var(--tile-empty-border)',
      opacity: future ? 0.35 : 1,
    };
  }
  if (!entry.played) {
    return {
      backgroundColor: 'var(--tile-empty-bg)',
      border: '2px solid var(--tile-empty-border)',
    };
  }
  if (entry.status === 'won') {
    return {
      backgroundColor: 'var(--tile-correct)',
      border: '2px solid var(--tile-correct)',
    };
  }
  if (entry.status === 'lost') {
    return {
      backgroundColor: 'var(--tile-absent)',
      border: '2px solid var(--tile-absent)',
    };
  }
  // in_progress
  return {
    backgroundColor: 'var(--tile-present)',
    border: '2px solid var(--tile-present)',
  };
}

function getCellTextColor(entry: ArchiveEntry | undefined, future: boolean): string {
  if (!entry || future || !entry.played) return 'var(--text-primary)';
  return '#ffffff';
}

interface CalendarCellProps {
  day: number;
  entry: ArchiveEntry | undefined;
  future: boolean;
  loading: boolean;
  onClick: () => void;
}

function CalendarCell({ day, entry, future, loading, onClick }: CalendarCellProps) {
  const isPlayable = !future && !!entry && !loading;
  const isRevealed = entry?.played && !future;

  return (
    <button
      disabled={!isPlayable}
      onClick={isPlayable ? onClick : undefined}
      aria-label={
        entry
          ? `${entry.date}${entry.played ? `, ${entry.status === 'won' ? 'won' : entry.status === 'lost' ? 'lost' : 'in progress'} in ${entry.guesses} guess${entry.guesses !== 1 ? 'es' : ''}` : ', not played'}`
          : `Day ${day}`
      }
      className={clsx(
        'relative flex flex-col items-center justify-center rounded-tile select-none',
        'transition-all duration-150',
        isPlayable && !isRevealed && 'hover:brightness-[0.92] cursor-pointer',
        isPlayable && isRevealed && 'hover:brightness-110 cursor-pointer',
        !isPlayable && 'cursor-default',
      )}
      style={{
        ...getCellStyle(entry, future),
        aspectRatio: '1 / 1',
        minWidth: 0,
      }}
    >
      <span
        className="text-xs font-bold leading-none"
        style={{ color: getCellTextColor(entry, future) }}
      >
        {day}
      </span>
      {isRevealed && entry?.guesses != null && (
        <span
          className="text-[9px] leading-none mt-0.5 font-sans tabular-nums"
          style={{ color: getCellTextColor(entry, future), opacity: 0.85 }}
        >
          {entry.status === 'lost' ? 'X' : entry.guesses}/6
        </span>
      )}
    </button>
  );
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function Archive() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed

  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [replayingDate, setReplayingDate] = useState<string | null>(null);

  const fetchMonth = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    setError('');
    try {
      const res = await dailyApi.archive(year, month);
      setEntries(res.data as ArchiveEntry[]);
    } catch {
      setError('Could not load archive. Please try again.');
    } finally {
      setFetching(false);
    }
  }, [user, year, month]);

  useEffect(() => {
    fetchMonth();
  }, [fetchMonth]);

  const handlePrev = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNext = () => {
    const ny = now.getFullYear();
    const nm = now.getMonth() + 1;
    if (year > ny || (year === ny && month >= nm)) return; // can't go past current month
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const isNextDisabled = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);

  const handleCellClick = async (entry: ArchiveEntry) => {
    if (replayingDate) return;
    setReplayingDate(entry.date);
    try {
      const res = await dailyApi.replay(entry.date);
      const gameId: string = res.data.id;
      router.push(`/game/${gameId}`);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || 'Could not start game. Please try again.');
      setReplayingDate(null);
    }
  };

  // Build grid
  const firstDow = getFirstDayOfWeek(year, month);
  const daysInMonth = getDaysInMonth(year, month);
  const entryMap = Object.fromEntries(entries.map((e) => [e.date, e]));

  // Total cells: leading blanks + days
  const totalCells = firstDow + daysInMonth;
  const rows = Math.ceil(totalCells / 7);

  // Unauthenticated state
  if (!authLoading && !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-56px)] px-4 gap-4">
        <h2
          className="text-xl font-bold font-display"
          style={{ color: 'var(--text-primary)' }}
        >
          Sign in to view the Archive
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Your play history is tracked per account.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-colors"
          style={{ backgroundColor: 'var(--tile-correct)' }}
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center min-h-[calc(100dvh-56px)] px-4 py-8"
      style={{ color: 'var(--text-primary)' }}
    >
      {/* Page header */}
      <div className="w-full max-w-lg mb-8 flex flex-col items-center gap-1">
        <h1
          className="text-3xl font-display font-black tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Archive
        </h1>
        <p className="text-sm font-sans" style={{ color: 'var(--text-secondary)' }}>
          Replay any past daily puzzle
        </p>
      </div>

      {/* Month picker */}
      <div className="w-full max-w-lg mb-6 flex items-center justify-between gap-2">
        <button
          onClick={handlePrev}
          disabled={fetching}
          aria-label="Previous month"
          className="p-2 rounded-md transition-colors duration-150 disabled:opacity-40"
          style={{
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
          }}
          onMouseEnter={(e) => {
            if (!fetching) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
          }}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>

        <span
          className="text-base font-bold font-sans tabular-nums"
          style={{ color: 'var(--text-primary)' }}
          aria-live="polite"
        >
          {MONTH_NAMES[month - 1]} {year}
        </span>

        <button
          onClick={handleNext}
          disabled={isNextDisabled || fetching}
          aria-label="Next month"
          className="p-2 rounded-md transition-colors duration-150 disabled:opacity-40"
          style={{
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
          }}
          onMouseEnter={(e) => {
            if (!isNextDisabled && !fetching)
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
          }}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Error message */}
      {error && (
        <p
          className="mb-4 text-sm rounded-lg px-4 py-2 w-full max-w-lg"
          style={{
            color: 'var(--red)',
            backgroundColor: 'rgba(231,76,60,0.08)',
            border: '1px solid rgba(231,76,60,0.18)',
          }}
          role="alert"
        >
          {error}
        </p>
      )}

      {/* Calendar */}
      <div
        className="w-full max-w-lg rounded-card border"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          {WEEKDAYS.map((d, i) => (
            <div
              key={i}
              className="flex items-center justify-center py-2 text-xs font-bold font-sans"
              style={{ color: 'var(--text-secondary)' }}
              aria-hidden="true"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="p-3">
          {fetching && entries.length === 0 ? (
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 35 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-tile skeleton"
                  style={{ border: '2px solid var(--border-subtle)' }}
                />
              ))}
            </div>
          ) : (
            <div
              className="grid grid-cols-7 gap-1.5"
              style={{ opacity: fetching ? 0.6 : 1, transition: 'opacity 0.15s ease' }}
            >
              {/* Leading blank cells */}
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const paddedMonth = String(month).padStart(2, '0');
                const paddedDay = String(day).padStart(2, '0');
                const dateStr = `${year}-${paddedMonth}-${paddedDay}`;
                const future = isFutureDate(dateStr);
                const entry = entryMap[dateStr];

                return (
                  <CalendarCell
                    key={dateStr}
                    day={day}
                    entry={entry}
                    future={future}
                    loading={replayingDate === dateStr}
                    onClick={() => entry && handleCellClick(entry)}
                  />
                );
              })}

              {/* Trailing blank cells to complete last row */}
              {Array.from({ length: rows * 7 - totalCells }).map((_, i) => (
                <div key={`trail-${i}`} />
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div
          className="flex items-center gap-4 flex-wrap px-4 py-3 border-t text-xs font-sans"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          {[
            { style: { backgroundColor: 'var(--tile-correct)', border: '2px solid var(--tile-correct)' }, label: 'Won' },
            { style: { backgroundColor: 'var(--tile-absent)', border: '2px solid var(--tile-absent)' }, label: 'Lost' },
            { style: { backgroundColor: 'var(--tile-present)', border: '2px solid var(--tile-present)' }, label: 'In progress' },
            { style: { backgroundColor: 'var(--tile-empty-bg)', border: '2px solid var(--tile-empty-border)' }, label: 'Not played' },
          ].map(({ style, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span
                className="inline-block w-3.5 h-3.5 rounded-[3px] flex-shrink-0"
                style={style}
                aria-hidden="true"
              />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
