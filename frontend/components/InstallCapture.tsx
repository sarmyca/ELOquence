'use client';

import { useEffect } from 'react';
import { initInstallCapture } from '@/lib/pwaInstall';

// Invisible, app-wide listener. Mounted once in the root layout so the
// browser's `beforeinstallprompt` event is captured no matter which route
// the user first lands on. The visible prompt (components/InstallPrompt)
// renders only on the dashboard and reads the captured event from the store.
export default function InstallCapture() {
  useEffect(() => {
    initInstallCapture();
  }, []);
  return null;
}
