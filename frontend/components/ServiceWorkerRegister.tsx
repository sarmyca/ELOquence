'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js once on the client.
 *
 * Behavior:
 *  - Only runs in production OR when explicitly enabled via NEXT_PUBLIC_ENABLE_SW=1
 *    in dev (so HMR isn't disrupted by stale cached chunks during development).
 *  - When a new SW is found waiting, asks it to skip waiting so the next
 *    navigation gets the fresh assets.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const isProd = process.env.NODE_ENV === 'production';
    const forceEnable = process.env.NEXT_PUBLIC_ENABLE_SW === '1';
    if (!isProd && !forceEnable) return;

    let cancelled = false;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        if (cancelled) return;

        // If there's already a waiting worker, activate it ASAP.
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // Listen for future updates.
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              // A newer worker is ready; quietly take over on the next reload.
              sw.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      } catch (err) {
        console.warn('[sw] registration failed', err);
      }
    };

    // Defer to idle so we don't compete with critical-path work on first paint.
    const idle =
      (window as Window & typeof globalThis & {
        requestIdleCallback?: (cb: () => void) => number;
      }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1000));
    idle(register);

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
