'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share, X, Plus } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'eloquence_install_dismissed';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

function isRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) return;
    if (isRecentlyDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    // iOS Safari never fires beforeinstallprompt — show a manual hint instead.
    if (isIosSafari()) {
      const t = window.setTimeout(() => {
        setShowIosHint(true);
        setVisible(true);
      }, 4000);
      return () => {
        window.removeEventListener('beforeinstallprompt', onBeforeInstall);
        window.removeEventListener('appinstalled', onInstalled);
        window.clearTimeout(t);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Ignore — private mode, etc.
    }
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'dismissed') {
        dismiss();
      }
    } catch (err) {
      console.warn('[install] prompt failed', err);
    } finally {
      setDeferred(null);
      setVisible(false);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="fixed left-1/2 -translate-x-1/2 z-40 px-4"
          style={{ bottom: 'max(16px, env(safe-area-inset-bottom))', maxWidth: '420px', width: '100%' }}
          role="dialog"
          aria-label="Install ELOquence"
        >
          <div
            className="rounded-card-lg p-4 flex items-start gap-3"
            style={{
              backgroundColor: 'var(--bg-base)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
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
