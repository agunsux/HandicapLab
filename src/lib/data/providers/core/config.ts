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

const DEFAULT_CONFIG: ProviderApiConfig = {
  theStatsApi: {
    baseUrl: 'https://api.thestatsapi.com/v1', // Update to correct Base URL if needed
    apiKey: process.env.THESTATS_API_KEY || '',
    rateLimitRequests: 60,
    rateLimitWindowMs: 60_000,
  },
  oddsPapi: {
    baseUrl: 'https://api.oddspapi.io/v4',
    apiKey: process.env.ODDS_PAPI_KEY || '',
    rateLimitRequests: 30,
    rateLimitWindowMs: 60_000,
  },
  apiFootball: {
    baseUrl: 'https://v3.football.api-sports.io',
    apiKey: process.env.APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY || '',
    rateLimitRequests: 10,
    rateLimitWindowMs: 60_000,
  },
};

let providerConfig: ProviderApiConfig = { ...DEFAULT_CONFIG };

export function getProviderConfig(): ProviderApiConfig {
  // Validate credentials on first access
  providerConfig.apiFootball.apiKey = validateCredential('APIFOOTBALL_KEY', providerConfig.apiFootball.apiKey);
  providerConfig.oddsPapi.apiKey = validateCredential('ODDS_PAPI_KEY', providerConfig.oddsPapi.apiKey);
  // Optionally validate theStatsApi if it's strictly required for provenance. 
  // We'll leave it out of strict provenance validation for now unless requested.
  
  return providerConfig;
}

export function setProviderConfig(overrides: Partial<ProviderApiConfig>): void {
  providerConfig = {
    theStatsApi: { ...providerConfig.theStatsApi, ...overrides.theStatsApi },
    oddsPapi: { ...providerConfig.oddsPapi, ...overrides.oddsPapi },
    apiFootball: { ...providerConfig.apiFootball, ...overrides.apiFootball },
  };
}

export function validateProviderConfig(): string[] {
  const missing: string[] = [];
  if (!providerConfig.theStatsApi.apiKey) missing.push('THESTATS_API_KEY');
  if (!providerConfig.oddsPapi.apiKey) missing.push('ODDS_PAPI_KEY');
  if (!providerConfig.apiFootball.apiKey) missing.push('APIFOOTBALL_KEY');
  return missing;
}
