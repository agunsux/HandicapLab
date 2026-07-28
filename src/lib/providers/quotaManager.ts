// EPIC 53 Stage A — Central Quota Manager
// Operates 2-3x daily, not continuously. Every API request checks quota before firing.
// 90% = alert, 95% = emergency (historical auto-pause), 100% = locked.
// Two providers: API-Football (free tier: 100/day) and OddsPapi (free tier: 250/month).

import { supabase } from '@/lib/supabase.server';

export interface ProviderQuota {
  provider: 'apifootball' | 'oddspapi';
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  usagePct: number;
  isBlocked: boolean;
  isEmergency: boolean;
  resetTime: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason: string;
  quota: ProviderQuota;
}

// API-Football free tier = 100 requests/day, resets midnight UTC
// OddsPapi free tier = 250 requests/month, resets 1st of month
const PROVIDER_LIMITS = {
  apifootball: 100,
  oddspapi: 250,
} as const;

function getResetKey(provider: 'apifootball' | 'oddspapi'): { key: string; startOf: Date } {
  const now = new Date();
  if (provider === 'apifootball') {
    const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return { key: reset.toISOString().slice(0, 10), startOf: reset };
  }
  // oddspapi: calendar month
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { key: reset.toISOString().slice(0, 7), startOf: reset };
}

// Fetch current quota usage from provider_logs for the current window
export async function getQuota(provider: 'apifootball' | 'oddspapi'): Promise<ProviderQuota> {
  const { key, startOf } = getResetKey(provider);
  const limit = PROVIDER_LIMITS[provider];

  try {
    const { data, error } = await supabase
      .from('provider_logs')
      .select('id', { count: 'exact', head: true })
      .eq('provider', provider)
      .eq('level', 'INFO')
      .gte('created_at', startOf.toISOString());

    if (error) {
      console.warn(`[QuotaManager] Failed to query provider_logs for ${provider}:`, error.message);
      return {
        provider,
        dailyLimit: limit,
        usedToday: 0,
        remaining: limit,
        usagePct: 0,
        isBlocked: false,
        isEmergency: false,
        resetTime: startOf.toISOString(),
      };
    }

    const usedToday = data?.length ?? 0;
    const usagePct = (usedToday / limit) * 100;
    const isEmergency = usagePct >= 95;
    const isBlocked = usedToday >= limit;

    return {
      provider,
      dailyLimit: limit,
      usedToday,
      remaining: Math.max(0, limit - usedToday),
      usagePct: Math.round(usagePct * 100) / 100,
      isBlocked,
      isEmergency,
      resetTime: startOf.toISOString(),
    };
  } catch (err) {
    console.warn(`[QuotaManager] Quota check error for ${provider}:`, err);
    return {
      provider,
      dailyLimit: limit,
      usedToday: 0,
      remaining: limit,
      usagePct: 0,
      isBlocked: false,
      isEmergency: false,
      resetTime: startOf.toISOString(),
    };
  }
}

// Can this specific request proceed given the current quota?
// priority: 'critical' (T-60/T-120 snapshots), 'normal' (today's fixtures), 'background' (historical)
export async function canProceed(
  provider: 'apifootball' | 'oddspapi',
  priority: 'critical' | 'normal' | 'background'
): Promise<QuotaCheckResult> {
  const quota = await getQuota(provider);

  if (quota.isBlocked) {
    return { allowed: false, reason: `QUOTA_EXHAUSTED: ${provider} used ${quota.usedToday}/${quota.dailyLimit}`, quota };
  }

  // Background (historical) pauses at 75% to preserve quota for live fixtures
  if (priority === 'background' && quota.usagePct >= 75) {
    return { allowed: false, reason: `BACKGROUND_PAUSED: ${provider} at ${quota.usagePct}%, preserving for live fixtures`, quota };
  }

  // Normal (today's fixtures) pauses at 90%
  if (priority === 'normal' && quota.usagePct >= 90) {
    return { allowed: false, reason: `NORMAL_PAUSED: ${provider} at ${quota.usagePct}%, preserving for critical windows`, quota };
  }

  // Critical always proceeds unless blocked (100%)
  return { allowed: true, reason: 'ok', quota };
}

// Log a successful provider call (called by the provider wrapper after each fetch)
export async function logProviderCall(
  provider: 'apifootball' | 'oddspapi',
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

// Get combined health for the dashboard
export async function getProviderHealth() {
  const [apiFootball, oddsPapi] = await Promise.all([
    getQuota('apifootball'),
    getQuota('oddspapi'),
  ]);
  return { apifootball: apiFootball, oddspapi: oddsPapi };
}
