'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Palette, Zap, Trash2, UserX, AlertTriangle, X, Settings } from 'lucide-react';
import { usersApi } from '@/lib/api';

/* ------------------------------------------------------------------ */
/*  Shared modal shell                                                  */
/* ------------------------------------------------------------------ */

function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-[#1d1d21] border border-white/[0.08] shadow-modal p-6">
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle switch                                                       */
/* ------------------------------------------------------------------ */

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#538d4e]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1d21] shrink-0 ${
        checked
          ? 'bg-[#538d4e]'
          : 'bg-[#25252a] border border-white/[0.1]'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Delete All Games modal                                              */
/* ------------------------------------------------------------------ */

function DeleteGamesModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setError(null);
      setConfirmed(false);
    }
  }, [open]);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      await usersApi.deleteAllGames();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1 rounded-md text-text-ghost hover:text-text-secondary hover:bg-white/[0.05] transition-colors"
        aria-label="Close"
      >
        <X size={16} />
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-[#e74c3c]/15 flex items-center justify-center shrink-0">
          <Trash2 size={17} className="text-[#e74c3c]" />
        </div>
        <h2 className="text-base font-semibold text-text-primary">Delete All Game Data</h2>
      </div>

      <p className="text-sm text-text-secondary mb-3 leading-relaxed">
        This will permanently delete{' '}
        <span className="text-text-primary font-medium">all your past games</span>. Your ELO
        rating will be preserved.
      </p>

      <ul className="text-sm text-text-secondary mb-5 space-y-1.5 pl-4 list-disc marker:text-[#e74c3c]/60">
        <li>All game history erased</li>
        <li>Win/loss record cleared</li>
        <li>Streaks reset</li>
      </ul>

      <label className="flex items-center gap-2.5 mb-5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="w-4 h-4 rounded accent-[#e74c3c] cursor-pointer"
        />
        <span className="text-sm text-text-secondary">
          I understand this action is{' '}
          <span className="text-text-primary font-medium">irreversible</span>
        </span>
      </label>

      {error && (
        <p className="text-xs text-[#e74c3c] mb-4 px-3 py-2 rounded-lg bg-[#e74c3c]/10 border border-[#e74c3c]/20">
          {error}
        </p>
      )}

      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 text-sm rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/[0.05] transition-colors disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={!confirmed || loading}
          className="px-4 py-2 text-sm rounded-lg font-medium bg-[#e74c3c] text-white hover:bg-[#c0392b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Deleting...
            </>
          ) : (
            'Delete All Games'
          )}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Delete Account modal                                               */
/* ------------------------------------------------------------------ */

function DeleteAccountModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setError(null);
      setConfirmText('');
    } else {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  const canDelete = confirmText === 'DELETE';

  const handleDelete = async () => {
    if (!canDelete) return;
    setLoading(true);
    setError(null);
    try {
      await usersApi.deleteAccount();
      localStorage.removeItem('token');
      router.push('/login');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1 rounded-md text-text-ghost hover:text-text-secondary hover:bg-white/[0.05] transition-colors"
        aria-label="Close"
      >
        <X size={16} />
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-[#e74c3c]/15 flex items-center justify-center shrink-0">
          <UserX size={17} className="text-[#e74c3c]" />
        </div>
        <h2 className="text-base font-semibold text-text-primary">Delete Account</h2>
      </div>

      <div className="flex items-start gap-2.5 mb-4 px-3 py-2.5 rounded-lg bg-[#e74c3c]/10 border border-[#e74c3c]/20">
        <AlertTriangle size={15} className="text-[#e74c3c] shrink-0 mt-0.5" />
        <p className="text-xs text-[#e74c3c] leading-relaxed">
          Your account, all game data, ELO history, and achievements will be permanently
          deleted and <strong>cannot be recovered</strong>.
        </p>
      </div>

      <p className="text-sm text-text-secondary mb-3">
        Type{' '}
        <span className="font-mono font-semibold text-text-primary tracking-widest">
          DELETE
        </span>{' '}
        to confirm:
      </p>

      <input
        ref={inputRef}
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canDelete) handleDelete();
        }}
        placeholder="DELETE"
        disabled={loading}
        className="w-full mb-5 px-3 py-2 text-sm rounded-lg bg-[#25252a] border border-white/[0.08] text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-[#e74c3c]/50 transition-colors disabled:opacity-40 font-mono tracking-wider"
      />

      {error && (
        <p className="text-xs text-[#e74c3c] mb-4 px-3 py-2 rounded-lg bg-[#e74c3c]/10 border border-[#e74c3c]/20">
          {error}
        </p>
      )}

      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 text-sm rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/[0.05] transition-colors disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={!canDelete || loading}
          className="px-4 py-2 text-sm rounded-lg font-medium bg-[#e74c3c] text-white hover:bg-[#c0392b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Deleting...
            </>
          ) : (
            'Delete My Account'
          )}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Setting row                                                         */
