'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogOut, BarChart2, ShieldCheck, Settings } from 'lucide-react';
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

function isLinkActive(pathname: string, href: string): boolean {
  if (href === '/play') return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

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

  const navLinks = [
    ...(user ? AUTH_NAV_LINKS : GUEST_NAV_LINKS),
    ...(user ? [{ href: '/achievements', label: 'Achievements' }] : []),
  ];

  return (
    <header
      className="sticky top-0 z-50 bg-bg-base border-b border-white/[0.06]"
      style={{ height: '52px' }}
    >
      <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">

        {/* Logo */}
        <Link
          href="/"
          className="flex items-center tracking-tight transition-opacity duration-150 hover:opacity-80"
          aria-label="ELOquence home"
        >
          <span className="text-base font-bold" style={{ color: '#538d4e' }}>ELO</span>
          <span className="text-base font-semibold" style={{ color: '#ededf0' }}>quence</span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-0.5" aria-label="Main navigation">
          {navLinks.map((link) => {
            const active = isLinkActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  'relative px-3 py-1.5 text-sm transition-colors duration-150 flex flex-col items-center gap-0',
                  active
                    ? 'text-[#ededf0]'
                    : 'text-[#9898a0] hover:text-[#ededf0]'
                )}
              >
                {link.label}
                {active && (
                  <span
                    className="absolute -bottom-[1px] left-1/2 -translate-x-1/2 w-[2px] h-[2px] rounded-full bg-[#538d4e]"
                    style={{ marginBottom: '-1px' }}
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
          {user?.is_admin && (
            <Link
              href="/admin"
              className={clsx(
                'relative px-3 py-1.5 text-sm transition-colors duration-150 flex items-center gap-1.5',
                pathname.startsWith('/admin')
                  ? 'text-[#c9a227]'
                  : 'text-[#9898a0] hover:text-[#c9a227]'
              )}
            >
              <ShieldCheck size={13} aria-hidden="true" />
              Admin
              {pathname.startsWith('/admin') && (
                <span
                  className="absolute -bottom-[1px] left-1/2 -translate-x-1/2 w-[2px] h-[2px] rounded-full bg-[#c9a227]"
                  aria-hidden="true"
                />
              )}
            </Link>
          )}
        </nav>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              {/* ELO rating with tier dot */}
              <div className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tier?.color }}
                  aria-hidden="true"
                />
                <span
                  className="font-mono text-sm"
                  style={{ color: tier?.color }}
                  aria-label={`ELO rating ${Math.round(user.elo_rating)}, ${tier?.name}`}
                >
                  {Math.round(user.elo_rating)}
                </span>
              </div>

              {/* Thin divider */}
              <div className="w-px h-3.5 bg-white/[0.09] mx-0.5" aria-hidden="true" />

              {/* Username */}
              <span className="text-sm text-[#9898a0]">{user.username}</span>

              {/* Settings */}
              <Link
                href="/settings"
                className="p-1.5 rounded-md text-[#5c5c66] hover:text-[#ededf0] hover:bg-white/[0.06] transition-colors duration-150"
                aria-label="Settings"
              >
                <Settings size={15} aria-hidden="true" />
              </Link>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-md text-[#5c5c66] hover:text-red-400 hover:bg-white/[0.06] transition-colors duration-150"
                aria-label="Log out"
              >
                <LogOut size={15} aria-hidden="true" />
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 text-sm transition-colors duration-150"
              style={{ color: '#6aaa64' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#7ec878')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#6aaa64')}
            >
              Sign In
              <span aria-hidden="true" style={{ fontSize: '0.85em' }}>&rarr;</span>
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-1.5 rounded-md text-[#9898a0] hover:text-[#ededf0] hover:bg-white/[0.06] transition-colors duration-150"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-panel"
        >
          {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>

      {/* Mobile dropdown panel */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-nav-panel"
            role="navigation"
            aria-label="Mobile navigation"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="md:hidden absolute left-0 right-0 bg-bg-base border-b border-white/[0.06]"
            style={{ top: '52px' }}
          >
            <div className="px-3 py-2.5 flex flex-col">

              {/* Nav links */}
              {navLinks.map((link) => {
                const active = isLinkActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={clsx(
                      'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors duration-150',
                      active
                        ? 'text-[#ededf0]'
                        : 'text-[#9898a0] hover:text-[#ededf0] hover:bg-white/[0.04]'
                    )}
                  >
                    {active && (
                      <span
                        className="w-[2px] h-[2px] rounded-full bg-[#538d4e] flex-shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    {link.label}
                  </Link>
                );
              })}

              {user?.is_admin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors duration-150',
                    pathname.startsWith('/admin')
                      ? 'text-[#c9a227]'
                      : 'text-[#9898a0] hover:text-[#c9a227] hover:bg-white/[0.04]'
                  )}
                >
                  <ShieldCheck size={13} aria-hidden="true" />
                  Admin
                </Link>
              )}

              {/* Divider */}
              <div className="my-1.5 border-t border-white/[0.06]" aria-hidden="true" />

              {/* Auth section */}
              {user ? (
                <>
                  {/* User info row */}
                  <div className="px-3 py-2 flex items-center gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tier?.color }}
                      aria-hidden="true"
                    />
                    <span className="text-sm text-[#9898a0]">{user.username}</span>
                    <span
                      className="ml-auto font-mono text-sm"
                      style={{ color: tier?.color }}
                      aria-label={`ELO ${Math.round(user.elo_rating)}`}
                    >
                      {Math.round(user.elo_rating)}
                    </span>
                  </div>

                  <Link
                    href="/settings"
                    onClick={() => setMobileOpen(false)}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors duration-150',
                      pathname === '/settings'
                        ? 'text-[#ededf0]'
                        : 'text-[#9898a0] hover:text-[#ededf0] hover:bg-white/[0.04]'
                    )}
                  >
                    <Settings size={14} aria-hidden="true" />
                    Settings
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[#9898a0] hover:text-red-400 hover:bg-white/[0.04] transition-colors duration-150 text-left w-full"
                  >
                    <LogOut size={14} aria-hidden="true" />
                    Log out
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm transition-colors duration-150"
                  style={{ color: '#6aaa64' }}
                >
                  Sign In
                  <span aria-hidden="true" style={{ fontSize: '0.85em' }}>&rarr;</span>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
