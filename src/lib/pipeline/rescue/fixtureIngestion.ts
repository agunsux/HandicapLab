// ============================================================================
// SALMO RESCUE PIPELINE — FIXTURE INGESTION & DATA GUARD
// Namespace: src/lib/pipeline/rescue/fixtureIngestion.ts
// Invariants enforced:
// 1. Whitelist only: Top Leagues + Liga 1 Indonesia.
// 2. Caches team-season statistics with 12h TTL (prevents API-Football quota burn).
// 3. Liga 1 Indonesia Data Guard: If home/away games < 5, skip prediction and log LIGA1_LOW_COVERAGE.
// 4. Returns empty array gracefully if zero eligible fixtures exist (SUCCESS_EMPTY).
// ============================================================================

import { apiFootballClient } from '@/lib/apis/apifootball';
import { WhitelistLeague } from './types';

export const WHITELIST_LEAGUES: WhitelistLeague[] = [
  { id: 39, name: 'Premier League', country: 'England', min_sample_size: 5 },
  { id: 40, name: 'Championship', country: 'England', min_sample_size: 5 },
  { id: 135, name: 'Serie A', country: 'Italy', min_sample_size: 5 },
  { id: 78, name: 'Bundesliga', country: 'Germany', min_sample_size: 5 },
  { id: 140, name: 'La Liga', country: 'Spain', min_sample_size: 5 },
  { id: 61, name: 'Ligue 1', country: 'France', min_sample_size: 5 },
  { id: 88, name: 'Eredivisie', country: 'Netherlands', min_sample_size: 5 },
  { id: 98, name: 'J1 League', country: 'Japan', min_sample_size: 5 },
  { id: 292, name: 'K League 1', country: 'Korea', min_sample_size: 5 },
  { id: 279, name: 'Liga 1 Indonesia', country: 'Indonesia', min_sample_size: 5 },
];

export interface ProcessedRescueFixture {
  fixtureId: number;
  match: string;
  homeTeam: string;
  homeTeamId: number;
  awayTeam: string;
  awayTeamId: number;
  competition: string;
  competitionId: number;
  season: number;
  kickoffUtc: string;
  status: string;
  lambdaHome: number;
  lambdaAway: number;
  sampleSizeHome: number;
  sampleSizeAway: number;
  eligible: boolean;
  skipReason?: string;
  dataQualityFlags: string[];
}

interface CachedTeamStats {
  teamId: number;
  gamesPlayed: number;
  goalsScoredAvg: number;
  goalsConcededAvg: number;
  cachedAt: number;
}

export class RescueFixtureIngestion {
  private static statsCache = new Map<string, CachedTeamStats>();
  private static readonly STATS_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

  public static async getTeamStatsCached(
    teamId: number,
    leagueId: number,
    season: number
  ): Promise<CachedTeamStats> {
    const key = `${teamId}:${season}:${leagueId}`;
    const now = Date.now();
    const existing = this.statsCache.get(key);

    if (existing && now - existing.cachedAt < this.STATS_CACHE_TTL_MS) {
      return existing;
    }

    try {
      const statsRes: any = await apiFootballClient.getTeamStatistics({ league: leagueId, season, team: teamId });
      const statsData = statsRes?.response || statsRes;
      const fixt = statsData?.fixtures;
      const goals = statsData?.goals;

      const gamesPlayed = fixt?.played?.total ?? 0;
      const goalsScoredAvg = Number(goals?.for?.average?.total ?? 1.2);
      const goalsConcededAvg = Number(goals?.against?.average?.total ?? 1.2);

      const entry: CachedTeamStats = {
        teamId,
        gamesPlayed,
        goalsScoredAvg: isNaN(goalsScoredAvg) ? 1.2 : goalsScoredAvg,
        goalsConcededAvg: isNaN(goalsConcededAvg) ? 1.2 : goalsConcededAvg,
        cachedAt: now,
      };

      this.statsCache.set(key, entry);
      return entry;
    } catch (e: any) {
      console.warn(`[RescueFixtureIngestion] Failed to fetch stats for team ${teamId}:`, e?.message);
      return {
        teamId,
        gamesPlayed: 0,
        goalsScoredAvg: 1.2,
        goalsConcededAvg: 1.2,
        cachedAt: now,
      };
    }
  }

