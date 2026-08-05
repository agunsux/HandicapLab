'use client';

import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { Footer } from './Footer';

/**
 * Renders the marketing Header conditionally for non-/app routes.
 */
export function MarketingHeader() {
  const pathname = usePathname();
  if (pathname.startsWith('/app')) return null;
  return <Header />;
}

/**
 * Renders the marketing Footer conditionally for non-/app routes.
 */
export function MarketingFooter() {
  const pathname = usePathname();
  if (pathname.startsWith('/app')) return null;
  return <Footer />;
}

/**
 * Legacy NavigationChrome wrapper kept for backwards compatibility.
 */
export function NavigationChrome() {
  return (
    <>
      <MarketingHeader />
      <MarketingFooter />
    </>
  );
}