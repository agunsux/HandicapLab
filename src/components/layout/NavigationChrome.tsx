'use client';

import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { Footer } from './Footer';

/**
 * Conditionally renders the marketing header/footer chrome.
 * The terminal UI under /app has its own chrome and must not be
 * polluted by the marketing navigation.
 */
export function NavigationChrome() {
  const pathname = usePathname();
  const isTerminal = pathname.startsWith('/app');

  if (isTerminal) {
    return null;
  }

  return (
    <>
      <Header />
      <Footer />
    </>
  );
}