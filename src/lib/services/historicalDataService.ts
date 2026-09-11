import * as fs from 'fs';
import * as path from 'path';

import { deriveDataState, type DataState } from '@/lib/data/dataState';

// ============================================================================
// Historical evidence service — REAL DATA ONLY.
// ============================================================================
// Every number returned here is read from a persisted, reproducible artifact:
//   - data/reports/homepage_backtest_latest.json  (walk-forward backtest)
//   - data/reports/epic66_coverage_matrix.json    (coverage counts)
// When an artifact is missing or a metric is absent, the value is null and the
// data state says so. No hardcoded fallbacks, no fabricated coverage claims.

export interface HistoricalBacktestMarket {
  market: string;
  totalBets: number;
  winRatePct: number;
  roiPct: number;
  avgClvPct: number | null;
  brierScore: number | null;
}

export interface HistoricalBacktestSummary {
  status: string | null;
  datasetVersion: string | null;
  modelVersion: string | null;
  methodology: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  matchesTested: number | null;
  totalBets: number | null;
  roiPct: number | null;
  avgClvPct: number | null;
  brierScore: number | null;
  logLoss: number | null;
  maxDrawdown: number | null;
  ci95: { low: number; high: number } | null;
  markets: HistoricalBacktestMarket[];
  dataState: DataState;
  sourceFile: string;
}

export interface HistoricalCoverageSummary {
  completedMatches: number | null;
  leaguesCount: number | null;
  seasonsCount: number | null;
  pinnacleOddsRecords: number | null;
  pinnacleCoveragePct: number | null;
  seasonWindow: {
    start: number;
    end: number;
  } | null;
  marketCoverage: {
    asianHandicap: {
      available: boolean;
      linesEvaluated: number | null;
      minLine: number | null;
      maxLine: number | null;
      bestStrategyRoiPct: number | null;
    };
    overUnder: {
      available: boolean;
      totalsEvaluated: number | null;
      minTotal: number | null;
      maxTotal: number | null;
    };
    btts: {
      available: boolean;
      leaguesEvaluated: number | null;
      highestRatePct: number | null;
      highestRateLeague: string | null;
      lowestRatePct: number | null;
      lowestRateLeague: string | null;
    };
  };
  regionalBreakdown: {
    europe: { leagues: number | null; matches: number | null };
    americas: { leagues: number | null; matches: number | null };
    asia: { leagues: number | null; matches: number | null };
  };
  backtest: HistoricalBacktestSummary | null;
  dataState: DataState;
  lastUpdated: string;
  sources: string[];
}

let cachedSummary: { data: HistoricalCoverageSummary; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function readJson(file: string): any | null {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    console.warn(`[HistoricalDataService] Failed to read ${file}:`, err);
    return null;
  }
}

