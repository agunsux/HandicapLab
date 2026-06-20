import type { Metadata } from 'next';
import { Outfit, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sansFont = Outfit({
  variable: '--font-sans',
  subsets: ['latin'],
});

const monoFont = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'HandicapLab | Football Market Analytics & Probability Intelligence',
  description:
    'Global football market analytics platform focused on Asian Handicap, Over/Under Total Goals, and Moneyline value edge detection.',
  keywords: 'Football analytics, Asian Handicap, Over/Under, Moneyline odds, value bets, betting edge, Poisson distribution model',
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
      <body className="h-full bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-400">
        {children}
      </body>
    </html>
  );
}
