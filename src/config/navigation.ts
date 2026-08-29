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
  // Terminal routes
  predictions: '/predictions',
  trackRecord: '/track-record',
  models: '/models',
  methodology: '/methodology',
  pricing: '/pricing',
  blog: '/blog',
  trustCenter: '/trust-center',
  validation: '/validation',
  dashboard: '/app/dashboard',
  valueBets: '/predictions',
  markets: '/predictions',
} as const;

export const PRIMARY_NAV = [
  { label: 'Predictions', href: ROUTES.predictions },
  { label: 'Track Record', href: ROUTES.trackRecord },
  { label: 'Models', href: ROUTES.models },
  { label: 'Methodology', href: ROUTES.methodology },
];

export const APP_SIDEBAR_NAV = [
  { label: 'Predictions', href: ROUTES.predictions },
  { label: 'Track Record', href: ROUTES.trackRecord },
];

export const FOOTER_NAV: Record<string, { label: string; href: string }[]> = {
  product: [
    { label: 'Predictions', href: ROUTES.predictions },
    { label: 'Track Record', href: ROUTES.trackRecord },
    { label: 'Models', href: ROUTES.models },
    { label: 'Methodology', href: ROUTES.methodology },
  ],
  resources: [
    { label: 'Trust Center', href: ROUTES.trustCenter },
    { label: 'Validation', href: ROUTES.validation },
  ],
  company: []
};
