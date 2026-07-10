/**
 * Sprint A5 — Coverage Analyzer
 * ==============================
 * Computes per-league data coverage across a CanonicalDataset.
 *
 * Metrics: fixture coverage, odds coverage, closing odds coverage, AH
 * coverage, OU coverage, moneyline coverage, xG coverage, lineup coverage,
 * injury coverage, weather coverage, and an overall coverage %.
 *
 * Enrichment dimensions (xG, lineups, injuries, weather) are not part of the
 * frozen canonical schema; callers may supply fixture id lists for them via
 * EnrichmentCoverageInput. Absent inputs report 0%.
 *
 * Pure function: deterministic for identical inputs.
 */

import type { CanonicalDataset, CanonicalMatch } from '../dataset/types';
import type {
  CoverageMetric,
  CoverageReport,
  EnrichmentCoverageInput,
  LeagueCoverageSummary,
} from './types';

function metric(present: number, total: number): CoverageMetric {
  const pct = total > 0 ? (100 * present) / total : 0;
  return { total, present, pct: Math.round(pct * 100) / 100 };
}

function hasMarket(match: CanonicalMatch, market: 'ML' | 'AH' | 'OU' | 'BTTS'): boolean {
  return match.odds.some((o) => o.market === market);
}

function hasAnyOdds(match: CanonicalMatch): boolean {
  return match.odds.length > 0;
}

function hasClosingOdds(match: CanonicalMatch): boolean {
  return match.odds.some(
    (o) => o.closingHomeOdds !== undefined || o.closingAwayOdds !== undefined || o.closingDrawOdds !== undefined
  );
}

export class CoverageAnalyzer {
  analyze(dataset: CanonicalDataset, enrichment: EnrichmentCoverageInput = {}): CoverageReport {
    const byLeague = new Map<string, CanonicalMatch[]>();
    for (const m of dataset.matches) {
      const key = m.fixture.competitionId;
      const arr = byLeague.get(key) ?? [];
      arr.push(m);
      byLeague.set(key, arr);
    }

    const xgSet = new Set(enrichment.fixturesWithXg ?? []);
    const lineupSet = new Set(enrichment.fixturesWithLineups ?? []);
    const injurySet = new Set(enrichment.fixturesWithInjuries ?? []);
    const weatherSet = new Set(enrichment.fixturesWithWeather ?? []);

    const leagues: LeagueCoverageSummary[] = [];
    for (const [leagueId, matches] of byLeague) {
      const total = matches.length;
      const seasonId = matches[0]?.fixture.seasonId ?? '';

      const fixtures = metric(total, total); // all rows are fixtures by definition
      const odds = metric(matches.filter(hasAnyOdds).length, total);
      const closingOdds = metric(matches.filter(hasClosingOdds).length, total);
      const asianHandicap = metric(matches.filter((m) => hasMarket(m, 'AH')).length, total);
      const overUnder = metric(matches.filter((m) => hasMarket(m, 'OU')).length, total);
      const moneyline = metric(matches.filter((m) => hasMarket(m, 'ML')).length, total);
      const xg = metric(matches.filter((m) => xgSet.has(m.fixture.id)).length, total);
      const lineups = metric(matches.filter((m) => lineupSet.has(m.fixture.id)).length, total);
      const injuries = metric(matches.filter((m) => injurySet.has(m.fixture.id)).length, total);
      const weather = metric(matches.filter((m) => weatherSet.has(m.fixture.id)).length, total);

      const dims = [fixtures, odds, closingOdds, asianHandicap, overUnder, moneyline, xg, lineups, injuries, weather];
      const overallPct = Math.round((dims.reduce((s, d) => s + d.pct, 0) / dims.length) * 100) / 100;

      leagues.push({
        leagueId,
        seasonId,
        fixtures,
        odds,
        closingOdds,
        asianHandicap,
        overUnder,
        moneyline,
        xg,
        lineups,
        injuries,
        weather,
        overallPct,
      });
    }

    leagues.sort((a, b) => a.leagueId.localeCompare(b.leagueId));
    const overallPct = leagues.length > 0
      ? Math.round((leagues.reduce((s, l) => s + l.overallPct, 0) / leagues.length) * 100) / 100
      : 0;

    return {
      datasetId: dataset.manifest.id,
      generatedAt: new Date().toISOString(),
      leagues,
      overallPct,
    };
  }
}

export const defaultCoverageAnalyzer = new CoverageAnalyzer();
