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
  // Primary markets
  asianHandicap: '/asian-handicap',
  overUnder: '/over-under',
  btts: '/btts',
  trackRecord: '/track-record',
  // Supporting & legacy routes
  predictions: '/predictions',
  models: '/models',
  methodology: '/methodology',
  pricing: '/pricing',
  blog: '/blog',
  trustCenter: '/trust-center',
  validation: '/validation',
  dashboard: '/app/dashboard',
  profile: '/app/profile',
  valueBets: '/asian-handicap',
  markets: '/asian-handicap',
} as const;

export const PRIMARY_NAV = [
  { label: 'Asian Handicap', href: ROUTES.asianHandicap, shortLabel: 'AH' },
  { label: 'Over / Under', href: ROUTES.overUnder, shortLabel: 'O/U' },
  { label: 'BTTS', href: ROUTES.btts, shortLabel: 'BTTS' },
  { label: 'Track Record', href: ROUTES.trackRecord, shortLabel: 'Track Record' },
];

export const APP_SIDEBAR_NAV = [
  { label: 'Asian Handicap', href: ROUTES.asianHandicap },
  { label: 'Over / Under', href: ROUTES.overUnder },
  { label: 'BTTS', href: ROUTES.btts },
  { label: 'Track Record', href: ROUTES.trackRecord },
  { label: 'Dashboard', href: ROUTES.dashboard },
];

export const FOOTER_NAV: Record<string, { label: string; href: string }[]> = {
  product: [
    { label: 'Asian Handicap', href: ROUTES.asianHandicap },
    { label: 'Over / Under', href: ROUTES.overUnder },
    { label: 'BTTS', href: ROUTES.btts },
    { label: 'Track Record', href: ROUTES.trackRecord },
  ],
  resources: [
    { label: 'Methodology', href: ROUTES.methodology },
    { label: 'Models', href: ROUTES.models },
    { label: 'Validation', href: ROUTES.validation },
    { label: 'Trust Center', href: ROUTES.trustCenter },
  ],
  company: []
};
