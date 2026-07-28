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
      <body className="h-full bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-400">
        {children}
      </body>
    </html>
  );
}