/* ------------------------------------------------------------------ */

function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-[12px] bg-[#1d1d21] border border-white/[0.08]">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-bg-tertiary flex items-center justify-center shrink-0 text-text-secondary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">{title}</p>
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main settings page                                                  */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const [colorBlind, setColorBlind] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const [showDeleteGamesModal, setShowDeleteGamesModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [gamesDeletedBanner, setGamesDeletedBanner] = useState(false);

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

  const handleGamesDeleted = () => {
    setGamesDeletedBanner(true);
    setTimeout(() => setGamesDeletedBanner(false), 5000);
  };

  return (
    <>
      <div className="max-w-xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center gap-2.5 mb-7">
          <div className="p-2 rounded-lg bg-[#171719] border border-white/[0.08] text-text-secondary">
            <Settings size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Settings</h1>
            <p className="text-xs text-text-secondary mt-0.5">Customize your experience</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Accessibility section */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-ghost mb-2 px-1">
              Accessibility
            </p>
            <div className="flex flex-col gap-2">
              <SettingRow
                icon={<Palette size={17} />}
                title="High Contrast Mode"
                description="Orange/blue tiles for color vision deficiency"
              >
                <Toggle
                  checked={colorBlind}
                  onChange={toggleColorBlind}
                  label="Toggle high contrast mode"
                />
              </SettingRow>

              <SettingRow
                icon={<Zap size={17} />}
                title="Reduced Motion"
                description="Minimize animations throughout the app"
              >
                <Toggle
                  checked={reducedMotion}
                  onChange={toggleReducedMotion}
                  label="Toggle reduced motion"
                />
              </SettingRow>

              {colorBlind && (
                <div className="p-4 rounded-[12px] bg-[#1d1d21] border border-white/[0.08]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-ghost mb-3">
                    Color Preview
                  </p>
                  <div className="flex gap-2">
                    <div
                      className="w-10 h-10 rounded-md flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: '#f5793a' }}
                      aria-label="Correct position color: orange"
                    >
                      A
                    </div>
                    <div
                      className="w-10 h-10 rounded-md flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: '#85c0f9' }}
                      aria-label="Wrong position color: blue"
                    >
                      B
                    </div>
                    <div
                      className="w-10 h-10 rounded-md flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: '#3a3a3c' }}
                      aria-label="Not in word color: gray"
                    >
                      C
                    </div>
                  </div>
                  <p className="text-[10px] text-text-ghost mt-2.5">
                    Orange = correct position · Blue = wrong position · Gray = not in word
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Danger zone section */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-ghost mb-2 px-1">
              Danger Zone
            </p>

            <div className="rounded-[12px] bg-[#1d1d21] border border-[#e74c3c]/30 overflow-hidden">
              {/* Header strip */}
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#e74c3c]/20 bg-[#e74c3c]/[0.05]">
                <AlertTriangle size={14} className="text-[#e74c3c]" />
                <span className="text-xs font-semibold text-[#e74c3c]">
                  Irreversible actions — proceed with caution
                </span>
              </div>

              <div className="flex flex-col divide-y divide-white/[0.06]">
                {/* Delete All Games */}
                <div className="flex items-center justify-between px-4 py-4 gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#e74c3c]/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Trash2 size={14} className="text-[#e74c3c]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">Delete All Game Data</p>
                      <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                        Erase all past games. Your ELO rating will be preserved.
                      </p>
                      {gamesDeletedBanner && (
                        <p className="text-xs text-[#538d4e] mt-1.5 font-medium">
                          All game data deleted. ELO preserved.
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDeleteGamesModal(true)}
                    className="shrink-0 px-3 py-1.5 text-xs rounded-lg font-medium border border-[#e74c3c]/40 text-[#e74c3c] hover:bg-[#e74c3c]/10 transition-colors"
                  >
                    Delete Games
                  </button>
                </div>

                {/* Delete Account */}
                <div className="flex items-center justify-between px-4 py-4 gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#e74c3c]/10 flex items-center justify-center shrink-0 mt-0.5">
                      <UserX size={14} className="text-[#e74c3c]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">Delete Account</p>
                      <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                        Permanently delete your account and all associated data.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDeleteAccountModal(true)}
                    className="shrink-0 px-3 py-1.5 text-xs rounded-lg font-medium bg-[#e74c3c]/15 border border-[#e74c3c]/40 text-[#e74c3c] hover:bg-[#e74c3c]/25 transition-colors"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <DeleteGamesModal
        open={showDeleteGamesModal}
        onClose={() => setShowDeleteGamesModal(false)}
        onSuccess={handleGamesDeleted}
      />
      <DeleteAccountModal
        open={showDeleteAccountModal}
        onClose={() => setShowDeleteAccountModal(false)}
      />
    </>
  );
}
