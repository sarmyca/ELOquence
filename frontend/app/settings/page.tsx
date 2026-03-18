'use client';
import { useState, useEffect } from 'react';
import { Palette, Zap } from 'lucide-react';

export default function SettingsPage() {
  const [colorBlind, setColorBlind] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setColorBlind(localStorage.getItem('eloquence_colorblind') === 'true');
    setReducedMotion(localStorage.getItem('eloquence_reduced_motion') === 'true');
  }, []);

  const toggleColorBlind = () => {
    const next = !colorBlind;
    setColorBlind(next);
    localStorage.setItem('eloquence_colorblind', String(next));
    document.documentElement.classList.toggle('colorblind', next);
  };

  const toggleReducedMotion = () => {
    const next = !reducedMotion;
    setReducedMotion(next);
    localStorage.setItem('eloquence_reduced_motion', String(next));
    document.documentElement.classList.toggle('reduce-motion', next);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-text-primary mb-6">Settings</h1>

      <div className="flex flex-col gap-3">
        {/* Color-blind mode */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-bg-secondary border border-white/[0.08]">
          <div className="flex items-center gap-3">
            <Palette size={18} className="text-text-secondary" />
            <div>
              <p className="text-sm font-medium text-text-primary">High Contrast Mode</p>
              <p className="text-xs text-text-secondary">Orange/blue tiles for color vision deficiency</p>
            </div>
          </div>
          <button
            onClick={toggleColorBlind}
            aria-checked={colorBlind}
            role="switch"
            aria-label="Toggle high contrast mode"
            className={`relative w-11 h-6 rounded-full transition-colors ${colorBlind ? 'bg-[#538d4e]' : 'bg-bg-tertiary border border-white/[0.1]'}`}
          >
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${colorBlind ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        {/* Reduced motion */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-bg-secondary border border-white/[0.08]">
          <div className="flex items-center gap-3">
            <Zap size={18} className="text-text-secondary" />
            <div>
              <p className="text-sm font-medium text-text-primary">Reduced Motion</p>
              <p className="text-xs text-text-secondary">Minimize animations throughout the app</p>
            </div>
          </div>
          <button
            onClick={toggleReducedMotion}
            aria-checked={reducedMotion}
            role="switch"
            aria-label="Toggle reduced motion"
            className={`relative w-11 h-6 rounded-full transition-colors ${reducedMotion ? 'bg-[#538d4e]' : 'bg-bg-tertiary border border-white/[0.1]'}`}
          >
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${reducedMotion ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        {/* Color preview — only visible when color-blind mode is on */}
        {colorBlind && (
          <div className="p-4 rounded-xl bg-bg-secondary border border-white/[0.08]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-ghost mb-3">Color Preview</p>
            <div className="flex gap-2">
              <div
                className="w-10 h-10 rounded-sm flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: '#f5793a' }}
                aria-label="Correct position color: orange"
              >
                A
              </div>
              <div
                className="w-10 h-10 rounded-sm flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: '#85c0f9' }}
                aria-label="Wrong position color: blue"
              >
                B
              </div>
              <div
                className="w-10 h-10 rounded-sm flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: '#3a3a3c' }}
                aria-label="Not in word color: gray"
              >
                C
              </div>
            </div>
            <p className="text-[10px] text-text-ghost mt-2">
              Orange = correct position, Blue = wrong position, Gray = not in word
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
