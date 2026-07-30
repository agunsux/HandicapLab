import type { Metadata } from 'next';
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

const sansFont = Space_Grotesk({
  variable: '--font-sans',
  subsets: ['latin'],
});

const monoFont = IBM_Plex_Mono({
  variable: '--font-mono',
  weight: ['400', '500', '600'],
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'HandicapLab | Verified Football Predictions',
  description:
    'Verified profitable betting intelligence backed by long-term historical evidence. Transparent track record, Pinnacle closing line value, and continuously verified predictions.',
  keywords: 'verified betting predictions, football picks, ROI tracked, closing line value, Pinnacle odds, historical validation, profitable betting',
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
