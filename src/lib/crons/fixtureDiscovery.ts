// EPIC 56 — Worldwide Fixture Discovery (Dynamic)
// Discovers upcoming fixtures from API-Football for all active leagues in the DB.
// Returns ranked fixtures with priority scores for quota-aware scheduling.

import { apiFootballClient, type ApiFootballFixtureResponseItem } from '@/lib/apis/apifootball';
import { acquire, logCall } from '@/lib/providers/quotaManager';
import { supabase } from '@/lib/supabase.server';

export interface ScoredFixture {
  fixtureId: number;
  leagueId: number;
  leagueName: string;
  leagueTier: number;
  homeTeam: string;
  homeTeamId: number;
  awayTeam: string;
  awayTeamId: number;
  kickoff: Date;
  status: string;
  priorityScore: number;
}

// Priority score: 0-100
// Factors: league tier, time until kickoff, whether lineups could be available
function computePriorityScore(leagueTier: number, kickoff: Date, now: Date): number {
  let score = 0;

  // League tier: tier 1 = 40 pts, tier 2 = 30, tier 3 = 20, tier 4 = 10, tier 5 = 5, tier 6 = 0
  score += Math.max(0, 40 - (leagueTier - 1) * 10);

  // Time proximity: T-120 to T-60 is the critical window
  const msUntilKickoff = kickoff.getTime() - now.getTime();
  const hoursUntilKickoff = msUntilKickoff / (1000 * 60 * 60);

  if (hoursUntilKickoff <= 0) {
    // Live or recently started — moderate priority (lineups already out)
    score += 20;
  } else if (hoursUntilKickoff <= 1) {
    // T-60 — critical window, lineups announced
    score += 40;
  } else if (hoursUntilKickoff <= 2) {
    // T-120 — pre-lineup odds window
    score += 35;
  } else if (hoursUntilKickoff <= 6) {
    // Same day
    score += 25;
  } else if (hoursUntilKickoff <= 24) {
    // Tomorrow
    score += 15;
  } else {
    // Future
    score += 5;
  }

  return Math.min(100, score);
}

// Discover fixtures for all active leagues, scored and sorted.
// Every API call goes through QuotaManager.acquire().
export async function discoverFixtures(): Promise<{
  fixtures: ScoredFixture[];
  skipped: number;
  quotaOk: boolean;
}> {
  const now = new Date();
  const allFixtures: ScoredFixture[] = [];
  let skipped = 0;

  // Load active AND unknown leagues (newly synced leagues start as 'unknown')
  const { data: leagues, error } = await supabase
    .from('league_efficiency')
    .select('*')
    .in('season_status', ['active', 'unknown'])
    .order('adaptive_priority', { ascending: false });

  // Cache quota once to avoid N+1 Supabase queries per league
  const receiptCache = await acquire('apifootball', 'fixtures', 60);
  const canFetch = receiptCache.ok;

  if (!leagues || error || !canFetch) {
    if (error) console.error('[FixtureDiscovery] Failed:', error.message);
    if (!canFetch) console.warn('[FixtureDiscovery] Quota exhausted');
    return { fixtures: [], skipped: 0, quotaOk: canFetch };
  }

  for (const league of leagues) {
    // Use cached quota check — no N+1 Supabase queries

    try {
      const startTime = Date.now();
      // Free plan supports seasons 2022-2024. Try 2024 as latest accessible.
      const season = Math.min(new Date().getFullYear() - 1, 2024);
      const response = await apiFootballClient.getFixtures(league.league_id, season);
      await logCall('apifootball', 'fixtures', Date.now() - startTime, 200, {
        leagueId: league.league_id,
        results: response.results,
      });

      // Filter to upcoming/live fixtures
      for (const item of response.response) {
        const kickoff = new Date(item.fixture.date);
        const status = item.fixture.status.short;

        // Skip already finished (FT, AET, PEN, CANC, ABD, POSTP)
        if (['FT', 'AET', 'PEN', 'CANC', 'ABD', 'POSTP'].includes(status)) continue;

        const score = computePriorityScore(league.league_priority || 6, kickoff, now);
        allFixtures.push({
          fixtureId: item.fixture.id,
          leagueId: league.league_id,
          leagueName: league.league_name,
          leagueTier: league.league_priority || 6,
          homeTeam: item.teams.home.name,
          homeTeamId: item.teams.home.id,
          awayTeam: item.teams.away.name,
          awayTeamId: item.teams.away.id,
          kickoff,
          status,
          priorityScore: score,
        });
      }
    } catch (err) {
      console.error(`[FixtureDiscovery] Failed for league ${league.league_name} (${league.league_id}):`, err);
      skipped += 1;
    }
  }

  // Sort descending by priority score
  allFixtures.sort((a, b) => b.priorityScore - a.priorityScore);

  return { fixtures: allFixtures, skipped, quotaOk: true };
}

// Get only the fixtures eligible for a T-60 snapshot (kickoff in [30m, 90m])
export function getCriticalWindowFixtures(fixtures: ScoredFixture[], now: Date): ScoredFixture[] {
  return fixtures.filter((f) => {
    const msUntil = f.kickoff.getTime() - now.getTime();
    const minutesUntil = msUntil / (1000 * 60);
    return minutesUntil >= 30 && minutesUntil <= 90;
  });
}

