import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/hooks/useAuth';
import Navigation from '@/components/Navigation';
import AnnouncementBanner from '@/components/AnnouncementBanner';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ELOquence — The Chess.com of Wordle',
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
  themeColor: '#09090b',
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
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-bg-base min-h-[100dvh] text-text-primary antialiased">
        <script dangerouslySetInnerHTML={{ __html: `
          if(localStorage.getItem('eloquence_colorblind')==='true')document.documentElement.classList.add('colorblind');
          if(localStorage.getItem('eloquence_reduced_motion')==='true')document.documentElement.classList.add('reduce-motion');
        `}} />
        <AuthProvider>
          <Navigation />
          <AnnouncementBanner />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
