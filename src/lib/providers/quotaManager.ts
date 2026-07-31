// EPIC 56 — Quota Manager (v3)
// Single gate for ALL external API requests.
// Implements Priority-based throttling (NORMAL, ECONOMY, CRITICAL modes).
// Limits are configurable via environment variables.

import { supabase } from '@/lib/supabase.server';

// ─── API Cost Registry ──────────────────────────────────────────────
export type Provider = 'apifootball' | 'oddspapi' | 'thestatsapi';

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
  { provider: 'apifootball', endpoint: 'leagues',         cost: 1 },
  { provider: 'apifootball', endpoint: 'injuries',        cost: 1 },
  { provider: 'apifootball', endpoint: 'lineups',         cost: 1 },
  { provider: 'apifootball', endpoint: 'venues',          cost: 1 },
  { provider: 'apifootball', endpoint: 'health',          cost: 1 },
  // OddsPapi endpoints
  { provider: 'oddspapi',    endpoint: 'odds',            cost: 1 },
  { provider: 'oddspapi',    endpoint: 'health',          cost: 1 },
  // TheStatsAPI endpoints
  { provider: 'thestatsapi', endpoint: 'fixtures',        cost: 1 },
  { provider: 'thestatsapi', endpoint: 'standings',       cost: 1 },
  { provider: 'thestatsapi', endpoint: 'health',          cost: 1 },
];

function getCost(provider: Provider, endpoint: string): number {
  return API_COST_REGISTRY.find((e) => e.provider === provider && e.endpoint === endpoint)?.cost ?? 1;
}

// ─── Quota Limits ───────────────────────────────────────────────────
function getProviderLimit(provider: Provider): number {
  if (provider === 'apifootball') {
    return parseInt(process.env.QUOTA_APIFOOTBALL_DAILY || '100', 10);
  }
  if (provider === 'thestatsapi') {
    return parseInt(process.env.QUOTA_THESTATSAPI_DAILY || '1000', 10);
  }
  return parseInt(process.env.QUOTA_ODDSPAPI_MONTHLY || '250', 10);
}

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
  mode: 'NORMAL' | 'ECONOMY' | 'CRITICAL';
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
  mode: 'NORMAL' | 'ECONOMY' | 'CRITICAL';
}

export type Priority = number; // 0-100 (100 is highest)

// ─── Internals ──────────────────────────────────────────────────────
function getResetPeriod(provider: Provider): { startOf: Date } {
  const now = new Date();
  if (provider === 'apifootball' || provider === 'thestatsapi') {
    // Daily reset (midnight UTC)
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return { startOf: start };
  }
  // oddspapi: calendar month reset
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { startOf: start };
}

async function loadQuotaData(provider: Provider): Promise<{ used: number; limit: number; startOf: Date }> {
  const { startOf } = getResetPeriod(provider);
  const limit = getProviderLimit(provider);

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
export async function acquire(
  provider: Provider,
  endpoint: string,
  priority: Priority
): Promise<AcquireReceipt> {
  const { used, limit, startOf } = await loadQuotaData(provider);
  const cost = getCost(provider, endpoint);
  const pct = limit > 0 ? (used / limit) * 100 : 0;
  
  let mode: 'NORMAL' | 'ECONOMY' | 'CRITICAL' = 'NORMAL';
  if (pct >= 90) mode = 'CRITICAL';
  else if (pct >= 75) mode = 'ECONOMY';

  const receiptBase = {
    cost, provider, endpoint,
    quotaRemaining: limit - used,
    quotaUsed: used,
    quotaPct: Math.round(pct * 100) / 100,
    mode
  };

  // Hard block at 100%
  if (used >= limit || used + cost > limit) {
    return { ...receiptBase, ok: false, reason: `QUOTA_EXHAUSTED: ${provider} needs ${cost} but ${limit - used} remain.` };
  }

  // ECONOMY MODE: Reject priority < 60 (Discovery, Historical, Metadata)
  if (mode === 'ECONOMY' && priority < 60) {
    return { ...receiptBase, ok: false, reason: `ECONOMY_MODE: priority ${priority} < 60 rejected.` };
  }

  // CRITICAL MODE: Reject priority < 90 (Only Settlement, Live, Prediction T-60 allowed)
  if (mode === 'CRITICAL' && priority < 90) {
    return { ...receiptBase, ok: false, reason: `CRITICAL_MODE: priority ${priority} < 90 rejected.` };
  }

  // Reserve slot
  void supabase.from('provider_logs').insert({
    provider,
    endpoint,
    method: 'QUOTA_RESERVATION',
    status_code: 0,
    duration_ms: 0,
    level: 'INFO',
    message: `Quota reserved: ${endpoint} (cost=${cost}, priority=${priority}, mode=${mode})`,
    metadata: { cost, priority, mode, reserved: true },
  });

  return {
    ...receiptBase,
    ok: true,
    reason: 'ok',
    quotaRemaining: limit - used - cost,
    quotaUsed: used + cost,
    quotaPct: Math.round(((used + cost) / limit) * 100 * 100) / 100,
  };
}

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

export async function getProviderHealth(): Promise<ProviderHealth[]> {
  const providers: Provider[] = ['apifootball', 'oddspapi', 'thestatsapi'];
  const results: ProviderHealth[] = [];

  for (const provider of providers) {
    const { used, limit, startOf } = await loadQuotaData(provider);
    const pct = limit > 0 ? (used / limit) * 100 : 0;
    
    let mode: 'NORMAL' | 'ECONOMY' | 'CRITICAL' = 'NORMAL';
    if (pct >= 90) mode = 'CRITICAL';
    else if (pct >= 75) mode = 'ECONOMY';

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
      mode,
    });
  }

  return results;
}

