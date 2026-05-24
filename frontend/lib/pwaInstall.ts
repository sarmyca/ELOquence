// Shared store for the browser's PWA install prompt.
//
// `beforeinstallprompt` fires once, early, on the first eligible hard page
// load — usually before the user has navigated to any particular route. If
// the only listener lived inside a component that mounts on /dashboard, the
// event would be missed whenever the user landed elsewhere first (e.g. the
// post-login redirect to /play). So we capture the event app-wide via
// `initInstallCapture()` (called from a layout-level component) and let the
// visible prompt — which only renders on the dashboard — read it from here.

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;
const listeners = new Set<() => void>();

function emit() {
  for (const cb of listeners) cb();
}

/** Start listening for the install prompt event. Idempotent + SSR-safe. */
export function initInstallCapture() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Stop Chrome's default mini-infobar; we drive the prompt ourselves.
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    emit();
  });
}

/** Subscribe to changes in the captured prompt (for useSyncExternalStore). */
export function subscribeInstall(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Current captured prompt, or null if none is pending. */
export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

/** Clear the captured prompt once it has been shown or dismissed. */
export function consumeDeferredPrompt() {
  deferredPrompt = null;
  emit();
}
