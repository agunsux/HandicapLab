// Centralized Provider Configuration — Single Source of Truth for API Keys & Endpoints
// Location: src/lib/data/providers/core/config.ts
// No process.env reads outside this file.

export interface ProviderApiConfig {
  apiFootball: {
    baseUrl: string;
    apiKey: string;
    rateLimitRequests: number;
    rateLimitWindowMs: number;
  };
  theOddsApi: {
    baseUrl: string;
    apiKey: string;
    rateLimitRequests: number;
    rateLimitWindowMs: number;
  };
}

const DEFAULT_CONFIG: ProviderApiConfig = {
  apiFootball: {
    baseUrl: 'https://v3.football.api-sports.io',
    apiKey: process.env.API_FOOTBALL_KEY ?? '',
    rateLimitRequests: 10,
    rateLimitWindowMs: 60_000,
  },
  theOddsApi: {
    baseUrl: 'https://api.the-odds-api.com/v4',
    apiKey: process.env.THE_ODDS_API_KEY ?? process.env.ODDSPAPI_KEY ?? '',
    rateLimitRequests: 30,
    rateLimitWindowMs: 60_000,
  },
};

let providerConfig: ProviderApiConfig = { ...DEFAULT_CONFIG };

export function getProviderConfig(): ProviderApiConfig {
  return providerConfig;
}

export function setProviderConfig(overrides: Partial<ProviderApiConfig>): void {
  providerConfig = {
    apiFootball: { ...providerConfig.apiFootball, ...overrides.apiFootball },
    theOddsApi: { ...providerConfig.theOddsApi, ...overrides.theOddsApi },
  };
}

export function validateProviderConfig(): string[] {
  const missing: string[] = [];
  if (!providerConfig.apiFootball.apiKey) missing.push('API_FOOTBALL_KEY');
  if (!providerConfig.theOddsApi.apiKey) missing.push('THE_ODDS_API_KEY / ODDSPAPI_KEY');
  return missing;
}
