// EPIC 56 — Quota Manager (v3 compatibility facade)
// Single gate for ALL external API requests.
//
// Rewired to the canonical quota policy:
//   - Reads usage from the atomic quota_state table (QuotaManager V4) when
//     available, falling back to provider_logs only if quota_state is empty.
//   - Limits come from quotaPolicy (API-Football PRO: hard 7,500 / soft 6,000;
//     OddsPapi: hard 250 / soft 200). No more hardcoded 100/day.
//   - Priority gating uses the same modes as V4 (NORMAL/ECONOMY/CRITICAL/
//     QUOTA_EXHAUSTED) so both managers cannot disagree.

import { supabase } from '@/lib/supabase.server';
import {
  type Provider,
  type QuotaMode,
  evaluateQuotaPressure,
  getProviderQuotaPolicy,
  isPriorityAllowed,
  quotaStatusLabel,
} from './quotaPolicy';
import { getQuotaSnapshot } from './quotaManagerV4';

export type { Provider } from './quotaPolicy';

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
  { provider: 'oddspapi',    endpoint: 'odds-by-tournaments', cost: 1 },
  { provider: 'oddspapi',    endpoint: 'historical-odds', cost: 0 },
  { provider: 'oddspapi',    endpoint: 'account',         cost: 0 },
  { provider: 'oddspapi',    endpoint: 'health',          cost: 1 },
  // TheStatsAPI endpoints
  { provider: 'thestatsapi', endpoint: 'fixtures',        cost: 1 },
  { provider: 'thestatsapi', endpoint: 'standings',       cost: 1 },
  { provider: 'thestatsapi', endpoint: 'health',          cost: 1 },
];

function getCost(provider: Provider, endpoint: string): number {
  return API_COST_REGISTRY.find((e) => e.provider === provider && e.endpoint === endpoint)?.cost ?? 1;
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
  mode: QuotaMode;
  softLimit: number;
  hardLimit: number;
  statusLabel: string;
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
  mode: QuotaMode;
  softLimit: number;
  hardLimit: number;
  softRemaining: number;
  statusLabel: string;
}

export type Priority = number; // 0-100 (100 is highest)

// ─── Internals ──────────────────────────────────────────────────────
function getResetPeriod(provider: Provider): { startOf: Date } {
  const now = new Date();
  if (provider === 'oddspapi') {
    return { startOf: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) };
  }
  return { startOf: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) };
}

async function loadQuotaData(
  provider: Provider
): Promise<{ used: number; limit: number; softLimit: number; mode: QuotaMode; startOf: Date }> {
  const policy = getProviderQuotaPolicy(provider);
  const { startOf } = getResetPeriod(provider);

  // 1. Preferred source: atomic quota_state (V4).
  try {
    const snapshot = await getQuotaSnapshot(provider);
    if (snapshot) {
      return {
        used: snapshot.used,
        limit: snapshot.hardLimit,
        softLimit: snapshot.softLimit,
        mode: snapshot.mode,
        startOf,
      };
    }
  } catch {
    // fall through to provider_logs below
  }

  // 2. Fallback: count provider_logs INFO rows (legacy advisory accounting).
  try {
    const { data, error } = await supabase
      .from('provider_logs')
      .select('id', { count: 'exact', head: true })
      .eq('provider', provider)
      .eq('level', 'INFO')
      .gte('created_at', startOf.toISOString());

    if (error) {
      console.warn(`[QuotaManager] Query error for ${provider}:`, error.message);
      return { used: 0, limit: policy.hardLimit, softLimit: policy.softLimit, mode: 'NORMAL', startOf };
    }

    const used = data?.length ?? 0;
    const pressure = evaluateQuotaPressure(policy, used);
    return { used, limit: policy.hardLimit, softLimit: policy.softLimit, mode: pressure.mode, startOf };
  } catch (err) {
    console.warn(`[QuotaManager] Error for ${provider}:`, err);
    return { used: 0, limit: policy.hardLimit, softLimit: policy.softLimit, mode: 'NORMAL', startOf };
  }
}

// ─── Public API ─────────────────────────────────────────────────────

// THE single entry point for all external API calls.
export async function acquire(
  provider: Provider,
  endpoint: string,
  priority: Priority
): Promise<AcquireReceipt> {
  const { used, limit, softLimit, mode } = await loadQuotaData(provider);
  const cost = getCost(provider, endpoint);
  const pct = limit > 0 ? (used / limit) * 100 : 0;
  const statusLabel = quotaStatusLabel(provider, mode);

  const receiptBase = {
    cost, provider, endpoint,
    quotaRemaining: Math.max(0, limit - used),
    quotaUsed: used,
    quotaPct: Math.round(pct * 100) / 100,
    mode,
    softLimit,
    hardLimit: limit,
    statusLabel,
  };

  // Hard block at the provider limit.
  if (used >= limit || used + cost > limit) {
    return { ...receiptBase, ok: false, reason: `QUOTA_EXHAUSTED: ${provider} needs ${cost} but ${Math.max(0, limit - used)} remain.` };
  }

  // Soft-limit priority rationing (shared policy with V4).
  if (!isPriorityAllowed(mode, priority)) {
    return { ...receiptBase, ok: false, reason: `${statusLabel}: priority ${priority} rejected.` };
  }

  // Audit trail: reservation marker (advisory; V4 remains the atomic gate).
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
    quotaRemaining: Math.max(0, limit - used - cost),
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
    const { used, limit, softLimit, mode, startOf } = await loadQuotaData(provider);
    const pct = limit > 0 ? (used / limit) * 100 : 0;
    const statusLabel = quotaStatusLabel(provider, mode);

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
      healthy: mode !== 'QUOTA_EXHAUSTED' && successRate >= 80,
      quotaPct: Math.round(pct * 100) / 100,
      quotaUsed: used,
      quotaLimit: limit,
      quotaRemaining: Math.max(0, limit - used),
      avgLatencyMs,
      successRate,
      resetTime: startOf.toISOString(),
      mode,
      softLimit,
      hardLimit: limit,
      softRemaining: Math.max(0, softLimit - used),
      statusLabel,
    });
  }

  return results;
}
