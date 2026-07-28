// EPIC 52 Stage A — OddsPapi Request Budget Counter
// Free tier: 250 requests/month. Hard stop + Telegram alert at 90% (225).
// Budget is counted store-side so the counter persists across deploys/restarts.
// The counter is checked BEFORE every fetch; if exhausted the fetch is skipped
// with a logged warning (pipeline degrades gracefully instead of erroring).

import { supabase } from '@/lib/supabase.server';

const MONTHLY_BUDGET = 250;
const ALERT_THRESHOLD = 0.9; // 90%

export interface BudgetStatus {
  used: number;
  remaining: number;
  limit: number;
  alertTriggered: boolean;
  blocked: boolean; // true = hard stop, skip fetch
}

// Fetch current budget usage for the current calendar month.
export async function getBudgetStatus(): Promise<BudgetStatus> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data, error } = await supabase
      .from('provider_logs')
      .select('id', { count: 'exact', head: true })
      .eq('provider', 'oddspapi')
      .eq('level', 'INFO')
      .gte('created_at', monthStart);

    if (error) {
      console.warn('[RequestCounter] Failed to query provider_logs:', error.message);
      return { used: 0, remaining: MONTHLY_BUDGET, limit: MONTHLY_BUDGET, alertTriggered: false, blocked: false };
    }

    const used = data?.length ?? 0;
    const remaining = Math.max(0, MONTHLY_BUDGET - used);
    const alertTriggered = used >= Math.floor(MONTHLY_BUDGET * ALERT_THRESHOLD);
    const blocked = used >= MONTHLY_BUDGET;

    return { used, remaining, limit: MONTHLY_BUDGET, alertTriggered, blocked };
  } catch (err) {
    console.warn('[RequestCounter] Budget check error:', err);
    return { used: 0, remaining: MONTHLY_BUDGET, limit: MONTHLY_BUDGET, alertTriggered: false, blocked: false };
  }
}

// Check budget BEFORE calling OddsPapi. Returns false if blocked.
export async function canFetchOdds(): Promise<boolean> {
  const status = await getBudgetStatus();
  if (status.blocked) {
    console.warn(`[RequestCounter] BUDGET EXHAUSTED (${status.used}/${status.limit}). Odds fetch skipped.`);
    return false;
  }
  if (status.alertTriggered) {
    console.warn(`[RequestCounter] Budget at ${status.used}/${status.limit} — alert threshold exceeded.`);
    // TODO: send Telegram alert when Telegram integration is wired
  }
  return true;
}
