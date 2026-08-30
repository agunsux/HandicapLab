// HandicapLab Canonical Market Definition & Normalization Layer (EPIC 61)
// Scope: Asian Handicap (AH), Over/Under (OU), Both Teams To Score (BTTS)
// Moneyline / 1X2 is strictly removed from production scope.

export type CanonicalMarket = 'AH' | 'OU' | 'BTTS';

export const CANONICAL_MARKETS: readonly CanonicalMarket[] = ['AH', 'OU', 'BTTS'] as const;

export const MARKET_LABELS: Record<CanonicalMarket, string> = {
  AH: 'Asian Handicap',
  OU: 'Over / Under',
  BTTS: 'Both Teams To Score',
};

export const MARKET_DESCRIPTIONS: Record<CanonicalMarket, string> = {
  AH: 'Quarter, half, and integer spread lines evaluated against Pinnacle closing lines.',
  OU: 'Goal totals benchmarked against fundamental Poisson probability matrices.',
  BTTS: 'Both Teams To Score binary propositions derived from bivariate goal distributions.',
};

/**
 * Normalizes any incoming market representation to CanonicalMarket ('AH' | 'OU' | 'BTTS').
 * Returns null if the market is Moneyline (1X2) or unsupported.
 */
export function normalizeToCanonicalMarket(rawMarket: string | null | undefined): CanonicalMarket | null {
  if (!rawMarket || typeof rawMarket !== 'string') return null;

  const clean = rawMarket.trim().toUpperCase().replace(/[-_ \/]/g, '');

  if (
    clean === 'AH' ||
    clean === 'ASIANHANDICAP' ||
    clean === 'HANDICAP' ||
    clean === 'ASIAN' ||
    clean === 'ASIAN_HANDICAP'
  ) {
    return 'AH';
  }

  if (
    clean === 'OU' ||
    clean === 'OVERUNDER' ||
    clean === 'TOTALS' ||
    clean === 'ASIANTOTAL' ||
    clean === 'TOTAL' ||
    clean === 'OVER_UNDER'
  ) {
    return 'OU';
  }

  if (
    clean === 'BTTS' ||
    clean === 'BOTHTEAMSTOSCORE' ||
    clean === 'BOTH_TEAMS_TO_SCORE' ||
    clean === 'GG' ||
    clean === 'GOALGOAL'
  ) {
    return 'BTTS';
  }

  // Explicitly reject Moneyline / 1X2 / ML / Match Winner / Outrights
  return null;
}

/**
 * Validates whether a market string is supported in production.
 */
export function isProductionMarketSupported(rawMarket: string | null | undefined): boolean {
  return normalizeToCanonicalMarket(rawMarket) !== null;
}
