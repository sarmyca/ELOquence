import type { Metadata, Viewport } from 'next';
import { Libre_Franklin, Roboto_Slab, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/hooks/useAuth';
import Navigation from '@/components/Navigation';
import AnnouncementBanner from '@/components/AnnouncementBanner';

const libreFranklin = Libre_Franklin({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700', '900'],
});

const robotoSlab = Roboto_Slab({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['700', '900'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ELOquence',
  description:
    'Competitive Wordle with information-theory analysis, ELO ratings, and deep move breakdowns.',
  openGraph: {
    title: 'ELOquence',
    description: 'The Chess.com of Wordle',
    type: 'website',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ELOquence',
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${libreFranklin.variable} ${robotoSlab.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-[100dvh] text-text-primary antialiased bg-bg-base">
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            if(localStorage.getItem('eloquence_colorblind')==='true')document.documentElement.classList.add('colorblind');
            if(localStorage.getItem('eloquence_reduced_motion')==='true')document.documentElement.classList.add('reduce-motion');
            if(localStorage.getItem('eloquence_theme')==='dark')document.documentElement.setAttribute('data-theme','dark');
            if(localStorage.getItem('eloquence_keyboard_only')==='true')document.documentElement.setAttribute('data-keyboard-only','true');
          })();
        `}} />
        <AuthProvider>
          <Navigation />
          <AnnouncementBanner />
          <main className="relative z-10">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
