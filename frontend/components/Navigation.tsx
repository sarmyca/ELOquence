'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogOut, ShieldCheck, Settings } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { getRatingTier } from '@/lib/types';
import clsx from 'clsx';

// Routes an admin should never land on — they're not a player. Hitting one of
// these (via direct URL, stale tab, bookmark) bounces them to /admin.
const PLAYER_ROUTE_PREFIXES = [
  '/play',
  '/dashboard',
  '/leaderboard',
  '/archive',
  '/learn',
  '/achievements',
  '/game/',
  '/review/',
  '/challenge/',
];

function isPlayerRoute(pathname: string): boolean {
  return PLAYER_ROUTE_PREFIXES.some(
    (p) => pathname === p || pathname === p.replace(/\/$/, '') || pathname.startsWith(p),
  );
}

const GUEST_NAV_LINKS = [
  { href: '/play', label: 'Play' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/faq', label: 'FAQ' },
];

const AUTH_NAV_LINKS = [
  { href: '/play', label: 'Play' },
  { href: '/archive', label: 'Archive' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/learn', label: 'Learn' },
  { href: '/faq', label: 'FAQ' },
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

  const isAdmin = !!user?.is_admin;
  const tier = user && !isAdmin ? getRatingTier(user.elo_rating) : null;

  // If an admin lands on a player route (or the home page), send them to /admin.
  // Runs only after auth has resolved so we don't bounce mid-load.
  useEffect(() => {
    if (!isAdmin) return;
    if (pathname === '/' || isPlayerRoute(pathname)) {
      router.replace('/admin');
    }
  }, [isAdmin, pathname, router]);

  const handleLogout = () => {
    logout();
    router.push('/');
    setMobileOpen(false);
  };

  // Admin users get a stripped shell — no player nav items, no ELO badge.
  // They are not players; the only navigation that makes sense is between
  // admin sections (handled by AdminNav inside each /admin/* page).
  const navLinks = isAdmin
    ? []
    : [
        ...(user ? AUTH_NAV_LINKS : GUEST_NAV_LINKS),
        ...(user ? [{ href: '/achievements', label: 'Achievements' }] : []),
      ];

  const logoHref = isAdmin ? '/admin' : '/';

  return (
    <header
      className="sticky top-0 z-50 bg-bg-base/95 backdrop-blur-md border-b border-border-default"
      style={{ height: '52px' }}
    >
      <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">

        {/* Logo */}
        <Link
          href={logoHref}
          className="font-display font-black text-xl text-text-primary tracking-tight transition-opacity duration-150 hover:opacity-70 flex items-center gap-2"
          aria-label={isAdmin ? 'Admin home' : 'ELOquence home'}
        >
          ELOquence
          {isAdmin && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold font-sans uppercase tracking-wider"
              style={{ background: 'rgba(201,162,39,0.14)', color: 'var(--gold)' }}
            >
              <ShieldCheck size={9} />
              Admin
            </span>
          )}
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
                  'relative px-3 py-1.5 text-sm transition-colors duration-150',
                  active
                    ? 'text-text-primary underline underline-offset-8 decoration-2 decoration-tile-correct'
                    : 'text-text-secondary hover:text-text-primary no-underline'
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              {/* ELO rating with tier dot — players only (admins are not players) */}
              {!isAdmin && tier && (
                <>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tier.color }}
                      aria-hidden="true"
                    />
                    <span
                      className="font-mono text-sm"
                      style={{ color: tier.color }}
                      aria-label={`ELO rating ${Math.round(user.elo_rating)}, ${tier.name}`}
                    >
                      {Math.round(user.elo_rating)}
                    </span>
                  </div>
                  <div className="w-px h-3.5 bg-border-subtle mx-0.5" aria-hidden="true" />
                </>
              )}

              {/* Username */}
              <span className="text-sm text-text-secondary">{user.username}</span>

              {/* Settings */}
              <Link
                href="/settings"
                className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors duration-150"
                aria-label="Settings"
              >
                <Settings size={15} aria-hidden="true" />
              </Link>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors duration-150"
                aria-label="Log out"
              >
                <LogOut size={15} aria-hidden="true" />
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-150 flex items-center gap-1"
            >
              Sign In
              <span aria-hidden="true" style={{ fontSize: '0.85em' }}>&rarr;</span>
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors duration-150"
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
            className="md:hidden absolute left-0 right-0 bg-bg-base border-b border-border-default"
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
                        ? 'text-text-primary font-medium'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                    )}
                  >
                    {active && (
                      <span
                        className="w-1 h-1 rounded-full flex-shrink-0"
                        style={{ backgroundColor: 'var(--tile-correct)' }}
                        aria-hidden="true"
                      />
                    )}
                    {link.label}
                  </Link>
                );
              })}

              {/* Divider */}
              <div className="my-1.5 border-t border-border-subtle" aria-hidden="true" />

              {/* Auth section */}
              {user ? (
                <>
                  {/* User info row */}
                  <div className="px-3 py-2 flex items-center gap-2">
                    {!isAdmin && tier && (
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tier.color }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-sm text-text-secondary">{user.username}</span>
                    {!isAdmin && tier && (
                      <span
                        className="ml-auto font-mono text-sm"
                        style={{ color: tier.color }}
                        aria-label={`ELO ${Math.round(user.elo_rating)}`}
                      >
                        {Math.round(user.elo_rating)}
                      </span>
                    )}
                    {isAdmin && (
                      <span
                        className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold font-sans uppercase tracking-wider"
                        style={{ color: 'var(--gold)' }}
                      >
                        <ShieldCheck size={10} />
                        Admin
                      </span>
                    )}
                  </div>

                  <Link
                    href="/settings"
                    onClick={() => setMobileOpen(false)}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors duration-150',
                      pathname === '/settings'
                        ? 'text-text-primary font-medium'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                    )}
                  >
                    <Settings size={14} aria-hidden="true" />
                    Settings
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors duration-150 text-left w-full"
                  >
                    <LogOut size={14} aria-hidden="true" />
                    Log out
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors duration-150"
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
