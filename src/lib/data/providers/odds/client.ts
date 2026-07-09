// The Odds API HTTP Client — Preconfigured HttpClient for The Odds API
// Location: src/lib/data/providers/odds/client.ts
// Base: https://api.the-odds-api.com/v4
// Rate limit: 30 requests/minute on basic plan

import { HttpClient, RateLimiter, CircuitBreaker, Cache } from '@/lib/http';
import { getProviderConfig } from '../core/config';

export function createOddsApiClient(): HttpClient {
  const config = getProviderConfig().theOddsApi;
  const rateLimiter = new RateLimiter({
    maxRequests: config.rateLimitRequests,
    windowMs: config.rateLimitWindowMs,
    provider: 'the-odds-api',
  });
  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    cooldownMs: 60_000,
    halfOpenSuccessThreshold: 2,
    provider: 'the-odds-api',
  });
  const cache = new Cache({
    defaultTtlMs: 30_000,
    maxEntries: 200,
    provider: 'the-odds-api',
  });

  return new HttpClient(
    {
      baseUrl: config.baseUrl,
      defaultTimeoutMs: 15_000,
      defaultRetries: 2,
      provider: 'the-odds-api',
    },
    rateLimiter,
    circuitBreaker,
    cache
  );
}
