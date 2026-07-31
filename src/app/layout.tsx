import type { Metadata } from 'next';
import { Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

const sansFont = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

const monoFont = IBM_Plex_Mono({
  variable: '--font-mono',
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://handicaplab.com'),
  title: {
    default: 'HandicapLab | Football Market Intelligence',
    template: '%s | HandicapLab',
  },
  description:
    'Professional football market intelligence. Identify statistical inefficiencies and betting market edges with quantitative modeling, closing line value, and transparent historical validation.',
  keywords:
    'football market intelligence, betting edge, closing line value, CLV, expected value, EV, quantitative modeling, Asian handicap, value betting, sports analytics',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'HandicapLab',
    title: 'HandicapLab | Football Market Intelligence',
    description:
      'Professional football market intelligence. Identify statistical inefficiencies and betting market edges with quantitative modeling.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HandicapLab | Football Market Intelligence',
    description:
      'Professional football market intelligence. Identify statistical inefficiencies and betting market edges with quantitative modeling.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sansFont.variable} ${monoFont.variable} dark h-full antialiased`}
      style={{ colorScheme: 'dark' }}
    >
      <body className="h-full bg-background text-foreground flex flex-col font-sans selection:bg-[var(--accent)]/30 selection:text-accent-foreground min-h-screen">
        <Header />
        <main className="flex-1 flex flex-col">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
