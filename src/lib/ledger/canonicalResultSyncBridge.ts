import { CanonicalFixtureFreshnessGate, CanonicalFixtureRecord } from '@/lib/services/canonicalFixtureFreshnessGate';
import { apiFootballClient } from '@/lib/apis/apifootball';
import { hasApiFootballKey } from '@/lib/providers/providerKey';

export interface ResultSyncOptions {
  nowMs?: number;
  fixtureIds?: string[];
  maxAgeHours?: number;
}

export interface ResultSyncReport {
  scannedCount: number;
  updatedToFinished: number;
  skippedCount: number;
  errors: string[];
}

export class CanonicalResultSyncBridge {
  /**
   * Synchronizes completed fixtures from API-Football into the Canonical Fixture Registry.
   * Updates match status from SCHEDULED/TIMED to FINISHED with verified final scores (FT).
   */
  public static async syncCompletedFixtures(
    options: ResultSyncOptions = {}
  ): Promise<ResultSyncReport> {
    const nowMs = options.nowMs ?? Date.now();
    const report: ResultSyncReport = {
      scannedCount: 0,
      updatedToFinished: 0,
      skippedCount: 0,
      errors: [],
    };

    try {
      const registry = CanonicalFixtureFreshnessGate.loadRegistry();
      const fixtures = Object.values(registry);

      // Identify fixtures that have kicked off and might be completed (>= 105 minutes since kickoff)
      const MATCH_DURATION_MS = 105 * 60 * 1000;
      const candidates = fixtures.filter((f) => {
        if (options.fixtureIds && !options.fixtureIds.includes(f.canonicalMatchId)) {
          return false;
        }
        if (f.status === 'FINISHED') {
          return false;
        }
        const kickoffMs = new Date(f.kickoffUtc).getTime();
        return !isNaN(kickoffMs) && kickoffMs + MATCH_DURATION_MS <= nowMs;
      });

      report.scannedCount = candidates.length;

      if (candidates.length === 0) {
        return report;
      }

      // If no API-Football key is configured or in test without explicit live calls, skip network
      if (!hasApiFootballKey() || process.env.NODE_ENV === 'test') {
        report.skippedCount = candidates.length;
        return report;
      }

      // For candidate fixtures with providerMatchId, fetch current status from API-Football
      for (const cand of candidates) {
        if (!cand.providerMatchId) {
          report.skippedCount++;
          continue;
        }

        try {
          const fixtureId = parseInt(cand.providerMatchId, 10);
          if (isNaN(fixtureId)) {
            report.skippedCount++;
            continue;
          }

          const item = await apiFootballClient.getFixtureById(fixtureId);

          if (!item) {
            report.skippedCount++;
            continue;
          }

          const statusShort = item.fixture?.status?.short;
          const isFinished = statusShort === 'FT' || statusShort === 'AET' || statusShort === 'PEN';
          const isCancelled = statusShort === 'CANC' || statusShort === 'PST';
          const isAbandoned = statusShort === 'ABD';

          if (isFinished) {
            const homeScore = item.goals?.home;
            const awayScore = item.goals?.away;

            if (homeScore !== null && homeScore !== undefined && awayScore !== null && awayScore !== undefined) {
              CanonicalFixtureFreshnessGate.upsertFixture({
                canonicalMatchId: cand.canonicalMatchId,
                providerMatchId: cand.providerMatchId,
                homeTeam: cand.homeTeam,
                awayTeam: cand.awayTeam,
                competition: cand.competition,
                season: cand.season,
                kickoffUtc: cand.kickoffUtc,
                status: 'FINISHED',
                provider: cand.provider,
                homeGoals: homeScore,
                awayGoals: awayScore,
                metadata: {
                  ...cand.metadata,
                  statusShort,
                  scoreElapsed: item.fixture?.status?.elapsed ?? 90,
                },
              });
              report.updatedToFinished++;
            } else {
              report.skippedCount++;
            }
          } else if (isCancelled) {
            CanonicalFixtureFreshnessGate.upsertFixture({
              canonicalMatchId: cand.canonicalMatchId,
              providerMatchId: cand.providerMatchId,
              homeTeam: cand.homeTeam,
              awayTeam: cand.awayTeam,
              competition: cand.competition,
              season: cand.season,
              kickoffUtc: cand.kickoffUtc,
              status: 'CANCELLED',
              provider: cand.provider,
            });
            report.updatedToFinished++;
          } else if (isAbandoned) {
            CanonicalFixtureFreshnessGate.upsertFixture({
              canonicalMatchId: cand.canonicalMatchId,
              providerMatchId: cand.providerMatchId,
              homeTeam: cand.homeTeam,
              awayTeam: cand.awayTeam,
              competition: cand.competition,
              season: cand.season,
              kickoffUtc: cand.kickoffUtc,
              status: 'ABANDONED',
              provider: cand.provider,
            });
            report.updatedToFinished++;
          } else {
            report.skippedCount++;
          }
        } catch (itemErr: any) {
          report.errors.push(`Fixture ${cand.canonicalMatchId}: ${itemErr?.message}`);
        }
      }
    } catch (err: any) {
      report.errors.push(`General error: ${err?.message}`);
    }

    return report;
  }
}
