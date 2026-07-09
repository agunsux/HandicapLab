// API-Football HTTP Client — Preconfigured HttpClient for API-Football
// Location: src/lib/data/providers/apiFootball/client.ts
// API-Football base: https://v3.football.api-sports.io
// Rate limit: 100 requests/day on free tier, 10 requests/minute

import { HttpClient, RateLimiter, CircuitBreaker, Cache } from '@/lib/http';
import { getProviderConfig } from '../core/config';

export function createApiFootballClient(): HttpClient {
  const config = getProviderConfig().apiFootball;
  const rateLimiter = new RateLimiter({
    maxRequests: config.rateLimitRequests,
    windowMs: config.rateLimitWindowMs,
    provider: 'api-football',
  });
  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    cooldownMs: 60_000,
    halfOpenSuccessThreshold: 2,
    provider: 'api-football',
  });
  const cache = new Cache({
    defaultTtlMs: 30_000,
    maxEntries: 200,
    provider: 'api-football',
  });

  return new HttpClient(
    {
      baseUrl: config.baseUrl,
      defaultHeaders: {
        'x-rapidapi-key': config.apiKey,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
      defaultTimeoutMs: 15_000,
      defaultRetries: 2,
      provider: 'api-football',
    },
    rateLimiter,
    circuitBreaker,
    cache
  );
}
