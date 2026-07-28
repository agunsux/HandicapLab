// EPIC 53 — Central Quota Manager (v2)
// Single gate for ALL external API requests.
// Every call must go through QuotaManager.acquire() — no scattered quota checks.
//
// Architecture:
//   Scheduler → QuotaManager.acquire(provider, endpoint)
//               ↓
//               Checks quota → checks cost → reserves slot → logs → returns receipt
//
// API Cost Registry: each endpoint has a fixed "cost" so pricing changes
// are a single-file update, not a codebase-wide search.

import { supabase } from '@/lib/supabase.server';

// ─── API Cost Registry ──────────────────────────────────────────────
// Single source of truth for endpoint costs. If a provider changes pricing,
// update only this map — no need to search the codebase.

export type Provider = 'apifootball' | 'oddspapi';

export interface EndpointCost {
  provider: Provider;
  endpoint: string;
  cost: number; // 1 = one request
}

export const API_COST_REGISTRY: EndpointCost[] = [
  // API-Football endpoints
  { provider: 'apifootball', endpoint: 'fixtures',        cost: 1 },
  { provider: 'apifootball', endpoint: 'fixtures/historical', cost: 1 },
  { provider: 'apifootball', endpoint: 'fixtures/postmatch',  cost: 1 },
  { provider: 'apifootball', endpoint: 'injuries',        cost: 1 },
  { provider: 'apifootball', endpoint: 'lineups',         cost: 1 },
  { provider: 'apifootball', endpoint: 'venues',          cost: 1 },
  // OddsPapi endpoints
  { provider: 'oddspapi',    endpoint: 'odds',            cost: 1 },
];

function getCost(provider: Provider, endpoint: string): number {
  return API_COST_REGISTRY.find((e) => e.provider === provider && e.endpoint === endpoint)?.cost ?? 1;
}

// ─── Quota Limits ───────────────────────────────────────────────────

const PROVIDER_LIMITS: Record<Provider, number> = {
  apifootball: 100,
  oddspapi: 250,
};

// ─── Types ──────────────────────────────────────────────────────────

export interface AcquireReceipt {
  ok: boolean;
  reason: string;
  cost: number;
  provider: Provider;
  endpoint: string;
  quotaRemaining: number;
  quotaUsed: number;
  quotaPct: number;
}

export interface ProviderHealth {
  provider: Provider;
  healthy: boolean;
  quotaPct: number;
  quotaUsed: number;
  quotaLimit: number;
  quotaRemaining: number;
  avgLatencyMs: number;
  successRate: number;
  resetTime: string;
}

export type Priority = 'critical' | 'normal' | 'background';

// ─── Internals ──────────────────────────────────────────────────────

function getResetPeriod(provider: Provider): { startOf: Date } {
  const now = new Date();
  if (provider === 'apifootball') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return { startOf: start };
  }
  // oddspapi: calendar month
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { startOf: start };
}

async function loadQuotaData(provider: Provider): Promise<{ used: number; limit: number; startOf: Date }> {
  const { startOf } = getResetPeriod(provider);
  const limit = PROVIDER_LIMITS[provider];

  try {
    const { data, error } = await supabase
      .from('provider_logs')
      .select('id', { count: 'exact', head: true })
      .eq('provider', provider)
      .eq('level', 'INFO')
      .gte('created_at', startOf.toISOString());

    if (error) {
      console.warn(`[QuotaManager] Query error for ${provider}:`, error.message);
      return { used: 0, limit, startOf };
    }

    return { used: data?.length ?? 0, limit, startOf };
  } catch (err) {
    console.warn(`[QuotaManager] Error for ${provider}:`, err);
    return { used: 0, limit, startOf };
  }
}

// ─── Public API ─────────────────────────────────────────────────────

