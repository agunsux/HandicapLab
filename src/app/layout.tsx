import type { Metadata } from 'next';
import { Inter, Inter_Tight, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { MarketingHeader, MarketingFooter } from '@/components/layout/NavigationChrome';
import { Providers } from '@/components/providers/Providers';

const sansFont = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

const displayFont = Inter_Tight({
  variable: '--font-display',
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
  title: 'HandicapLab — Transparent Sports Analytics Research',
  description: 'Live model predictions with full transparency. Research terminal, not betting advice.',
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
      className={`${sansFont.variable} ${displayFont.variable} ${monoFont.variable} dark h-full antialiased`}
      style={{ colorScheme: 'dark' }}
    >
      <body className="h-full bg-background text-foreground flex flex-col font-sans selection:bg-accent/30 selection:text-accent-foreground min-h-screen">
        <Providers>
          <MarketingHeader />
          <main className="flex-1 flex flex-col">
            {children}
          </main>
          <MarketingFooter />
        </Providers>
      </body>
    </html>
  );
}
