// Opportunities intelligence service — reads REAL live predictions/odds from
// the database (daily_picks + matches + odds_snapshots) and computes the
// value classification. No synthetic fixtures, no fabricated odds.

import { supabase } from '@/lib/supabase.server';
import { HOMEPAGE_INTELLIGENCE } from '../constants';

export type OpportunitySignal = 'STRONG_VALUE' | 'VALUE' | 'LOW_EDGE' | 'NO_VALUE' | 'NOT_MODELABLE' | 'STALE';

/**
 * Dynamically determines the current football season without hardcoded caps.
 * European leagues running Autumn-Spring: July-Dec = current year, Jan-June = current year - 1.
 * Tournament/calendar-year competitions: current year.
 */
export function getDynamicSeason(date: Date = new Date()): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // 1-12
  return month >= 7 ? year : year - 1;
}

export interface OpportunityRow {
  fixtureId: string;
  competition: string;
  season: string;
  kickoff: string;
  homeTeam: string;
  awayTeam: string;
  market: string;
  line: number | null;
  bookmaker: string;
  odds: number;
  modelProbability: number;
  fairOdds: number;
  edge: number; // 0-1  (modelProb - impliedProb)
  ev: number; // 0-1  (modelProb * odds - 1)
  grade: 'A' | 'B' | 'C' | null;
  modelVersion: string;
  oddsTimestamp: string | null;
  signal: OpportunitySignal;
  stale: boolean;
  fixtureStatus: string;
}

export interface UpcomingFixtureItem {
  fixtureId: string;
  competition: string;
  season: string;
  kickoff: string;
  homeTeam: string;
  awayTeam: string;
  status: 'VALUE_FOUND' | 'MODELABLE_NO_VALUE' | 'MODEL_PENDING' | 'NO_ODDS' | 'STALE';
  statusLabel: string;
  bestEv: number | null;
  bestMarket: string | null;
  marketCount: number;
  hasOdds: boolean;
  hasModel: boolean;
}

export interface FixtureSummary {
  total: number;
  modelable: number;
  withOdds: number;
  withValue: number;
  strongValue: number;
  noOdds: number;
  notModelable: number;
  noPositiveEv: number;
}

export interface OpportunitiesResponse {
  generatedAt: string;
  state: 'READY' | 'NO_FIXTURES' | 'NO_ODDS' | 'NOT_MODELABLE' | 'NO_VALUE' | 'PROVIDER_ERROR' | 'DATABASE_ERROR' | 'BLOCKED';
  fixtures: FixtureSummary;
  opportunities: OpportunityRow[];
  upcomingFixtures: UpcomingFixtureItem[];
  lastOddsUpdate: string | null;
}

const STALE_MS = HOMEPAGE_INTELLIGENCE.oddsStaleAfterMinutes * 60 * 1000;

function classify(ev: number, stale: boolean): OpportunitySignal {
  if (stale) return 'STALE';
  if (ev >= 0.05) return 'STRONG_VALUE';
  if (ev >= 0.02) return 'VALUE';
  if (ev >= 0.0) return 'LOW_EDGE';
  return 'NO_VALUE';
}

function gradeFor(ev: number, stale: boolean): 'A' | 'B' | 'C' | null {
  if (stale) return null;
  if (ev >= 0.15) return 'A';
  if (ev >= 0.05) return 'B';
  if (ev >= 0.02) return 'C';
  return null;
}

function marketFromType(marketType: string): string {
  switch (marketType) {
    case 'MONEYLINE': return 'ML';
    case 'ASIAN_HANDICAP': return 'AH';
    case 'OVER_UNDER': return 'OU';
    case 'BTTS': return 'BTTS';
    default: return marketType || 'ML';
  }
}

