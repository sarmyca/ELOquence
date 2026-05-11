'use client';
import { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

/** All known tip cases keyed by the backend `tip_case` string. */
const TIP_LIBRARY: Record<string, { title: string; body: string }> = {
  green_kept_unused: {
    title: 'Green letter not re-used',
    body:
      'You had confirmed green letters but didn\'t include them in this guess. Hard mode would have required you to keep them. Consider locking in confirmed letters to narrow the answer faster.',
  },
  yellow_in_multiple_spots: {
    title: 'Yellow letter placed wrong again',
    body:
      'A yellow letter tells you the letter is in the answer but NOT in that position. If you placed it in the same spot again, you wasted the information. Try it in a different position.',
  },
  bot_suggests_solution: {
    title: 'Bot would guess a valid answer',
    body:
      'The bot\'s preferred pick is itself a possible solution here. When the pool is small, guessing a valid answer instead of a "probe" word can win you the game a turn sooner.',
  },
  efficient_split: {
    title: 'More efficient split available',
    body:
      'The bot chose a different word because it splits the remaining candidates more evenly. Words like BATCH or BLIMP can divide hundreds of candidates into roughly equal groups, even if they look unusual. A better split means fewer guesses on average.',
  },
};

const DEFAULT_TIP = {
  title: 'Bot tip',
  body: 'The bot chose a different word. Its pick maximises the expected information gained across all possible answers — a balance of splitting the candidate pool and considering likely solutions.',
};

interface Props {
  tipCase: string;
  /** Small trigger label shown on the pill */
  triggerLabel?: string;
}

/**
 * EducationalTip — a "Why?" pill that reveals a contextual explanation
 * in a lightweight popover positioned absolutely near its trigger.
 */
export default function EducationalTip({ tipCase, triggerLabel = 'Why?' }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tip = TIP_LIBRARY[tipCase] ?? DEFAULT_TIP;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors"
        style={{
          color: 'var(--tile-present)',
          backgroundColor: 'rgba(201,180,88,0.12)',
          border: '1px solid rgba(201,180,88,0.25)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(201,180,88,0.2)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(201,180,88,0.12)';
        }}
      >
        <HelpCircle size={9} />
        {triggerLabel}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={tip.title}
          className="absolute z-30 left-0 top-full mt-1.5 w-64 rounded-xl p-3 shadow-modal"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-start gap-2">
            <HelpCircle
              size={13}
              className="shrink-0 mt-0.5"
              style={{ color: 'var(--tile-present)' }}
            />
            <div>
              <p
                className="text-[11px] font-semibold mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                {tip.title}
              </p>
              <p
                className="text-[10px] leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {tip.body}
              </p>
            </div>
          </div>
          {/* Close affordance */}
          <button
            onClick={() => setOpen(false)}
            className="absolute top-2 right-2 p-0.5 rounded"
            aria-label="Close tip"
            style={{ color: 'var(--text-tertiary)' }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
