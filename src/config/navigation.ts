/**
 * Canonical Navigation Configuration
 * 
 * Defines the single source of truth for all routes in HandicapLab.
 * Routes not listed here, or routes that are missing an underlying
 * Next.js page, should not be displayed in the UI.
 * 
 * - Privacy, Terms, About, Responsible Gambling are excluded as they are NOT WIRED.
 */

export const ROUTES = {
  // App routes
  dashboard: '/app/dashboard',
  valueBets: '/app/value-bets',
  markets: '/app/markets',
  profile: '/app/profile',
  settings: '/app/settings',
  
  // Marketing & Informational
  trackRecord: '/track-record',
  methodology: '/methodology',
  pricing: '/pricing',
  blog: '/blog',
  trustCenter: '/trust-center',
  validation: '/validation',
} as const;

export const PRIMARY_NAV = [
  { label: 'Value Bets', href: ROUTES.valueBets },
  { label: 'Markets', href: ROUTES.markets },
  { label: 'Track Record', href: ROUTES.trackRecord },
  { label: 'Methodology', href: ROUTES.methodology },
];

export const APP_SIDEBAR_NAV = [
  { label: 'Dashboard', href: ROUTES.dashboard },
  { label: "Today's Signals", href: ROUTES.valueBets },
];

export const FOOTER_NAV: Record<string, { label: string; href: string }[]> = {
  product: [
    { label: 'Value Bets', href: ROUTES.valueBets },
    { label: 'Markets', href: ROUTES.markets },
    { label: 'Track Record', href: ROUTES.trackRecord },
    { label: 'Methodology', href: ROUTES.methodology },
    { label: 'Pricing', href: ROUTES.pricing },
  ],
  resources: [
    { label: 'Blog', href: ROUTES.blog },
    { label: 'Trust Center', href: ROUTES.trustCenter },
    { label: 'Validation', href: ROUTES.validation },
  ],
  company: [
    // Excluded /about, /terms, /privacy, /responsible-gambling because they are not wired.
  ]
};
