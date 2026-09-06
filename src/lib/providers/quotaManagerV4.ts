// EPIC 56 — Quota Manager V4 (Atomic, Persistent, Serverless-Safe)
import { supabase } from '@/lib/supabase.server';

export type Provider = 'apifootball' | 'oddspapi' | 'thestatsapi';
export type QuotaType = 'DAILY' | 'MONTHLY';
export type QuotaMode = 'NORMAL' | 'ECONOMY' | 'CRITICAL';

export interface EndpointCost {
  provider: Provider;
  endpoint: string;
  cost: number;
}

export const API_COST_REGISTRY: EndpointCost[] = [
  { provider: 'apifootball', endpoint: 'fixtures', cost: 1 },
  { provider: 'apifootball', endpoint: 'fixtures/historical', cost: 1 },
  { provider: 'apifootball', endpoint: 'fixtures/postmatch', cost: 1 },
  { provider: 'apifootball', endpoint: 'fixtures/statistics', cost: 1 },
  { provider: 'apifootball', endpoint: 'teams/statistics', cost: 1 },
  { provider: 'apifootball', endpoint: 'odds', cost: 1 },
  { provider: 'apifootball', endpoint: 'odds/bookmakers', cost: 1 },
  { provider: 'apifootball', endpoint: 'odds/bets', cost: 1 },
  { provider: 'apifootball', endpoint: 'odds/live', cost: 1 },
  { provider: 'apifootball', endpoint: 'standings', cost: 1 },
  { provider: 'apifootball', endpoint: 'leagues', cost: 1 },
  { provider: 'apifootball', endpoint: 'injuries', cost: 1 },
  { provider: 'apifootball', endpoint: 'lineups', cost: 1 },
  { provider: 'apifootball', endpoint: 'venues', cost: 1 },
  { provider: 'apifootball', endpoint: 'health', cost: 1 },
  { provider: 'oddspapi', endpoint: 'odds', cost: 1 },
  { provider: 'oddspapi', endpoint: 'health', cost: 1 },
  { provider: 'thestatsapi', endpoint: 'fixtures', cost: 1 },
  { provider: 'thestatsapi', endpoint: 'standings', cost: 1 },
  { provider: 'thestatsapi', endpoint: 'health', cost: 1 },
];

function getCost(provider: Provider, endpoint: string): number {
  return API_COST_REGISTRY.find((e) => e.provider === provider && e.endpoint === endpoint)?.cost ?? 1;
}

function getProviderLimits(provider: Provider): { limit: number; safetyReservePct: number } {
  if (provider === 'apifootball') {
    // API-Football PRO limits. Limit is updated from headers, default to a safe baseline if unknown.
    return { limit: parseInt(process.env.QUOTA_APIFOOTBALL_DAILY || '7500', 10), safetyReservePct: 5 };
  }
  if (provider === 'oddspapi') {
    // OddsPAPI Monthly Free Plan: 250 requests, 20% safety reserve -> 200 safe limit
    return { limit: parseInt(process.env.QUOTA_ODDSPAPI_MONTHLY || '250', 10), safetyReservePct: 20 };
  }
  return { limit: parseInt(process.env.QUOTA_THESTATSAPI_DAILY || '1000', 10), safetyReservePct: 10 };
}

function getPeriod(provider: Provider): { type: QuotaType; start: Date; end: Date } {
  const now = new Date();
  if (provider === 'oddspapi') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { type: 'MONTHLY', start, end };
  }
  // Daily reset
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  return { type: 'DAILY', start, end };
}

export interface AcquireReceipt {
  ok: boolean;
  reason: string;
  reservationId?: string;
  cost: number;
  provider: Provider;
  endpoint: string;
  quotaRemaining?: number;
  mode: QuotaMode;
}