export class HistoricalDataService {
  public static getHistoricalSummary(): HistoricalCoverageSummary {
    if (cachedSummary && Date.now() - cachedSummary.timestamp < CACHE_TTL_MS) {
      return cachedSummary.data;
    }

    const sources: string[] = [];

    // ── 1. Real walk-forward backtest artifact ─────────────────────────
    const backtestPath = path.resolve('data/reports/homepage_backtest_latest.json');
    const backtestRaw = readJson(backtestPath);
    let backtest: HistoricalBacktestSummary | null = null;

    if (backtestRaw) {
      sources.push('data/reports/homepage_backtest_latest.json');
      const markets: HistoricalBacktestMarket[] = Array.isArray(backtestRaw.markets)
        ? backtestRaw.markets.map((m: any) => ({
            market: String(m.market ?? 'UNKNOWN'),
            totalBets: Number(m.totalBets ?? 0),
            winRatePct: Number(m.winRate ?? 0),
            roiPct: Number(m.roiPct ?? 0),
            avgClvPct: m.avgClvPct != null ? Number(m.avgClvPct) : null,
            brierScore: m.brierScore != null ? Number(m.brierScore) : null,
          }))
        : [];

      const totalBets = backtestRaw.totalBets != null ? Number(backtestRaw.totalBets) : null;
      backtest = {
        status: backtestRaw.status ?? null,
        datasetVersion: backtestRaw.datasetVersion ?? null,
        modelVersion: backtestRaw.modelVersion ?? null,
        methodology: backtestRaw.methodology ?? null,
        windowStart: backtestRaw.windowStart ?? null,
        windowEnd: backtestRaw.windowEnd ?? null,
        matchesTested: backtestRaw.matchesTested != null ? Number(backtestRaw.matchesTested) : null,
        totalBets,
        roiPct: backtestRaw.roiPct != null ? Number(backtestRaw.roiPct) : null,
        avgClvPct: backtestRaw.avgClvPct != null ? Number(backtestRaw.avgClvPct) : null,
        brierScore: backtestRaw.brierScore != null ? Number(backtestRaw.brierScore) : null,
        logLoss: backtestRaw.logLoss != null ? Number(backtestRaw.logLoss) : null,
        maxDrawdown: backtestRaw.maxDrawdown != null ? Number(backtestRaw.maxDrawdown) : null,
        ci95:
          backtestRaw.ci95Low != null && backtestRaw.ci95High != null
            ? { low: Number(backtestRaw.ci95Low), high: Number(backtestRaw.ci95High) }
            : null,
        markets,
        dataState: deriveDataState({
          hasData: true,
          sampleSize: totalBets ?? 0,
          minSample: 100,
        }),
        sourceFile: 'data/reports/homepage_backtest_latest.json',
      };
    }

    // ── 2. Coverage counts from the persisted coverage matrix ──────────
    const coveragePath = path.resolve('data/reports/epic66_coverage_matrix.json');
    const matrix = readJson(coveragePath);

    let completedMatches: number | null = null;
    let leaguesCount: number | null = null;
    let pinnacleOddsRecords: number | null = null;
    let seasonStart: number | null = null;
    let seasonEnd: number | null = null;
    let europeMatches: number | null = null;
    let americasMatches: number | null = null;
    let asiaMatches: number | null = null;

    if (matrix && Array.isArray(matrix.cells)) {
      sources.push('data/reports/epic66_coverage_matrix.json');

      let total = 0;
      let pinnacleTotal = 0;
      const leagueSet = new Set<string>();
      let eur = 0;
      let amr = 0;
      let asi = 0;

      for (const cell of matrix.cells) {
        const count = Number(cell.completedResults ?? cell.totalFixtures ?? 0);
        total += count;
        leagueSet.add(String(cell.code ?? ''));
        pinnacleTotal += Number(cell.pinnacleOddsCount ?? 0);

        const seasonMatch = String(cell.season ?? '').match(/(\d{4})/g);
        if (seasonMatch) {
          for (const year of seasonMatch) {
            const y = parseInt(year, 10);
            if (seasonStart === null || y < seasonStart) seasonStart = y;
            if (seasonEnd === null || y > seasonEnd) seasonEnd = y;
          }
        }

        const reg = String(cell.region ?? '').toLowerCase();
        if (reg.includes('europe')) eur += count;
        else if (reg.includes('americas')) amr += count;
        else asi += count;
      }

      completedMatches = total;
      leaguesCount = leagueSet.size;
      pinnacleOddsRecords = pinnacleTotal;
      europeMatches = eur;
      americasMatches = amr;
      asiaMatches = asi;
    }

    const pinnacleCoveragePct =
      completedMatches != null && completedMatches > 0 && pinnacleOddsRecords != null
        ? Number(((pinnacleOddsRecords / completedMatches) * 100).toFixed(2))
        : null;

    const summary: HistoricalCoverageSummary = {
      completedMatches,
      leaguesCount,
      seasonsCount:
        seasonStart != null && seasonEnd != null ? seasonEnd - seasonStart + 1 : null,
      pinnacleOddsRecords,
      pinnacleCoveragePct,
      seasonWindow:
        seasonStart != null && seasonEnd != null ? { start: seasonStart, end: seasonEnd } : null,
      marketCoverage: {
        asianHandicap: {
          available: false,
          linesEvaluated: null,
          minLine: null,
          maxLine: null,
          bestStrategyRoiPct: null,
        },
        overUnder: {
          available: false,
          totalsEvaluated: null,
          minTotal: null,
          maxTotal: null,
        },
        btts: {
          available: false,
          leaguesEvaluated: null,
          highestRatePct: null,
          highestRateLeague: null,
          lowestRatePct: null,
          lowestRateLeague: null,
        },
      },
      regionalBreakdown: {
        europe: { leagues: null, matches: europeMatches },
        americas: { leagues: null, matches: americasMatches },
        asia: { leagues: null, matches: asiaMatches },
      },
      backtest,
      dataState: deriveDataState({
        hasData: completedMatches != null || backtest != null,
        sampleSize: backtest?.totalBets ?? completedMatches ?? 0,
        minSample: 100,
        providerStatus:
          pinnacleOddsRecords === 0 ? 'PROVIDER_UNAVAILABLE' : 'OK',
      }),
      lastUpdated: new Date().toISOString(),
      sources,
    };

    cachedSummary = { data: summary, timestamp: Date.now() };
    return summary;
  }
}
