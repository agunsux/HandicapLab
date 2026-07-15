// ============================================================================
// ODDS INGESTION  (Epic 31A — Section A)
// ============================================================================
// Provider-agnostic odds ingestion with retry, rate limiting and failover.
// This module EXTENDS the existing odds pipeline (odds_snapshots / provider_logs
// / provider_payloads) — it does not rewrite it. The DB write path is injected so
// the retry/rate-limit/failover logic is fully unit-testable without a database.
//
// Contract:
//   - provider latency is recorded per tick (odds_snapshots.provider_latency_ms)
//   - every HTTP attempt is logged to provider_logs (append-only)
//   - on exhaustion of retries for a provider, fail over to the next provider
// ============================================================================

import type { OddsTick } from './types';

export interface IngestionPolicy {
  maxRetries: number; // attempts per provider (excluding the first)
  baseBackoffMs: number; // exponential backoff base
  rateLimitPerSec: number; // max fetches per second across all providers
  failoverOrder: string[]; // provider names, tried in order
}

export const DEFAULT_POLICY: IngestionPolicy = {
  maxRetries: 3,
  baseBackoffMs: 250,
  rateLimitPerSec: 5,
  failoverOrder: [],
};

export interface ProviderFetcher {
  provider: string;
  fetch: () => Promise<OddsTick[]>;
}

export interface ProviderLogEntry {
  provider: string;
  endpoint: string;
  method: string;
  statusCode: number | null;
  durationMs: number;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  metadata?: Record<string, unknown>;
}

// Injected persistence surface (implemented by the DB layer in production).
export interface OddsWriter {
  writeTicks: (ticks: OddsTick[]) => Promise<void>;
  logProvider: (entry: ProviderLogEntry) => Promise<void>;
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  constructor(private ratePerSec: number) {
    this.tokens = ratePerSec;
    this.lastRefill = Date.now();
  }
  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.ratePerSec, this.tokens + elapsed * this.ratePerSec);
    this.lastRefill = now;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = ((1 - this.tokens) / this.ratePerSec) * 1000;
    await new Promise((r) => setTimeout(r, waitMs));
    this.tokens = Math.max(0, this.tokens - 1);
    this.lastRefill = Date.now();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Attempt a single provider with retry + exponential backoff.
// isRetryable(err) decides whether a retry makes sense (e.g. network/5xx/429).
export async function fetchWithRetry(
  fetcher: ProviderFetcher,
  policy: IngestionPolicy,
  isRetryable: (err: unknown) => boolean,
  onAttempt?: (attempt: number, err: unknown | null) => void
): Promise<OddsTick[]> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    try {
      const ticks = await fetcher.fetch();
      onAttempt?.(attempt, null);
      return ticks;
    } catch (err) {
      lastErr = err;
      onAttempt?.(attempt, err);
      if (attempt < policy.maxRetries && isRetryable(err)) {
        await sleep(policy.baseBackoffMs * Math.pow(2, attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// Orchestrate ingestion across providers with failover.
// Returns the ticks from the first provider that succeeds; logs every attempt.
export async function ingestOdds(
  fetchers: ProviderFetcher[],
  writer: OddsWriter,
  policy: IngestionPolicy = DEFAULT_POLICY,
  isRetryable: (err: unknown) => boolean = () => true
): Promise<{ provider: string; ticks: OddsTick[] }> {
  const limiter = new RateLimiter(policy.rateLimitPerSec);

  // Order fetchers by the configured failover priority when provided.
  const ordered = policy.failoverOrder.length
    ? [...fetchers].sort(
        (a, b) =>
          policy.failoverOrder.indexOf(a.provider) - policy.failoverOrder.indexOf(b.provider)
      )
    : fetchers;

  let lastErr: unknown = null;
  for (const fetcher of ordered) {
    await limiter.acquire();
    const started = Date.now();
    try {
      const ticks = await fetchWithRetry(fetcher, policy, isRetryable, (attempt, err) => {
        if (err) {
          writer.logProvider({
            provider: fetcher.provider,
            endpoint: 'odds',
            method: 'GET',
            statusCode: null,
            durationMs: Date.now() - started,
            level: attempt < policy.maxRetries ? 'WARN' : 'ERROR',
            message: `Attempt ${attempt + 1} failed: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      });
      await writer.logProvider({
        provider: fetcher.provider,
        endpoint: 'odds',
        method: 'GET',
        statusCode: 200,
        durationMs: Date.now() - started,
        level: 'INFO',
        message: `Ingested ${ticks.length} ticks`,
      });
      // Stamp provider latency on each tick when measurable.
      const latency = Date.now() - started;
      const stamped = ticks.map((t) => ({ ...t, providerLatencyMs: t.providerLatencyMs ?? latency }));
      await writer.writeTicks(stamped);
      return { provider: fetcher.provider, ticks: stamped };
    } catch (err) {
      lastErr = err;
      // fall through to next provider (failover)
    }
  }
  throw new Error(
    `All providers failed: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`
  );
}
