'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share, X, Plus } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  subscribeInstall,
  getDeferredPrompt,
  consumeDeferredPrompt,
} from '@/lib/pwaInstall';

// Per-account, per-device flag. Once set the install card never shows again
// on this browser for this user. Different accounts on the same browser get
// independent flags.
const seenKey = (userId: string) => `eloquence_install_seen_${userId}`;

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

function alreadySeen(userId: string): boolean {
  try {
    return localStorage.getItem(seenKey(userId)) !== null;
  } catch {
    return false;
  }
}

function markSeen(userId: string) {
  try {
    localStorage.setItem(seenKey(userId), String(Date.now()));
  } catch {
    // private mode / quota — best effort
  }
}

// Inline install card. Rendered inside the dashboard (not the global layout),
// so the prompt lives on the dashboard rather than floating over every page.
// The browser install event itself is captured app-wide by InstallCapture and
// read here via the shared store.
export default function InstallPrompt() {
  const { user } = useAuth();
  const deferred = useSyncExternalStore(
    subscribeInstall,
    getDeferredPrompt,
    () => null,
  );

  // Defer all window/localStorage reads to after mount so SSR and the first
  // client render agree (both render nothing).
  const [mounted, setMounted] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => setMounted(true), []);

  // iOS Safari never fires beforeinstallprompt — surface a manual "Add to
  // Home Screen" hint shortly after the dashboard loads instead.
  useEffect(() => {
    if (!mounted || !user) return;
    if (isStandalone() || alreadySeen(user.id) || !isIosSafari()) return;
    const t = window.setTimeout(() => setShowIosHint(true), 1500);
    return () => window.clearTimeout(t);
  }, [mounted, user]);

  if (!mounted || !user) return null;

  const eligible =
    !dismissed && !isStandalone() && !alreadySeen(user.id);
  const visible = eligible && (!!deferred || showIosHint);

  const dismiss = () => {
    markSeen(user.id);
    setDismissed(true);
    consumeDeferredPrompt();
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch (err) {
      console.warn('[install] prompt failed', err);
    } finally {
      markSeen(user.id);
      consumeDeferredPrompt();
      setDismissed(true);
    }
  };

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
          className="overflow-hidden"
          role="dialog"
          aria-label="Install ELOquence"
        >
          <div
            className="rounded-card-lg p-4 flex items-start gap-3"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
            }}
          >
            <div
              className="flex items-center justify-center rounded-[10px] flex-shrink-0"
              style={{
                width: 40,
                height: 40,
                backgroundColor: 'var(--tile-correct)',
                color: '#ffffff',
              }}
              aria-hidden="true"
            >
              {showIosHint ? <Share size={18} /> : <Download size={18} />}
            </div>

            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-semibold leading-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                {showIosHint ? 'Add ELOquence to Home Screen' : 'Install ELOquence'}
              </p>
              {showIosHint ? (
                <p
                  className="text-xs mt-1 leading-snug flex items-center gap-1 flex-wrap"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Tap <Share size={12} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> then
                  <span className="inline-flex items-center gap-0.5">
                    <Plus size={12} /> Add to Home Screen
                  </span>
                </p>
              ) : (
                <p
                  className="text-xs mt-1 leading-snug"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Faster launch, full-screen play, works offline.
                </p>
              )}

              {!showIosHint && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={install}
                    className="px-3 py-1.5 rounded-[8px] text-xs font-semibold text-white transition-opacity duration-150 hover:opacity-90"
                    style={{ backgroundColor: 'var(--tile-correct)' }}
                  >
                    Install
                  </button>
                  <button
                    onClick={dismiss}
                    className="px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors duration-150"
                    style={{
                      color: 'var(--text-secondary)',
                      backgroundColor: 'transparent',
                    }}
                  >
                    Not now
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="p-1 rounded-md transition-colors duration-150 flex-shrink-0"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
