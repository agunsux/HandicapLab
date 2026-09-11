// EPIC 56 — Quota Manager V4 (Atomic, Persistent, Serverless-Safe)
// Rewired to the canonical quota policy (src/lib/providers/quotaPolicy.ts):
//   - The RPC's safe_limit is the provider HARD limit (contractual ceiling).
//   - The application SOFT limit drives priority rationing (ECONOMY/CRITICAL).
//   - Quota state persists in Supabase (quota_state/quota_reservations).
import { supabase } from '@/lib/supabase.server';
import {
  type Provider,
  type QuotaMode,
  type QuotaPeriodType,
  evaluateQuotaPressure,
  getProviderQuotaPolicy,
  isPriorityAllowed,
  quotaStatusLabel,
} from './quotaPolicy';

export type { Provider, QuotaMode } from './quotaPolicy';
export type QuotaType = QuotaPeriodType;

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
  { provider: 'oddspapi', endpoint: 'fixtures', cost: 1 },
  { provider: 'oddspapi', endpoint: 'odds-by-tournaments', cost: 1 },
  { provider: 'oddspapi', endpoint: 'historical-odds', cost: 0 }, // unmetered per OddsPapi docs
  { provider: 'oddspapi', endpoint: 'account', cost: 0 }, // unmetered per OddsPapi docs
  { provider: 'oddspapi', endpoint: 'health', cost: 1 },
  { provider: 'thestatsapi', endpoint: 'fixtures', cost: 1 },
  { provider: 'thestatsapi', endpoint: 'standings', cost: 1 },
  { provider: 'thestatsapi', endpoint: 'health', cost: 1 },
];

function getCost(provider: Provider, endpoint: string): number {
  return API_COST_REGISTRY.find((e) => e.provider === provider && e.endpoint === endpoint)?.cost ?? 1;
}

function getPeriod(provider: Provider): { type: QuotaType; start: Date; end: Date } {
  const now = new Date();
  if (provider === 'oddspapi') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { type: 'MONTHLY', start, end };
  }
  // Daily reset (UTC)
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
  softLimit?: number;
  hardLimit?: number;
  statusLabel?: string;
}

export async function reserveQuota(
  provider: Provider,
  endpoint: string,
  priority: number, // 0-100
  requestId?: string
): Promise<AcquireReceipt> {
  const cost = getCost(provider, endpoint);
  const policy = getProviderQuotaPolicy(provider);
  const { type, start, end } = getPeriod(provider);

  // The RPC's safe_limit is the provider HARD limit (safety reserve = 0).
  // Application-level soft-limit rationing happens below via the policy.
  const { data, error } = await supabase.rpc('reserve_quota', {
    p_provider: provider,
    p_quota_type: type,
    p_period_start: start.toISOString(),
    p_period_end: end.toISOString(),
    p_amount: cost,
    p_endpoint: endpoint,
    p_request_id: requestId || null,
    p_default_limit: policy.hardLimit,
    p_safety_reserve_pct: 0,
  });

  if (error || !data) {
    console.error(`[QuotaManagerV4] reserve_quota error for ${provider}:`, error);
    return { ok: false, reason: 'RPC_ERROR', cost, provider, endpoint, mode: 'NORMAL' };
  }

  const result = data as any;
  if (!result.ok) {
    const mode: QuotaMode = result.reason === 'QUOTA_EXHAUSTED' ? 'QUOTA_EXHAUSTED' : 'NORMAL';
    return {
      ok: false,
      reason: result.reason || 'BLOCKED',
      cost,
      provider,
      endpoint,
      mode,
      softLimit: policy.softLimit,
      hardLimit: policy.hardLimit,
      statusLabel: quotaStatusLabel(provider, mode),
    };
  }

  const consumed = Number(result.consumed ?? 0);
  const reserved = Number(result.reserved ?? 0);
  const pressure = evaluateQuotaPressure(policy, consumed, reserved);
  const statusLabel = quotaStatusLabel(provider, pressure.mode);

  if (!isPriorityAllowed(pressure.mode, priority)) {
    await rollbackQuota(result.reservation_id);
    return {
      ok: false,
      reason: `${statusLabel}: priority ${priority} < ${pressure.mode === 'CRITICAL' ? 90 : 40} rejected.`,
      cost,
      provider,
      endpoint,
      mode: pressure.mode,
      softLimit: policy.softLimit,
      hardLimit: policy.hardLimit,
      statusLabel,
    };
  }

  return {
    ok: true,
    reason: 'ok',
    reservationId: result.reservation_id,
    cost,
    provider,
    endpoint,
    quotaRemaining: pressure.hardRemaining,
    mode: pressure.mode,
    softLimit: policy.softLimit,
    hardLimit: policy.hardLimit,
    statusLabel,
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
  const { error } = await supabase.rpc('cleanup_stale_reservations', {
    p_stale_minutes: staleMinutes,
  });
  if (error) {
    console.error(`[QuotaManagerV4] cleanupStaleReservations error:`, error);
  }
}

export interface QuotaSnapshot {
  provider: Provider;
  period: QuotaType;
  periodStart: string;
  periodEnd: string;
  used: number; // consumed + reserved
  consumed: number;
  reserved: number;
  hardLimit: number;
  softLimit: number;
  hardRemaining: number;
  softRemaining: number;
  pctOfHard: number;
  pctOfSoft: number;
  mode: QuotaMode;
  statusLabel: string;
  resetAt: string;
  updatedAt: string | null;
}

/**
 * Single read API for quota state. Used by admin UI, request counters and ops.
 * Returns null when no quota_state row exists for the current period yet
 * (meaning: no metered calls have been made this period).
 */
export async function getQuotaSnapshot(provider: Provider): Promise<QuotaSnapshot | null> {
  const policy = getProviderQuotaPolicy(provider);
  const { type, start, end } = getPeriod(provider);

  const { data, error } = await supabase
    .from('quota_state')
    .select('consumed, reserved, limit_value, updated_at')
    .eq('provider', provider)
    .eq('quota_type', type)
    .eq('period_start', start.toISOString())
    .maybeSingle();

  if (error || !data) return null;

  const consumed = Number(data.consumed ?? 0);
  const reserved = Number(data.reserved ?? 0);
  const used = consumed + reserved;
  const hardLimit = Number(data.limit_value ?? policy.hardLimit) || policy.hardLimit;
  const pressure = evaluateQuotaPressure({ ...policy, hardLimit }, consumed, reserved);

  return {
    provider,
    period: type,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    used,
    consumed,
    reserved,
    hardLimit,
    softLimit: policy.softLimit,
    hardRemaining: pressure.hardRemaining,
    softRemaining: pressure.softRemaining,
    pctOfHard: pressure.pctOfHard,
    pctOfSoft: pressure.pctOfSoft,
    mode: pressure.mode,
    statusLabel: quotaStatusLabel(provider, pressure.mode),
    resetAt: end.toISOString(),
    updatedAt: data.updated_at ?? null,
  };
}
