// EPIC 52 Stage A — Sharp odds fetcher: native OddsPAPI v4 with bookmaker filtering + budget gating.
// Fetches odds for the approved sharp books (server-side verified slugs from /v4/bookmakers).
// Gated by the monthly request counter — no poll, only T-60 and signal-gen trigger points.
//
// NOTE: this module now delegates to the native OddsPAPI v4 adapter
// (src/lib/data/providers/odds/native). The legacy The-Odds-API-shaped client
// (src/lib/apis/oddspapi.ts) is no longer used by the production odds path.

import { oddsPapiV4Provider } from '@/lib/data/providers/odds/native';
import { canFetchOdds, getBudgetStatus } from '@/lib/providers/requestCounter';

export interface SharpOddsForFixture {
  fixtureId: string;
  sportKey: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  bookmakers: Array<{
    key: string;
    title: string;
    lastUpdate: string | null;
    markets: Array<{
      key: string;
      outcomes: Array<{ name: string; price: number; point?: number }>;
    }>;
  }>;
}

export interface SharpOddsResult {
  odds: SharpOddsForFixture[] | null;
  blocked: boolean;
  budgetUsed: number;
  budgetRemaining: number;
}

// Fetch sharp odds via the native OddsPAPI v4 adapter.
// Budget-gated: returns null if the monthly request budget is exhausted.
// `sport` is accepted for interface compatibility with the legacy call sites;
// the native adapter discovers the soccer sport + tournaments itself.
export async function fetchSharpOdds(
  _sport: string,
  _regions = 'eu'
): Promise<SharpOddsResult> {
  const budget = await getBudgetStatus();

  if (budget.blocked) {
    return { odds: null, blocked: true, budgetUsed: budget.used, budgetRemaining: budget.remaining };
  }

  try {
    const { sharp } = await oddsPapiV4Provider.fetchNormalizedOdds();
    return { odds: sharp, blocked: false, budgetUsed: budget.used + 1, budgetRemaining: budget.remaining - 1 };
  } catch (err) {
    console.error('[SharpOdds] Native OddsPAPI fetch failed:', err instanceof Error ? err.message : err);
    return { odds: null, blocked: false, budgetUsed: budget.used, budgetRemaining: budget.remaining };
  }
}

// Lightweight check: will this fetch cost budget?
export { canFetchOdds, getBudgetStatus };
