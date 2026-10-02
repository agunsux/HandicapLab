// Centralized Provider Configuration — Single Source of Truth for API Keys & Endpoints
// Location: src/lib/data/providers/core/config.ts
// No process.env reads outside this file.

export enum SupportedMarket {
  MONEYLINE = 'h2h',
  ASIAN_HANDICAP = 'spreads',
  OVER_UNDER = 'totals',
  BTTS = 'btts',
}

export enum SharpBookmaker {
  PINNACLE = 'pinnacle',
  CIRCA = 'circasports',
  SBOBET = 'sbobet',
}

export interface ProviderApiConfig {
  theStatsApi: {
    baseUrl: string;
    apiKey: string;
    rateLimitRequests: number;
    rateLimitWindowMs: number;
  };
  oddsPapi: {
    baseUrl: string;
    apiKey: string;
    rateLimitRequests: number;
    rateLimitWindowMs: number;
  };
  apiFootball: {
    baseUrl: string;
    apiKey: string;
    rateLimitRequests: number;
    rateLimitWindowMs: number;
  };
}

import { validateCredential } from '../../../auth/credentialValidator';
import { getApiFootballKey } from '../../../providers/providerKey';

const DEFAULT_CONFIG: ProviderApiConfig = {
  theStatsApi: {
    baseUrl: 'https://api.thestatsapi.com/v1', // Update to correct Base URL if needed
    apiKey: '',
    rateLimitRequests: 60,
    rateLimitWindowMs: 60_000,
  },
  oddsPapi: {
    baseUrl: 'https://api.oddspapi.io/v4',
    apiKey: '',
    rateLimitRequests: 30,
    rateLimitWindowMs: 60_000,
  },
  apiFootball: {
    baseUrl: 'https://v3.football.api-sports.io',
    apiKey: '',
    rateLimitRequests: 10,
    rateLimitWindowMs: 60_000,
  },
};

/**
 * Credentials are resolved LAZILY (per call), never captured at module
 * evaluation time.
 *
 * Rationale: ESM hoists `import` statements above top-level statements, so a CLI
 * bootstrap that calls `dotenv.config()` before importing a service still has
 * that service's module graph evaluated FIRST. Capturing `process.env` at module
 * scope therefore produced a spurious "[FAIL CLOSED] Missing credential" for
 * every CLI entry point (live pipelines, research probes) even with a valid
 * `.env.local`. Resolving per call is strictly more permissive and cannot mask a
 * genuinely absent credential — `validateCredential` still fails closed.
 */
function resolveApiKeys(): { theStatsApi: string; oddsPapi: string; apiFootball: string } {
  return {
    theStatsApi: (process.env.THESTATS_API_KEY || '').trim(),
    oddsPapi: (process.env.ODDS_PAPI_KEY || '').trim(),
    apiFootball: getApiFootballKey(),
  };
}

const providerConfig: ProviderApiConfig = {
  theStatsApi: { ...DEFAULT_CONFIG.theStatsApi },
  oddsPapi: { ...DEFAULT_CONFIG.oddsPapi },
  apiFootball: { ...DEFAULT_CONFIG.apiFootball },
};

/** Keys explicitly pinned via setProviderConfig (test/runtime seam). */
const pinnedKeys: { theStatsApi?: string; oddsPapi?: string; apiFootball?: string } = {};

export function getProviderConfig(): ProviderApiConfig {
  const keys = resolveApiKeys();
  providerConfig.apiFootball.apiKey = pinnedKeys.apiFootball ?? keys.apiFootball;
  providerConfig.oddsPapi.apiKey = pinnedKeys.oddsPapi ?? keys.oddsPapi;
  providerConfig.theStatsApi.apiKey = pinnedKeys.theStatsApi ?? keys.theStatsApi;

  // Validate credentials on access
  providerConfig.apiFootball.apiKey = validateCredential('APIFOOTBALL_KEY', providerConfig.apiFootball.apiKey);
  providerConfig.oddsPapi.apiKey = validateCredential('ODDS_PAPI_KEY', providerConfig.oddsPapi.apiKey);

  return providerConfig;
}

export function setProviderConfig(overrides: Partial<ProviderApiConfig>): void {
  for (const key of ['theStatsApi', 'oddsPapi', 'apiFootball'] as const) {
    const patch = overrides[key];
    if (!patch) continue;
    providerConfig[key] = { ...providerConfig[key], ...patch };
    if (patch.apiKey !== undefined) pinnedKeys[key] = patch.apiKey;
  }
}

export function validateProviderConfig(): string[] {
  const missing: string[] = [];
  if (!providerConfig.theStatsApi.apiKey) missing.push('THESTATS_API_KEY');
  if (!providerConfig.oddsPapi.apiKey) missing.push('ODDS_PAPI_KEY');
  if (!providerConfig.apiFootball.apiKey) missing.push('APIFOOTBALL_KEY');
  return missing;
}