// THE single entry point for all external API calls.
// Returns a receipt — caller checks receipt.ok before proceeding.
// If ok=false, caller must NOT make the API call.
export async function acquire(
  provider: Provider,
  endpoint: string,
  priority: Priority = 'normal'
): Promise<AcquireReceipt> {
  const { used, limit, startOf } = await loadQuotaData(provider);
  const cost = getCost(provider, endpoint);
  const pct = limit > 0 ? (used / limit) * 100 : 0;

  // Hard block at 100%
  if (used >= limit) {
    return { ok: false, reason: `QUOTA_EXHAUSTED: ${provider} ${used}/${limit}`, cost, provider, endpoint, quotaRemaining: 0, quotaUsed: used, quotaPct: Math.round(pct * 100) / 100 };
  }

  // Background pauses at 75%
  if (priority === 'background' && pct >= 75) {
    return { ok: false, reason: `BACKGROUND_PAUSED: ${provider} at ${pct.toFixed(1)}%`, cost, provider, endpoint, quotaRemaining: limit - used, quotaUsed: used, quotaPct: Math.round(pct * 100) / 100 };
  }

  // Normal pauses at 90%
  if (priority === 'normal' && pct >= 90) {
    return { ok: false, reason: `NORMAL_PAUSED: ${provider} at ${pct.toFixed(1)}%`, cost, provider, endpoint, quotaRemaining: limit - used, quotaUsed: used, quotaPct: Math.round(pct * 100) / 100 };
  }

  // Also check if cost would exceed limit
  if (used + cost > limit) {
    return { ok: false, reason: `INSUFFICIENT: ${provider} needs ${cost} but only ${limit - used} remaining`, cost, provider, endpoint, quotaRemaining: limit - used, quotaUsed: used, quotaPct: Math.round(pct * 100) / 100 };
  }

  // Reserve: log immediately so concurrent calls see consumed quota
  // (fire-and-forget — caller also logs after the actual call with real duration)
  void supabase.from('provider_logs').insert({
    provider,
    endpoint,
    method: 'QUOTA_RESERVATION',
    status_code: 0,
    duration_ms: 0,
    level: 'INFO',
    message: `Quota reserved: ${endpoint} (cost=${cost}, priority=${priority})`,
    metadata: { cost, priority, reserved: true },
  });

  return {
    ok: true, reason: 'ok', cost, provider, endpoint,
    quotaRemaining: limit - used - cost,
    quotaUsed: used + cost,
    quotaPct: Math.round(((used + cost) / limit) * 100 * 100) / 100,
  };
}

// Log a completed provider call with real metrics.
// Call this AFTER the actual API fetch (not for reservations).
export async function logCall(
  provider: Provider,
  endpoint: string,
  durationMs: number,
  statusCode: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('provider_logs').insert({
      provider,
      endpoint,
      method: 'GET',
      duration_ms: durationMs,
      status_code: statusCode,
      level: statusCode >= 400 ? 'ERROR' : 'INFO',
      message: `${provider} ${endpoint} ${statusCode} ${durationMs}ms`,
      metadata: metadata ?? null,
    });
  } catch (err) {
    console.error(`[QuotaManager] Failed to log provider call:`, err);
  }
}

// ─── Health Dashboard ───────────────────────────────────────────────
// Returns live health for both providers including latency & success rate.

export async function getProviderHealth(): Promise<ProviderHealth[]> {
  const providers: Provider[] = ['apifootball', 'oddspapi'];
  const results: ProviderHealth[] = [];

  for (const provider of providers) {
    const { used, limit, startOf } = await loadQuotaData(provider);
    const pct = limit > 0 ? (used / limit) * 100 : 0;

    // Compute average latency and success rate from the last 50 calls
    let avgLatencyMs = 0;
    let successRate = 100;

    try {
      const { data: recent } = await supabase
        .from('provider_logs')
        .select('duration_ms, status_code, level')
        .eq('provider', provider)
        .eq('method', 'GET')
        .order('created_at', { ascending: false })
        .limit(50);

      if (recent && recent.length > 0) {
        const totalMs = recent.reduce((acc, r) => acc + (r.duration_ms ?? 0), 0);
        avgLatencyMs = Math.round(totalMs / recent.length);
        const errors = recent.filter((r) => r.level === 'ERROR' || (r.status_code ?? 200) >= 400).length;
        successRate = Math.round(((recent.length - errors) / recent.length) * 100 * 100) / 100;
      }
    } catch {
      // non-critical
    }

    results.push({
      provider,
      healthy: pct < 100 && successRate >= 80,
      quotaPct: Math.round(pct * 100) / 100,
      quotaUsed: used,
      quotaLimit: limit,
      quotaRemaining: Math.max(0, limit - used),
      avgLatencyMs,
      successRate,
      resetTime: startOf.toISOString(),
    });
  }

  return results;
}