export async function reserveQuota(
  provider: Provider,
  endpoint: string,
  priority: number, // 0-100
  requestId?: string
): Promise<AcquireReceipt> {
  const cost = getCost(provider, endpoint);
  const { limit, safetyReservePct } = getProviderLimits(provider);
  const { type, start, end } = getPeriod(provider);

  // Call atomic RPC
  const { data, error } = await supabase.rpc('reserve_quota', {
    p_provider: provider,
    p_quota_type: type,
    p_period_start: start.toISOString(),
    p_period_end: end.toISOString(),
    p_amount: cost,
    p_endpoint: endpoint,
    p_request_id: requestId || null,
    p_default_limit: limit,
    p_safety_reserve_pct: safetyReservePct,
  });

  if (error || !data) {
    console.error(`[QuotaManagerV4] reserve_quota error for ${provider}:`, error);
    return { ok: false, reason: 'RPC_ERROR', cost, provider, endpoint, mode: 'NORMAL' };
  }

  const result = data as any;
  if (!result.ok) {
    return { ok: false, reason: result.reason || 'BLOCKED', cost, provider, endpoint, mode: 'NORMAL' };
  }

  const safeLimit = result.safe_limit;
  const consumed = result.consumed;
  const reserved = result.reserved;
  const safeRemaining = result.safe_remaining;

  // Determine mode based on allocation (Remaining > 20%: NORMAL; 5%-20%: ECONOMY; < 5%: CRITICAL)
  const totalAllocated = consumed + reserved;
  const pct = safeLimit > 0 ? (totalAllocated / safeLimit) * 100 : 0;
  
  let mode: QuotaMode = 'NORMAL';
  if (pct >= 95) mode = 'CRITICAL';
  else if (pct >= 80) mode = 'ECONOMY';

  // Economy Mode check (priority < 60 rejected)
  if (mode === 'ECONOMY' && priority < 60) {
    // We reserved it but we must rollback immediately because priority is too low
    await rollbackQuota(result.reservation_id);
    return { ok: false, reason: `ECONOMY_MODE: priority ${priority} < 60 rejected.`, cost, provider, endpoint, mode };
  }

  // Critical Mode check (priority < 90 rejected)
  if (mode === 'CRITICAL' && priority < 90) {
    await rollbackQuota(result.reservation_id);
    return { ok: false, reason: `CRITICAL_MODE: priority ${priority} < 90 rejected.`, cost, provider, endpoint, mode };
  }

  return {
    ok: true,
    reason: 'ok',
    reservationId: result.reservation_id,
    cost,
    provider,
    endpoint,
    quotaRemaining: safeRemaining,
    mode,
  };
}

export async function confirmQuota(
  reservationId: string,
  actualCost: number,
  providerLimit?: number,
  providerRemaining?: number
): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await supabase.rpc('confirm_quota', {
    p_reservation_id: reservationId,
    p_actual_cost: actualCost,
    p_provider_limit: providerLimit ?? null,
    p_provider_remaining: providerRemaining ?? null,
  });

  if (error || !data) {
    console.error(`[QuotaManagerV4] confirm_quota error:`, error);
    return { ok: false, reason: 'RPC_ERROR' };
  }
  
  return { ok: data.ok, reason: data.reason };
}

export async function rollbackQuota(reservationId: string): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await supabase.rpc('rollback_quota', {
    p_reservation_id: reservationId,
  });

  if (error || !data) {
    console.error(`[QuotaManagerV4] rollback_quota error:`, error);
    return { ok: false, reason: 'RPC_ERROR' };
  }

  return { ok: data.ok, reason: data.reason };
}

/**
 * Recovers stale reservations that crashed before confirm/rollback.
 * A cron job can call this periodically.
 */
export async function cleanupStaleReservations(staleMinutes = 5): Promise<void> {
  // We can write a specific RPC for this or just do a Supabase query if we add an RPC later.
  // For now, this is a placeholder or we can implement the RPC 'cleanup_stale_reservations'.
  const { error } = await supabase.rpc('cleanup_stale_reservations', {
    p_stale_minutes: staleMinutes
  });
  if (error) {
    console.error(`[QuotaManagerV4] cleanupStaleReservations error:`, error);
  }
}
