// ============================================================================
// SALMO RESCUE PIPELINE — QUOTA GUARD
// Namespace: src/lib/pipeline/rescue/quotaGuard.ts
// Invariant: Checked at the very first operation of the pipeline.
// If remaining <= 50: skip ALL odds calls, set odds_status = 'QUOTA_CRITICAL'.
// Never abort the pipeline on quota constraint; continue in research mode.
// ============================================================================

import { getQuotaSnapshot } from '@/lib/providers/quotaManagerV4';

export interface QuotaGuardResult {
  allowOddsFetch: boolean;
  quotaRemaining: number;
  requestLimit: number;
  requestCount: number;
  status: 'NORMAL' | 'QUOTA_CRITICAL' | 'UNAVAILABLE';
  reason?: string;
}

export class RescueQuotaGuard {
  public static readonly CRITICAL_THRESHOLD = 50;

  /**
   * Evaluates live OddsPapi quota remaining.
   * Prioritizes unmetered /v4/account call, falls back to atomic quota_state.
   */
  public static async checkOddsPapiQuota(apiKeyOverride?: string): Promise<QuotaGuardResult> {
    const apiKey = apiKeyOverride || (process.env.ODDS_PAPI_KEY || process.env.ODDSPAPI_KEY || '').trim();

    if (!apiKey) {
      return {
        allowOddsFetch: false,
        quotaRemaining: 0,
        requestLimit: 250,
        requestCount: 250,
        status: 'UNAVAILABLE',
        reason: 'ODDS_PAPI_KEY is not configured',
      };
    }

    // 1. Direct unmetered check via /v4/account
    try {
      const res = await fetch(`https://api.oddspapi.io/v4/account?apiKey=${apiKey}`, {
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        const data: any = await res.json();
        const sub = (data.subscriptions ?? [])[0];
        if (sub) {
          const limit = Number(sub.request_limit ?? 250);
          const count = Number(sub.request_count ?? 0);
          const remaining = Math.max(0, limit - count);

          const isCritical = remaining <= this.CRITICAL_THRESHOLD;
          return {
            allowOddsFetch: !isCritical,
            quotaRemaining: remaining,
            requestLimit: limit,
            requestCount: count,
            status: isCritical ? 'QUOTA_CRITICAL' : 'NORMAL',
            reason: isCritical
              ? `Quota remaining (${remaining}) <= critical threshold (${this.CRITICAL_THRESHOLD})`
              : undefined,
          };
        }
      }
    } catch (e: any) {
      console.warn('[RescueQuotaGuard] Live /v4/account probe failed, checking quota_state:', e?.message);
    }

    // 2. Fallback to atomic quota_state in Supabase
    try {
      const snapshot = await getQuotaSnapshot('oddspapi');
      if (snapshot) {
        const remaining = snapshot.hardRemaining;
        const isCritical = remaining <= this.CRITICAL_THRESHOLD;
        return {
          allowOddsFetch: !isCritical,
          quotaRemaining: remaining,
          requestLimit: snapshot.hardLimit,
          requestCount: snapshot.consumed,
          status: isCritical ? 'QUOTA_CRITICAL' : 'NORMAL',
          reason: isCritical
            ? `Quota state remaining (${remaining}) <= critical threshold (${this.CRITICAL_THRESHOLD})`
            : undefined,
        };
      }
    } catch (e: any) {
      console.warn('[RescueQuotaGuard] Quota state check failed:', e?.message);
    }

    return {
      allowOddsFetch: false,
      quotaRemaining: 0,
      requestLimit: 250,
      requestCount: 250,
      status: 'QUOTA_CRITICAL',
      reason: 'Failed to establish quota safety. Defaulting to QUOTA_CRITICAL mode.',
    };
  }
}
