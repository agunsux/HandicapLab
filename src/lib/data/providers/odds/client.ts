// OddsPAPI HTTP Client — Preconfigured HttpClient for OddsPAPI (oddspapi.com)
// Location: src/lib/data/providers/odds/client.ts
// Base: https://api.oddspapi.io/v4
// Rate limit: 30 requests/minute on basic plan

import { HttpClient, RateLimiter, CircuitBreaker, Cache } from '@/lib/http';
import { getProviderConfig } from '../core/config';

export function createOddsApiClient(): HttpClient {
  const config = getProviderConfig().oddsPapi;
  const rateLimiter = new RateLimiter({
    maxRequests: config.rateLimitRequests,
    windowMs: config.rateLimitWindowMs,
    provider: 'oddspapi',
  });
  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    cooldownMs: 60_000,
    halfOpenSuccessThreshold: 2,
    provider: 'oddspapi',
  });
  const cache = new Cache({
    defaultTtlMs: 30_000,
    maxEntries: 200,
    provider: 'oddspapi',
  });

  return new HttpClient(
    {
      baseUrl: config.baseUrl,
      defaultTimeoutMs: 15_000,
      defaultRetries: 2,
      provider: 'oddspapi',
      defaultQueryParams: {
        apiKey: config.apiKey,
      },
    },
    rateLimiter,
    circuitBreaker,
    cache
  );
}
