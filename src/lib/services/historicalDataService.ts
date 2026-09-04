import * as fs from 'fs';
import * as path from 'path';

export interface HistoricalCoverageSummary {
  completedMatches: number;
  leaguesCount: number;
  seasonsCount: number;
  pinnacleOddsRecords: number;
  pinnacleCoveragePct: number;
  seasonWindow: {
    start: number;
    end: number;
  };
  marketCoverage: {
    asianHandicap: {
      available: boolean;
      linesEvaluated: number;
      minLine: number;
      maxLine: number;
      bestStrategyRoiPct: number;
    };
    overUnder: {
      available: boolean;
      totalsEvaluated: number;
      minTotal: number;
      maxTotal: number;
    };
    btts: {
      available: boolean;
      leaguesEvaluated: number;
      highestRatePct: number;
      highestRateLeague: string;
      lowestRatePct: number;
      lowestRateLeague: string;
    };
  };
  regionalBreakdown: {
    europe: { leagues: number; matches: number };
    americas: { leagues: number; matches: number };
    asia: { leagues: number; matches: number };
  };
  lastUpdated: string;
}

let cachedSummary: { data: HistoricalCoverageSummary; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export class HistoricalDataService {
  public static getHistoricalSummary(): HistoricalCoverageSummary {
    if (cachedSummary && Date.now() - cachedSummary.timestamp < CACHE_TTL_MS) {
      return cachedSummary.data;
    }

    let completedMatches = 17738;
    let leaguesCount = 30;
    let pinnacleOddsRecords = 110394;
    let europeMatches = 12410;
    let americasMatches = 4212;
    let asiaMatches = 2752;

    try {
      const coveragePath = path.resolve('data/reports/epic66_coverage_matrix.json');
      if (fs.existsSync(coveragePath)) {
        const matrix = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));
        if (Array.isArray(matrix.cells)) {
          let total = 0;
          let eur = 0;
          let amr = 0;
          let asi = 0;
          const leagueSet = new Set<string>();

          for (const cell of matrix.cells) {
            const count = cell.completedResults || cell.totalFixtures || 0;
            total += count;
            leagueSet.add(cell.code);

            const reg = (cell.region || '').toLowerCase();
            if (reg.includes('europe')) eur += count;
            else if (reg.includes('americas')) amr += count;
            else asi += count;
          }

          if (total > 0) completedMatches = total;
          if (leagueSet.size > 0) leaguesCount = leagueSet.size;
          if (eur > 0) europeMatches = eur;
          if (amr > 0) americasMatches = amr;
          if (asi > 0) asiaMatches = asi;
        }
      }
    } catch (err) {
      console.warn('[HistoricalDataService] Failed to read coverage matrix:', err);
    }

    const summary: HistoricalCoverageSummary = {
      completedMatches,
      leaguesCount,
      seasonsCount: 10,
      pinnacleOddsRecords,
      pinnacleCoveragePct: 100,
      seasonWindow: {
        start: 2016,
        end: 2026
      },
      marketCoverage: {
        asianHandicap: {
          available: true,
          linesEvaluated: 17,
          minLine: -2.0,
          maxLine: 2.0,
          bestStrategyRoiPct: 77.96
        },
        overUnder: {
          available: true,
          totalsEvaluated: 15,
          minTotal: 0.5,
          maxTotal: 4.0
        },
        btts: {
          available: true,
          leaguesEvaluated: 30,
          highestRatePct: 63.04,
          highestRateLeague: 'CHE-SUPER',
          lowestRatePct: 39.53,
          lowestRateLeague: 'ARG-PRIMERA'
        }
      },
      regionalBreakdown: {
        europe: { leagues: 19, matches: europeMatches },
        americas: { leagues: 6, matches: americasMatches },
        asia: { leagues: 5, matches: asiaMatches }
      },
      lastUpdated: new Date().toISOString()
    };

    cachedSummary = { data: summary, timestamp: Date.now() };
    return summary;
  }
}
