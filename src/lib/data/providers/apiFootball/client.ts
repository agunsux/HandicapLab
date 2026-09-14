// API-Football HTTP Client — routed through the canonical Provider Gateway.
// Location: src/lib/data/providers/apiFootball/client.ts
// API-Football base: https://v3.football.api-sports.io
//
// This client no longer performs its own fetch/rate-limit/cache/quota. All
// provider traffic is issued via `globalGateway` so quota reservation,
// deduplication, rate limiting, circuit breaking and audit logging happen in
// exactly one place. Local caching/limiting here would create a second,
// competing control system.

import { HttpClient } from '@/lib/http';
import { getProviderConfig } from '../core/config';
import { globalGateway } from '@/lib/providers/providerGateway';

function endpointFromUrl(rawUrl: string): string {
  try {
    return new URL(rawUrl).pathname.replace(/^\/+/, '') || 'root';
  } catch {
    return 'unknown';
  }
}

export function createApiFootballClient(): HttpClient {
  const config = getProviderConfig().apiFootball;

  return new HttpClient(
    {
      baseUrl: config.baseUrl,
      defaultHeaders: {
        'x-apisports-key': config.apiKey,
        'Accept': 'application/json',
      },
      defaultTimeoutMs: 15_000,
      defaultRetries: 2,
      provider: 'api-football',
      fetchImpl: (url, init) =>
        globalGateway.fetch('apifootball', endpointFromUrl(url), url, {
          method: init.method,
          headers: init.headers as HeadersInit,
          body: init.body as BodyInit | undefined,
          signal: init.signal ?? undefined,
          // Fixture/team retrieval for closing-line capture is P1 work.
          quotaPriority: 80,
        }),
    }
  );
}
