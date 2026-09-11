/**
 * Canonical Navigation Configuration
 * 
 * Defines the single source of truth for all routes in HandicapLab.dev.
 * Routes not listed here, or routes that are missing an underlying
 * Next.js page, should not be displayed in the UI.
 * 
 * HandicapLab.dev = Football Data & Statistics platform.
 * Salmo.dev = Sports Betting Intelligence (separate brand, downstream product).
 */

export const ROUTES = {
  // Primary data navigation
  home: '/',
  leagues: '/competitions',
  statistics: '/asian-handicap',
  // Market statistics
  asianHandicap: '/asian-handicap',
  overUnder: '/over-under',
  btts: '/btts',
  historical: '/historical',
  trackRecord: '/track-record',
  // Supporting & legacy routes
  predictions: '/predictions',
  models: '/models',
  methodology: '/methodology',
  documentation: '/documentation',
  pricing: '/pricing',
  blog: '/blog',
  trustCenter: '/trust-center',
  validation: '/validation',
  dashboard: '/app/dashboard',
  profile: '/app/profile',
  premierLeagueAhResearch: '/premier-league/ah-research',
  // Legacy aliases
  valueBets: '/asian-handicap',
  markets: '/asian-handicap',
} as const;

/** Primary navigation — data-first structure */
export const PRIMARY_NAV = [
  { label: 'Matches', href: '/#upcoming-matches', shortLabel: 'Matches' },
  { label: 'Leagues', href: ROUTES.leagues, shortLabel: 'Leagues' },
  { label: 'Statistics', href: ROUTES.statistics, shortLabel: 'Stats' },
  { label: 'Historical', href: ROUTES.historical, shortLabel: 'History' },
  { label: 'Research', href: ROUTES.methodology, shortLabel: 'Research' },
];

/** Statistics sub-navigation — surfaced as the desktop dropdown for `Statistics` */
export const STATISTICS_SUB_NAV = [
  { label: 'Asian Handicap', href: ROUTES.asianHandicap },
  { label: 'Over / Under', href: ROUTES.overUnder },
  { label: 'BTTS', href: ROUTES.btts },
];

export const APP_SIDEBAR_NAV = [
  { label: 'Asian Handicap', href: ROUTES.asianHandicap },
  { label: 'Over / Under', href: ROUTES.overUnder },
  { label: 'BTTS', href: ROUTES.btts },
  { label: 'Track Record', href: ROUTES.trackRecord },
  { label: 'Dashboard', href: ROUTES.dashboard },
];

export const FOOTER_NAV: Record<string, { label: string; href: string }[]> = {
  data: [
    { label: 'Matches', href: '/#upcoming-matches' },
    { label: 'Leagues', href: ROUTES.leagues },
    { label: 'Historical', href: ROUTES.historical },
    { label: 'Track Record', href: ROUTES.trackRecord },
  ],
  statistics: [
    { label: 'Asian Handicap', href: ROUTES.asianHandicap },
    { label: 'Over / Under', href: ROUTES.overUnder },
    { label: 'BTTS', href: ROUTES.btts },
  ],
  resources: [
    { label: 'Methodology', href: ROUTES.methodology },
    { label: 'Models', href: ROUTES.models },
    { label: 'Validation', href: ROUTES.validation },
    { label: 'Trust Center', href: ROUTES.trustCenter },
  ],
  company: [
    { label: 'Pricing', href: ROUTES.pricing },
    { label: 'Blog', href: ROUTES.blog },
    { label: 'Documentation', href: ROUTES.documentation },
    { label: 'PL AH Research', href: ROUTES.premierLeagueAhResearch },
  ],
};
