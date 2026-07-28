// EPIC 52 Stage A — Sharp odds fetcher: OddsPapi with bookmaker filtering + budget gating.
// Fetches odds for the 4 approved sharp books (client-side filter from single API call).
// Gated by the monthly request counter — no poll, only T-60 and signal-gen trigger points.

import { oddsApiClient, type OddsApiMatchOdds } from '@/lib/apis/oddspapi';
import { ENABLED_SHARP_BOOK_KEYS, ODDS_MARKETS } from '@/lib/config/sharpBooks';
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
  budgetUsed: number;
  budgetRemaining: number;
}

// Fetch odds for a sport, filtering to the enabled sharp books only.
// Budget-gated: returns null if the monthly request budget is exhausted.
export async function fetchSharpOdds(
  sport: string,
  regions = 'eu'
): Promise<{ odds: SharpOddsForFixture[] | null; blocked: boolean; budgetUsed: number; budgetRemaining: number }> {
  const budget = await getBudgetStatus();

  if (budget.blocked) {
    return { odds: null, blocked: true, budgetUsed: budget.used, budgetRemaining: budget.remaining };
  }

  try {
    const rawOdds = await oddsApiClient.getOdds(sport, regions, ODDS_MARKETS.join(','));

    const filtered: SharpOddsForFixture[] = rawOdds
      .filter((m: OddsApiMatchOdds) => m.bookmakers && m.bookmakers.length > 0)
      .map((m: OddsApiMatchOdds) => ({
        fixtureId: m.id,
        sportKey: m.sport_key,
        homeTeam: m.home_team,
        awayTeam: m.away_team,
        commenceTime: m.commence_time,
        bookmakers: m.bookmakers
          .filter((b) => ENABLED_SHARP_BOOK_KEYS.includes(b.key))
          .map((b) => ({
            key: b.key,
            title: b.title,
            lastUpdate: b.last_update || null,
            markets: b.markets.map((mkt) => ({
              key: mkt.key,
              outcomes: mkt.outcomes.map((o) => ({
                name: o.name,
                price: o.price,
                point: o.point,
              })),
            })),
          })),
      }))
      .filter((f) => f.bookmakers.length > 0); // exclude fixtures with none of the 4 sharp books

    return { odds: filtered, blocked: false, budgetUsed: budget.used + 1, budgetRemaining: budget.remaining - 1 };
  } catch (err) {
    console.error(`[SharpOdds] Failed to fetch odds for sport ${sport}:`, err);
    return { odds: null, blocked: false, budgetUsed: budget.used, budgetRemaining: budget.remaining };
  }
}

// Lightweight check: will this fetch cost budget?
export { canFetchOdds, getBudgetStatus };
