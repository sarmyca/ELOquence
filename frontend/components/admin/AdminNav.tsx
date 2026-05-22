'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/games', label: 'Games' },
  { href: '/admin/words', label: 'Words' },
  { href: '/admin/announcements', label: 'Announcements' },
  { href: '/admin/audit', label: 'Audit' },
  { href: '/admin/health', label: 'Health' },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      className="mb-6 flex items-center gap-0.5 overflow-x-auto pb-1"
      aria-label="Admin navigation"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-1.5 rounded-md text-sm font-sans whitespace-nowrap transition-colors flex-shrink-0"
            style={
              isActive
                ? {
                    backgroundColor: 'color-mix(in srgb, var(--tile-correct) 12%, transparent)',
                    color: 'var(--tile-correct)',
                    fontWeight: 600,
                  }
                : {
                    color: 'var(--text-secondary)',
                  }
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
