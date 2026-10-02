// API-Football credential resolution
// Location: src/lib/providers/providerKey.ts
//
// Canonical production variable: `APIFOOTBALL_KEY` (server-only).
//
// Backward compatibility: `API_FOOTBALL_KEY` is still accepted as a legacy
// alias during migration because existing environments, scripts and tests set
// it. It is intentionally retained — removing it outright would break those
// callers. New code MUST read the key through this module only, so the alias is
// handled in exactly one place and can be removed once every environment and
// script has migrated. The value is never logged or exported.

export const CANONICAL_APIFOOTBALL_KEY_VAR = 'APIFOOTBALL_KEY';
export const LEGACY_APIFOOTBALL_KEY_VAR = 'API_FOOTBALL_KEY';

export type ApiFootballKeySource = 'APIFOOTBALL_KEY' | 'API_FOOTBALL_KEY' | 'MISSING';

/** Resolve the API-Football key (canonical first, legacy fallback). Never logs the value. */
export function getApiFootballKey(): string {
  const canonical = process.env.APIFOOTBALL_KEY;
  if (canonical && canonical.trim()) return canonical;

  const legacy = process.env.API_FOOTBALL_KEY;
  if (legacy && legacy.trim()) return legacy;

  return '';
}

/** Secret-free description of where the key came from (safe for logs/health). */
export function getApiFootballKeySource(): ApiFootballKeySource {
  const canonical = process.env.APIFOOTBALL_KEY;
  if (canonical && canonical.trim()) return 'APIFOOTBALL_KEY';
  const legacy = process.env.API_FOOTBALL_KEY;
  if (legacy && legacy.trim()) return 'API_FOOTBALL_KEY';
  return 'MISSING';
}

export function hasApiFootballKey(): boolean {
  return getApiFootballKey().length > 0;
}

// ----------------------------------------------------------------------------
// The Odds API credential resolution (canonical: ODDS_API_KEY, fallback: THE_ODDS_API_KEY)
// ----------------------------------------------------------------------------
export const CANONICAL_ODDS_API_KEY_VAR = 'ODDS_API_KEY';
export const LEGACY_ODDS_API_KEY_VAR = 'THE_ODDS_API_KEY';

export type OddsApiKeySource = 'ODDS_API_KEY' | 'THE_ODDS_API_KEY' | 'MISSING';

/** Resolve The Odds API key (canonical first, legacy fallback). Never logs the value. */
export function getOddsApiKey(): string {
  const canonical = process.env.ODDS_API_KEY;
  if (canonical && canonical.trim() && !canonical.includes('[SENSITIVE]')) return canonical.trim();

  const legacy = process.env.THE_ODDS_API_KEY;
  if (legacy && legacy.trim() && !legacy.includes('[SENSITIVE]')) return legacy.trim();

  return '';
}

/** Secret-free description of where the key came from (safe for logs/health). */
export function getOddsApiKeySource(): OddsApiKeySource {
  const canonical = process.env.ODDS_API_KEY;
  if (canonical && canonical.trim() && !canonical.includes('[SENSITIVE]')) return 'ODDS_API_KEY';
  const legacy = process.env.THE_ODDS_API_KEY;
  if (legacy && legacy.trim() && !legacy.includes('[SENSITIVE]')) return 'THE_ODDS_API_KEY';
  return 'MISSING';
}

export function hasOddsApiKey(): boolean {
  return getOddsApiKey().length > 0;
}
