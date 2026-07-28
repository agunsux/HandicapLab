// EPIC 53 Stage B — Worldwide Fixture Discovery
// Discovers upcoming fixtures from API-Football for all supported leagues.
// Returns ranked fixtures with priority scores for quota-aware scheduling.

import { apiFootballClient, type ApiFootballFixtureResponseItem } from '@/lib/apis/apifootball';
import { LEAGUE_PRIORITIES, type LeaguePriority } from '@/lib/config/leaguePriorities';
import { canProceed, logProviderCall } from '@/lib/providers/quotaManager';

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
function computePriorityScore(league: LeaguePriority, kickoff: Date, now: Date): number {
  let score = 0;

  // League tier: tier 1 = 40 pts, tier 2 = 30, tier 3 = 20, tier 4 = 10, tier 5 = 5, tier 6 = 0
  score += Math.max(0, 40 - (league.tier - 1) * 10);

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

// Discover fixtures for all supported leagues, scored and sorted.
// Only runs if quota allows for apifootball at 'normal' priority.
export async function discoverFixtures(): Promise<{
  fixtures: ScoredFixture[];
  skipped: number;
  quotaOk: boolean;
}> {
  const check = await canProceed('apifootball', 'normal');
  if (!check.allowed) {
    console.warn(`[FixtureDiscovery] Skipped: ${check.reason}`);
    return { fixtures: [], skipped: 0, quotaOk: false };
  }

  const now = new Date();
  const allFixtures: ScoredFixture[] = [];
  let skipped = 0;

  for (const league of LEAGUE_PRIORITIES) {
    // Check quota before each league fetch
    const leagueCheck = await canProceed('apifootball', 'normal');
    if (!leagueCheck.allowed) {
      skipped += 1;
      continue;
    }

    try {
      const startTime = Date.now();
      const response = await apiFootballClient.getFixtures(league.apiFootballId, league.season);
      await logProviderCall('apifootball', 'fixtures', Date.now() - startTime, 200, {
        leagueId: league.apiFootballId,
        results: response.results,
      });

      // Filter to upcoming/live fixtures
      for (const item of response.response) {
        const kickoff = new Date(item.fixture.date);
        const status = item.fixture.status.short;

        // Skip already finished (FT, AET, PEN, CANC, ABD, POSTP)
        if (['FT', 'AET', 'PEN', 'CANC', 'ABD', 'POSTP'].includes(status)) continue;

        const score = computePriorityScore(league, kickoff, now);
        allFixtures.push({
          fixtureId: item.fixture.id,
          leagueId: league.apiFootballId,
          leagueName: league.name,
          leagueTier: league.tier,
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
      console.error(`[FixtureDiscovery] Failed for league ${league.name} (${league.apiFootballId}):`, err);
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
