'use client';
import { useState, useEffect, useCallback } from 'react';

export interface Settings {
  hardMode: boolean;
  highContrast: boolean;
  keyboardOnly: boolean;
  theme: 'light' | 'dark';
  reducedMotion: boolean;
}

const STORAGE_KEYS: Record<keyof Settings, string> = {
  hardMode: 'eloquence_hard_mode',
  highContrast: 'eloquence_colorblind',
  keyboardOnly: 'eloquence_keyboard_only',
  theme: 'eloquence_theme',
  reducedMotion: 'eloquence_reduced_motion',
};

function readFromStorage(): Settings {
  if (typeof window === 'undefined') {
    return {
      hardMode: false,
      highContrast: false,
      keyboardOnly: false,
      theme: 'light',
      reducedMotion: false,
    };
  }
  return {
    hardMode: localStorage.getItem(STORAGE_KEYS.hardMode) === 'true',
    highContrast: localStorage.getItem(STORAGE_KEYS.highContrast) === 'true',
    keyboardOnly: localStorage.getItem(STORAGE_KEYS.keyboardOnly) === 'true',
    theme: (localStorage.getItem(STORAGE_KEYS.theme) as 'light' | 'dark') === 'dark' ? 'dark' : 'light',
    reducedMotion: localStorage.getItem(STORAGE_KEYS.reducedMotion) === 'true',
  };
}

function applyDomSideEffects(key: keyof Settings, value: boolean | string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  switch (key) {
    case 'theme':
      if (value === 'dark') {
        root.dataset.theme = 'dark';
      } else {
        delete root.dataset.theme;
      }
      break;
    case 'highContrast':
      root.classList.toggle('colorblind', value === true);
      if (value === true) {
        root.dataset.highContrast = 'true';
      } else {
        delete root.dataset.highContrast;
      }
      break;
    case 'reducedMotion':
      root.classList.toggle('reduce-motion', value === true);
      break;
    case 'keyboardOnly':
      if (value === true) {
        root.dataset.keyboardOnly = 'true';
      } else {
        delete root.dataset.keyboardOnly;
      }
      break;
  }
}

export function useSettings(): [Settings, <K extends keyof Settings>(key: K, value: Settings[K]) => void] {
  const [settings, setSettings] = useState<Settings>(() => ({
    hardMode: false,
    highContrast: false,
    keyboardOnly: false,
    theme: 'light',
    reducedMotion: false,
  }));

  // Read from localStorage on mount (client-only)
  useEffect(() => {
    setSettings(readFromStorage());
  }, []);

  // Sync across tabs via storage event
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      const entry = Object.entries(STORAGE_KEYS).find(([, storageKey]) => storageKey === e.key);
      if (!entry) return;
      const [settingKey] = entry as [keyof Settings, string];
      setSettings(readFromStorage());
      // Re-apply DOM side effects for the changed key
      const newSettings = readFromStorage();
      applyDomSideEffects(settingKey, newSettings[settingKey]);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    const storageKey = STORAGE_KEYS[key];

    if (typeof value === 'boolean') {
      localStorage.setItem(storageKey, String(value));
    } else {
      localStorage.setItem(storageKey, value as string);
    }

    applyDomSideEffects(key, value);
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return [settings, setSetting];
}