export class OpportunitiesService {
  /**
   * Reads live opportunities from the database.
   * Every number is a real database value from daily_picks / matches /
   * odds_snapshots — no hardcoding.
   */
  static async getOpportunities(): Promise<OpportunitiesResponse> {
    const now = new Date();
    const generatedAt = now.toISOString();

    // 1. Fetch upcoming matches (pre-match only).
    let matches: Array<any> | null = null;
    try {
      const { data, error: matchErr } = await supabase
        .from('matches')
        .select('id, league, kickoff, home_team, away_team, status')
        .eq('status', 'upcoming')
        .order('kickoff', { ascending: true });

      if (matchErr) {
        return {
          generatedAt,
          state: 'DATABASE_ERROR',
          fixtures: { total: 0, modelable: 0, withOdds: 0, withValue: 0, strongValue: 0, noOdds: 0, notModelable: 0, noPositiveEv: 0 },
          opportunities: [],
          upcomingFixtures: [],
          lastOddsUpdate: null,
        };
      }
      matches = data;
    } catch {
      return {
        generatedAt,
        state: 'DATABASE_ERROR',
        fixtures: { total: 0, modelable: 0, withOdds: 0, withValue: 0, strongValue: 0, noOdds: 0, notModelable: 0, noPositiveEv: 0 },
        opportunities: [],
        upcomingFixtures: [],
        lastOddsUpdate: null,
      };
    }

    if (!matches || matches.length === 0) {
      return {
        generatedAt,
        state: 'NO_FIXTURES',
        fixtures: { total: 0, modelable: 0, withOdds: 0, withValue: 0, strongValue: 0, noOdds: 0, notModelable: 0, noPositiveEv: 0 },
        opportunities: [],
        upcomingFixtures: [],
        lastOddsUpdate: null,
      };
    }

    const fixtureIds = matches.map((m) => String(m.id));

    // 2. Fetch pending daily picks for these fixtures (real model outputs).
    let picks: Array<any> = [];
    try {
      const { data: picksData } = await supabase
        .from('daily_picks')
        .select('*')
        .in('fixture_id', fixtureIds)
        .eq('status', 'PENDING');
      picks = picksData ?? [];
    } catch {
      picks = [];
    }

    // 3. Fetch most recent odds snapshots for these fixtures (freshness).
    let snapshots: Array<any> = [];
    try {
      const { data: snapData } = await supabase
        .from('odds_snapshots')
        .select('fixture_id, snapshot_time, bookmaker')
        .in('fixture_id', fixtureIds)
        .order('snapshot_time', { ascending: false });
      snapshots = snapData ?? [];
    } catch {
      snapshots = [];
    }

    const lastByFixture = new Map<string, { time: string; bookmaker: string }>();
    for (const s of snapshots) {
      const key = s.fixture_id ? String(s.fixture_id) : '';
      if (!lastByFixture.has(key)) {
        lastByFixture.set(key, { time: s.snapshot_time ?? new Date().toISOString(), bookmaker: s.bookmaker ?? 'pinnacle' });
      }
    }

    const picksByFixture = new Map<string, typeof picks>();
    for (const p of picks) {
      const key = String(p.fixture_id);
      if (!picksByFixture.has(key)) picksByFixture.set(key, []);
      picksByFixture.get(key)!.push(p);
    }

    const opportunities: OpportunityRow[] = [];
    const upcomingFixtures: UpcomingFixtureItem[] = [];
    const summary: FixtureSummary = {
      total: matches.length,
      modelable: 0,
      withOdds: 0,
      withValue: 0,
      strongValue: 0,
      noOdds: 0,
      notModelable: 0,
      noPositiveEv: 0,
    };

    let lastOddsUpdate: string | null = null;
    for (const snap of snapshots) {
      if (snap.snapshot_time && (!lastOddsUpdate || snap.snapshot_time > lastOddsUpdate)) {
        lastOddsUpdate = snap.snapshot_time;
      }
    }

    for (const match of matches) {
      const mid = String(match.id);
      const fixturePicks = picksByFixture.get(mid) ?? [];
      const hasModel = fixturePicks.length > 0;

      // Modelable = has at least one pick (meaning model produced output for it).
      if (hasModel) summary.modelable++;

      // Latest odds freshness for this fixture.
      const latestOddsForFixture = lastByFixture.get(mid);
      let stale = false;
      let hasOdds = false;

      if (latestOddsForFixture) {
        hasOdds = true;
        const age = now.getTime() - new Date(latestOddsForFixture.time).getTime();
        stale = age > STALE_MS;
      } else {
        summary.noOdds++;
      }

      let bestEvForFixture: number | null = null;
      let bestMarketForFixture: string | null = null;

      for (const pick of fixturePicks) {
        const ev = Number(pick.edge_pct ?? 0) / 100;
        const modelProb = Number(pick.model_probability ?? 0);
        const marketOdds = Number(pick.market_odds ?? 0);
        const fairOdds = Number(pick.fair_odds ?? (modelProb > 0 ? 1 / modelProb : 0));
        const signal = classify(ev, stale);
        const grade = gradeFor(ev, stale);

        if (bestEvForFixture === null || ev > bestEvForFixture) {
          bestEvForFixture = ev;
          bestMarketForFixture = marketFromType(pick.market_type);
        }

        let line: number | null = null;
        const marketType = pick.market_type;
        if (marketType === 'ASIAN_HANDICAP') {
          const m = String(pick.prediction ?? '').match(/[-+]?\d+(?:\.\d+)?/);
          if (m) line = parseFloat(m[0]);
        }

        if (marketOdds > 0) summary.withOdds++;
        if (ev >= 0.02) summary.withValue++;
        if (ev >= 0.05) summary.strongValue++;
        if (ev >= 0 && ev < 0.02) summary.noPositiveEv++;

        opportunities.push({
          fixtureId: mid,
          competition: match.league ?? 'Unknown',
          season: String(getDynamicSeason(new Date(match.kickoff || now))),
          kickoff: match.kickoff,
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          market: marketFromType(pick.market_type),
          line,
          bookmaker: pick.market_bookmaker ?? 'Pinnacle',
          odds: marketOdds,
          modelProbability: modelProb,
          fairOdds: Number(fairOdds.toFixed(4)),
          edge: modelProb > 0 && marketOdds > 0 ? Number((modelProb - 1 / marketOdds).toFixed(4)) : 0,
          ev: Number(ev.toFixed(4)),
          grade,
          modelVersion: HOMEPAGE_INTELLIGENCE.modelVersion,
          oddsTimestamp: latestOddsForFixture?.time ?? null,
          signal,
          stale,
          fixtureStatus: 'upcoming',
        });
      }

      // Determine overall fixture status
      let fixtureStatus: UpcomingFixtureItem['status'] = 'MODEL_PENDING';
      let statusLabel = 'Model pending';

      if (!hasModel) {
        fixtureStatus = 'MODEL_PENDING';
        statusLabel = 'Model pending';
      } else if (stale) {
        fixtureStatus = 'STALE';
        statusLabel = 'Stale odds';
      } else if (bestEvForFixture !== null && bestEvForFixture >= 0.02) {
        fixtureStatus = 'VALUE_FOUND';
        statusLabel = `Value Opportunity (${bestMarketForFixture ? bestMarketForFixture + ' ' : ''}+${(bestEvForFixture * 100).toFixed(1)}% EV)`;
      } else if (hasOdds || (bestEvForFixture !== null && bestEvForFixture >= 0)) {
        fixtureStatus = 'MODELABLE_NO_VALUE';
        statusLabel = 'Modelable · No positive EV';
      } else {
        fixtureStatus = 'NO_ODDS';
        statusLabel = 'No odds';
      }

      upcomingFixtures.push({
        fixtureId: mid,
        competition: match.league ?? 'Unknown',
        season: String(getDynamicSeason(new Date(match.kickoff || now))),
        kickoff: match.kickoff,
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        status: fixtureStatus,
        statusLabel,
        bestEv: bestEvForFixture,
        bestMarket: bestMarketForFixture,
        marketCount: fixturePicks.length,
        hasOdds,
        hasModel,
      });
    }

    // Sort by EV descending (quality filter: only include non-stale,
    // positive-EV opportunities for the "best value" section).
    opportunities.sort((a, b) => b.ev - a.ev);

    const nonStalePositive = opportunities.filter((o) => !o.stale && o.ev >= 0.02);
    const state: OpportunitiesResponse['state'] =
      opportunities.length === 0 ? 'NOT_MODELABLE'
        : summary.withValue === 0 ? 'NO_VALUE'
        : 'READY';

    return {
      generatedAt,
      state,
      fixtures: summary,
      opportunities: nonStalePositive,
      upcomingFixtures,
      lastOddsUpdate,
    };
  }
}