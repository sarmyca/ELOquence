'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogOut, BarChart2, Trophy, ShieldCheck, Settings } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { getRatingTier } from '@/lib/types';
import clsx from 'clsx';

const GUEST_NAV_LINKS = [
  { href: '/play', label: 'Play' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/learn', label: 'Learn' },
];

const AUTH_NAV_LINKS = [
  { href: '/play', label: 'Play' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/learn', label: 'Learn' },
];

export default function Navigation() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const tier = user ? getRatingTier(user.elo_rating) : null;

  const handleLogout = () => {
    logout();
    router.push('/');
    setMobileOpen(false);
  };

  // Build nav links — add Achievements for logged-in users, Admin for admins
  const navLinks = [
    ...(user ? AUTH_NAV_LINKS : GUEST_NAV_LINKS),
    ...(user ? [{ href: '/achievements', label: 'Achievements' }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 h-14 bg-bg-primary border-b border-white/[0.08]">
      <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="font-semibold text-base tracking-tight text-text-primary hover:text-white transition-colors"
        >
          ELO<span className="text-[#6aaa64]">quence</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                pathname === link.href || (link.href !== '/play' && pathname.startsWith(link.href))
                  ? 'bg-white/[0.08] text-text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]'
              )}
            >
              {link.href === '/achievements' ? (
                <span className="flex items-center gap-1.5">
                  <Trophy size={13} />
                  {link.label}
                </span>
              ) : (
                link.label
              )}
            </Link>
          ))}
          {user?.is_admin && (
            <Link
              href="/admin"
              className={clsx(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5',
                pathname.startsWith('/admin')
                  ? 'bg-[#c9a227]/10 text-[#c9a227]'
                  : 'text-text-secondary hover:text-[#c9a227] hover:bg-[#c9a227]/[0.06]'
              )}
            >
              <ShieldCheck size={13} />
              Admin
            </Link>
          )}
        </nav>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              {/* ELO badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-bg-tertiary border border-white/[0.08]">
                <BarChart2 size={14} className="text-text-secondary" />
                <span
                  className="text-sm font-mono font-semibold"
                  style={{ color: tier?.color }}
                >
                  {Math.round(user.elo_rating)}
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded font-medium"
                  style={{
                    color: tier?.color,
                    backgroundColor: `${tier?.color}1a`,
                  }}
                >
                  {tier?.name}
                </span>
              </div>
              <span className="text-sm text-text-secondary">{user.username}</span>
              <Link
                href="/settings"
                className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] transition-colors"
                aria-label="Settings"
              >
                <Settings size={16} />
              </Link>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] transition-colors"
                aria-label="Logout"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm px-3 py-1.5 rounded-md bg-[#538d4e] hover:bg-[#6aaa64] text-white font-medium transition-colors"
              >
                Sign In
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-white/[0.06] transition-colors"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="md:hidden absolute top-14 left-0 right-0 bg-bg-primary border-b border-white/[0.08] shadow-xl"
          >
            <div className="px-4 py-3 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    pathname === link.href || (link.href !== '/play' && pathname.startsWith(link.href))
                      ? 'bg-white/[0.08] text-text-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]'
                  )}
                >
                  {link.href === '/achievements' ? (
                    <span className="flex items-center gap-1.5">
                      <Trophy size={13} />
                      {link.label}
                    </span>
                  ) : (
                    link.label
                  )}
                </Link>
              ))}
              {user?.is_admin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    'px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5',
                    pathname.startsWith('/admin')
                      ? 'bg-[#c9a227]/10 text-[#c9a227]'
                      : 'text-text-secondary hover:text-[#c9a227] hover:bg-[#c9a227]/[0.06]'
                  )}
                >
                  <ShieldCheck size={13} />
                  Admin
                </Link>
              )}
              <div className="my-1 border-t border-white/[0.06]" />
              {user ? (
                <>
                  <div className="px-3 py-2 flex items-center gap-2">
                    <span className="text-sm text-text-secondary">{user.username}</span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{
                        color: tier?.color,
                        backgroundColor: `${tier?.color}1a`,
                      }}
                    >
                      {tier?.name}
                    </span>
                    <span
                      className="text-sm font-mono font-semibold ml-auto"
                      style={{ color: tier?.color }}
                    >
                      {Math.round(user.elo_rating)}
                    </span>
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => setMobileOpen(false)}
                    className={clsx(
                      'px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2',
                      pathname === '/settings'
                        ? 'bg-white/[0.08] text-text-primary'
                        : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]'
                    )}
                  >
                    <Settings size={14} />
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-2 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-white/[0.04] transition-colors text-left flex items-center gap-2"
                  >
                    <LogOut size={14} />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="px-3 py-2 rounded-md text-sm bg-[#538d4e] text-white font-medium hover:bg-[#6aaa64] transition-colors text-center"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
