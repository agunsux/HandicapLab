// AH YIELD ENGINE — Data quality / coverage panel.
// Never reports a "validated" state when the underlying data is incomplete.

import type {
  AhProvenance,
  BuildObservationsResult,
  CanonicalMatchRecord,
  MarketOddsRecord,
} from './ahTypes';
import type { AhSourceLayout } from './ahProvenance';

export interface AhDataQualityReport {
  matches: {
    total: number;
    resultVerified: number;
    resultCoveragePct: number;
    duplicateCanonicalIds: number;
    leagues: string[];
    seasons: string[];
  };
  ahOdds: {
    rawRows: number;
    matchedRows: number;
    unmatchedRows: number;
    canonicalJoinPct: number;
    coverageMatches: number;
    coveragePct: number;
    validObservations: number;
    duplicates: number;
    rejectedRows: number;
    rejectedByReason: Record<string, number>;
    missingPriceRows: number;
    invalidLineRows: number;
    byProvenance: Record<string, number>;
    bySnapshot: Record<string, number>;
    byBookmakerLabel: Record<string, number>;
    byLine: Record<string, number>;
    bySeason: Record<string, { rawRows: number; matches: number; coveragePct: number }>;
    byLeague: Record<string, { rawRows: number; matches: number; coveragePct: number }>;
    timestampsAvailable: false;
    timestampsNote: string;
  };
  provenanceLayouts: Array<AhSourceLayout & { rows: number }>;
  integrityFlags: string[];
}

export interface AhDataQualityInput {
  matches: CanonicalMatchRecord[];
  oddsRows: MarketOddsRecord[];
  build: BuildObservationsResult;
  layouts: AhSourceLayout[];
}

