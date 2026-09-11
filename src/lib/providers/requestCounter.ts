// EPIC 52 Stage A — OddsPapi Request Budget Counter
// Rewired to the canonical quota policy:
//   hard 250 billable requests/month, soft 200/month (ODDS_QUOTA_PROTECTION).
// Budget is counted from the atomic quota_state table (QuotaManager V4) with a
// provider_logs fallback, so the counter persists across deploys/restarts.
// The counter is checked BEFORE every billable fetch; if the hard limit is
// reached the fetch is skipped with a logged warning (pipeline degrades
// gracefully instead of erroring).
//
// NOTE: /v4/historical-odds and /v4/account are unmetered and MUST NOT be
// routed through this counter (see quotaPolicy.UNMETERED_ENDPOINTS).

import { supabase } from '@/lib/supabase.server';
import { getQuotaSnapshot } from '@/lib/providers/quotaManagerV4';
import { getProviderQuotaPolicy, quotaStatusLabel } from '@/lib/providers/quotaPolicy';

export interface BudgetStatus {
  used: number;
  remaining: number;
  limit: number; // hard limit
  softLimit: number;
  softRemaining: number;
  alertTriggered: boolean; // soft limit reached (ODDS_QUOTA_PROTECTION)
  blocked: boolean; // hard stop, skip fetch
  statusLabel: string;
}

async function countProviderLogsSince(iso: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('provider_logs')
      .select('id', { count: 'exact', head: true })
      .eq('provider', 'oddspapi')
      .eq('level', 'INFO')
      .gte('created_at', iso);
    if (error) return 0;
    return data?.length ?? 0;
  } catch {
    return 0;
  }
}

// Fetch current budget usage for the current calendar month.
export async function getBudgetStatus(): Promise<BudgetStatus> {
  const policy = getProviderQuotaPolicy('oddspapi');
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  let used = 0;
  try {
    const snapshot = await getQuotaSnapshot('oddspapi');
    const logged = await countProviderLogsSince(monthStart);
    // max() avoids double counting while protecting against legacy paths that
    // only wrote provider_logs.
    used = Math.max(snapshot?.used ?? 0, logged);
  } catch (err) {
    console.warn('[RequestCounter] Budget check error:', err);
    used = await countProviderLogsSince(monthStart);
  }

  const remaining = Math.max(0, policy.hardLimit - used);
  const softRemaining = Math.max(0, policy.softLimit - used);
  const alertTriggered = used >= policy.softLimit;
  const blocked = used >= policy.hardLimit;
  const statusLabel = quotaStatusLabel(
    'oddspapi',
    blocked ? 'QUOTA_EXHAUSTED' : alertTriggered ? 'CRITICAL' : 'NORMAL'
  );

  return {
    used,
    remaining,
    limit: policy.hardLimit,
    softLimit: policy.softLimit,
    softRemaining,
    alertTriggered,
    blocked,
    statusLabel,
  };
}

// Check budget BEFORE calling OddsPapi. Returns false if blocked.
export async function canFetchOdds(): Promise<boolean> {
  const status = await getBudgetStatus();
  if (status.blocked) {
    console.warn(`[RequestCounter] ODDS_QUOTA_EXHAUSTED (${status.used}/${status.limit}). Odds fetch skipped.`);
    return false;
  }
  if (status.alertTriggered) {
    console.warn(`[RequestCounter] ${status.statusLabel} at ${status.used}/${status.limit} — soft limit exceeded.`);
  }
  return true;
}
