'use client';

import { useEffect, useRef } from 'react';
import { gamesApi } from '@/lib/api';

interface UseAbandonOnExitOptions {
  /** Game UUID to abandon. Falsy disables the hook. */
  gameId: string | null | undefined;
  /**
   * Whether the game is still in a state where a leave should trigger an
   * abandon (i.e. `status === 'in_progress'`). Toggles to false the moment
   * the game completes, which silences the pagehide beacon.
   */
  isActive: boolean;
  /**
   * Whether to prompt the user via `beforeunload` before they leave. Set
   * true for consequential modes (rated competitive — ELO loss; challenge —
   * word lockout) and false for forgiving ones (daily retryable, practice).
   * The prompt is browser-native; we can't customize the message.
   */
  warn: boolean;
}

/**
 * Catches three exit paths that would otherwise leave a game stuck
 * `in_progress` forever — and would let a rated player dodge ELO loss by
 * simply closing the tab:
 *
 *   1. Tab close / browser quit  → `pagehide` → beacon abandon
 *   2. Hard refresh (F5)         → `beforeunload` warn (if consequential)
 *                                  then `pagehide` → beacon abandon
 *   3. Navigate to external URL  → same as above
 *
 * In-app navigation via `router.push` does NOT fire either listener, so
 * a user moving between routes (e.g. back to /play after winning) is
 * unaffected. The server-side `create_game` cleanup is the safety net
 * for any case where the beacon never lands (network drop, browser crash):
 * starting any new same-mode game routes the stale one through
 * `abandon_game()` with the appropriate consequences.
 */
export function useAbandonOnExit({
  gameId,
  isActive,
  warn,
}: UseAbandonOnExitOptions): void {
  // Hold the latest props in a ref so the event listeners (registered
  // once) always see fresh values without needing to re-bind on every
  // render — re-binding could race with an actual unload event.
  const stateRef = useRef({ gameId, isActive, warn });
  stateRef.current = { gameId, isActive, warn };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const { isActive, warn } = stateRef.current;
      if (!isActive || !warn) return;
      // The non-empty returnValue is the legacy contract that triggers
      // the browser's native confirmation prompt. Modern browsers ignore
      // the custom message but still honour the prompt itself.
      e.preventDefault();
      e.returnValue = '';
    };

    const handlePageHide = (e: PageTransitionEvent) => {
      const { gameId, isActive } = stateRef.current;
      if (!isActive || !gameId) return;
      // `persisted=true` means the page is going into the back/forward
      // cache and may come back intact — don't abandon in that case.
      if (e.persisted) return;
      gamesApi.abandonBeacon(gameId);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);
}