export function buildAhDataQualityReport(input: AhDataQualityInput): AhDataQualityReport {
  const { matches, oddsRows, build, layouts } = input;

  const seenIds = new Set<string>();
  let duplicateCanonicalIds = 0;
  for (const m of matches) {
    if (seenIds.has(m.canonicalId)) duplicateCanonicalIds += 1;
    seenIds.add(m.canonicalId);
  }

  const ahRows = oddsRows.filter((r) => r.market === 'AH');
  const matchedRows = ahRows.length - build.unmatchedOddsRows;

  const ahMatches = new Set(build.observations.map((o) => o.canonicalMatchId));
  const coveragePct = matches.length > 0 ? (ahMatches.size / matches.length) * 100 : 0;

  const rejectedByReason: Record<string, number> = {};
  for (const r of build.rejected) {
    const generic = r.reason.split(':')[0];
    rejectedByReason[generic] = (rejectedByReason[generic] ?? 0) + 1;
  }

  const byBookmakerLabel: Record<string, number> = {};
  const byLine: Record<string, number> = {};
  for (const r of ahRows) {
    byBookmakerLabel[r.bookmakerSource] = (byBookmakerLabel[r.bookmakerSource] ?? 0) + 1;
    if (typeof r.line === 'number') byLine[String(r.line)] = (byLine[String(r.line)] ?? 0) + 1;
  }

  const matchSeason = new Map<string, string>();
  const matchLeague = new Map<string, string>();
  for (const m of matches) {
    matchSeason.set(m.canonicalId, m.season);
    matchLeague.set(m.canonicalId, m.leagueId);
  }

  const seasonStats: Record<string, { rawRows: number; matches: Set<string>; totalMatches: number }> = {};
  for (const m of matches) {
    if (!seasonStats[m.season]) seasonStats[m.season] = { rawRows: 0, matches: new Set(), totalMatches: 0 };
    seasonStats[m.season].totalMatches += 1;
  }
  for (const r of ahRows) {
    const season = matchSeason.get(r.canonicalId);
    if (!season || !seasonStats[season]) continue;
    seasonStats[season].rawRows += 1;
    seasonStats[season].matches.add(r.canonicalId);
  }

  const leagueStats: Record<string, { rawRows: number; matches: Set<string>; totalMatches: number }> = {};
  for (const m of matches) {
    if (!leagueStats[m.leagueId]) leagueStats[m.leagueId] = { rawRows: 0, matches: new Set(), totalMatches: 0 };
    leagueStats[m.leagueId].totalMatches += 1;
  }
  for (const r of ahRows) {
    const league = matchLeague.get(r.canonicalId);
    if (!league || !leagueStats[league]) continue;
    leagueStats[league].rawRows += 1;
    leagueStats[league].matches.add(r.canonicalId);
  }

  const layoutRowCounts = new Map<string, number>();
  for (const r of ahRows) {
    layoutRowCounts.set(r.sourceFile, (layoutRowCounts.get(r.sourceFile) ?? 0) + 1);
  }

  const invalidLineRows = new Set(
    build.rejected.filter((r) => r.reason.startsWith('INVALID_LINE')).map((r) => r.oddsId)
  ).size;
  const missingPriceRows = new Set(
    build.rejected
      .filter((r) => r.reason.startsWith('INVALID_HOME_ODDS') || r.reason.startsWith('INVALID_AWAY_ODDS'))
      .map((r) => r.oddsId)
  ).size;

  const integrityFlags: string[] = [];
  if (build.duplicates > 0) integrityFlags.push(`DUPLICATE_OBSERVATIONS_COLLAPSED:${build.duplicates}`);
  if (duplicateCanonicalIds > 0) integrityFlags.push(`DUPLICATE_CANONICAL_IDS:${duplicateCanonicalIds}`);
  if (build.unmatchedOddsRows > 0) integrityFlags.push(`UNMATCHED_ODDS_ROWS:${build.unmatchedOddsRows}`);
  if (missingPriceRows > 0) integrityFlags.push(`MISSING_PRICE_ROWS:${missingPriceRows}`);
  if (invalidLineRows > 0) integrityFlags.push(`INVALID_LINE_ROWS:${invalidLineRows}`);
  const legacyPinnacleLayouts = layouts.filter((l) => l.openBranch === 'betbrain_avg');
  if (legacyPinnacleLayouts.length > 0) {
    integrityFlags.push(`PROVENANCE_MISLABEL_DETECTED:${legacyPinnacleLayouts.length}_SOURCES_EMIT_BETBRAIN_AS_PINNACLE`);
  }

  return {
    matches: {
      total: matches.length,
      resultVerified: matches.filter((m) => m.resultVerified).length,
      resultCoveragePct: matches.length > 0 ? (matches.filter((m) => m.resultVerified).length / matches.length) * 100 : 0,
      duplicateCanonicalIds,
      leagues: Array.from(new Set(matches.map((m) => m.leagueId))).sort(),
      seasons: Array.from(new Set(matches.map((m) => m.season))).sort(),
    },
    ahOdds: {
      rawRows: ahRows.length,
      matchedRows,
      unmatchedRows: build.unmatchedOddsRows,
      canonicalJoinPct: ahRows.length > 0 ? (matchedRows / ahRows.length) * 100 : 0,
      coverageMatches: ahMatches.size,
      coveragePct,
      validObservations: build.observations.length,
      duplicates: build.duplicates,
      rejectedRows: build.rejected.length,
      rejectedByReason,
      missingPriceRows,
      invalidLineRows,
      byProvenance: build.provenanceCounts as Record<string, number>,
      bySnapshot: build.snapshotCounts as Record<string, number>,
      byBookmakerLabel,
      byLine,
      bySeason: Object.fromEntries(
        Object.entries(seasonStats)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([season, s]) => [
            season,
            {
              rawRows: s.rawRows,
              matches: s.matches.size,
              coveragePct: s.totalMatches > 0 ? (s.matches.size / s.totalMatches) * 100 : 0,
            },
          ])
      ),
      byLeague: Object.fromEntries(
        Object.entries(leagueStats)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([league, s]) => [
            league,
            {
              rawRows: s.rawRows,
              matches: s.matches.size,
              coveragePct: s.totalMatches > 0 ? (s.matches.size / s.totalMatches) * 100 : 0,
            },
          ])
      ),
      timestampsAvailable: false,
      timestampsNote:
        'match_odds.jsonl carries no odds timestamps (only match_date and opening/closing/single_quote labels). T-24h/T-6h/T-1h snapshots are DATA NOT AVAILABLE.',
    },
    provenanceLayouts: layouts.map((l) => ({ ...l, rows: layoutRowCounts.get(l.sourceFile) ?? 0 })),
    integrityFlags,
  };
}

export function summarizeProvenance(value: Record<string, number>, provenance: AhProvenance): number {
  return value[provenance] ?? 0;
}