  public static async ingestFixturesForDate(
    dateStr: string,
    season: number = 2026
  ): Promise<{ fixtures: ProcessedRescueFixture[]; dataQualityFlags: string[] }> {
    const processedList: ProcessedRescueFixture[] = [];
    const runDataQualityFlags: Set<string> = new Set();

    let rawFixtures: any[] = [];
    try {
      const res: any = await apiFootballClient.getFixturesByDate(dateStr);
      rawFixtures = Array.isArray(res) ? res : res?.response || [];
    } catch (e: any) {
      console.warn(`[RescueFixtureIngestion] Error querying fixtures for ${dateStr}:`, e?.message);
      return { fixtures: [], dataQualityFlags: ['API_FOOTBALL_FIXTURE_QUERY_ERROR'] };
    }

    if (!Array.isArray(rawFixtures) || rawFixtures.length === 0) {
      return { fixtures: [], dataQualityFlags: [] };
    }

    const whitelistMap = new Map<number, WhitelistLeague>(
      WHITELIST_LEAGUES.map((l) => [l.id, l])
    );

    const eligibleMatches = rawFixtures.filter((item) => {
      const lId = item.league?.id;
      return lId && whitelistMap.has(lId);
    });

    for (const item of eligibleMatches) {
      const fixtureId = Number(item.fixture?.id);
      const leagueId = Number(item.league?.id);
      const leagueMeta = whitelistMap.get(leagueId)!;
      const homeTeam = item.teams?.home?.name || 'Home';
      const homeTeamId = Number(item.teams?.home?.id);
      const awayTeam = item.teams?.away?.name || 'Away';
      const awayTeamId = Number(item.teams?.away?.id);
      const kickoffUtc = item.fixture?.date || new Date().toISOString();
      const status = item.fixture?.status?.short || 'NS';

      const flags: string[] = [];

      const homeStats = await this.getTeamStatsCached(homeTeamId, leagueId, season);
      const awayStats = await this.getTeamStatsCached(awayTeamId, leagueId, season);

      let isEligible = true;
      let skipReason: string | undefined;

      if (leagueId === 279) {
        if (homeStats.gamesPlayed < 5 || awayStats.gamesPlayed < 5) {
          isEligible = false;
          skipReason = 'INSUFFICIENT_SAMPLE';
          flags.push('LIGA1_LOW_COVERAGE');
          runDataQualityFlags.add('LIGA1_LOW_COVERAGE');
        }
      } else {
        if (homeStats.gamesPlayed < leagueMeta.min_sample_size || awayStats.gamesPlayed < leagueMeta.min_sample_size) {
          isEligible = false;
          skipReason = 'INSUFFICIENT_SAMPLE';
          flags.push('LOW_SAMPLE_SIZE');
          runDataQualityFlags.add('LOW_SAMPLE_SIZE');
        }
      }

      const lambdaHome = Math.max(0.4, Number(((homeStats.goalsScoredAvg + awayStats.goalsConcededAvg) / 2.0).toFixed(2)));
      const lambdaAway = Math.max(0.4, Number(((awayStats.goalsScoredAvg + homeStats.goalsConcededAvg) / 2.0).toFixed(2)));

      processedList.push({
        fixtureId,
        match: `${homeTeam} vs ${awayTeam}`,
        homeTeam,
        homeTeamId,
        awayTeam,
        awayTeamId,
        competition: leagueMeta.name,
        competitionId: leagueId,
        season,
        kickoffUtc,
        status,
        lambdaHome,
        lambdaAway,
        sampleSizeHome: homeStats.gamesPlayed,
        sampleSizeAway: awayStats.gamesPlayed,
        eligible: isEligible,
        skipReason,
        dataQualityFlags: flags,
      });
    }

    return {
      fixtures: processedList,
      dataQualityFlags: Array.from(runDataQualityFlags),
    };
  }

  public static clearCache(): void {
    this.statsCache.clear();
  }
}
