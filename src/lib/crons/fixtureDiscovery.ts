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

  const { data: leagues, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('is_active', true)
    .order('priority_score', { ascending: false });

  if (error || !leagues) {
    console.error('[FixtureDiscovery] Failed to fetch active leagues:', error);
    return { fixtures: [], skipped: 0, quotaOk: true };
  }

  for (const league of leagues) {
    const receipt = await acquire('apifootball', 'fixtures', 60); // Priority 60
    if (!receipt.ok) {
      skipped += 1;
      continue;
    }

    try {
      const startTime = Date.now();
      const response = await apiFootballClient.getFixtures(league.id, league.season || new Date().getFullYear());
      await logCall('apifootball', 'fixtures', Date.now() - startTime, 200, {
        leagueId: league.id,
        results: response.results,
      });

      // Filter to upcoming/live fixtures
      for (const item of response.response) {
        const kickoff = new Date(item.fixture.date);
        const status = item.fixture.status.short;

        // Skip already finished (FT, AET, PEN, CANC, ABD, POSTP)
        if (['FT', 'AET', 'PEN', 'CANC', 'ABD', 'POSTP'].includes(status)) continue;

        const score = computePriorityScore(league.tier || 6, kickoff, now);
        allFixtures.push({
          fixtureId: item.fixture.id,
          leagueId: league.id,
          leagueName: league.name,
          leagueTier: league.tier || 6,
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
      console.error(`[FixtureDiscovery] Failed for league ${league.name} (${league.id}):`, err);
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

