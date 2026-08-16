// EPIC: Historical European League Data Expansion — ingestion orchestrator.
// Reads verified football-data.co.uk CSVs, normalizes deterministically,
// resolves duplicates by source priority, rejects invalid/result-mismatched
// records, and writes the canonical dataset + coverage audits + manifest.
// Location: src/historical/europe/ingest.ts

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import type {
  ClusterId,
  DedupDecision,
  HistoricalManifest,
  LeagueMeta,
  LeagueCoverage,
} from './types';
import { EUROPEAN_LEAGUE_REGISTRY, getLeagueById } from './leagueRegistry';
import { discoverLeagueSources } from './sourceDiscovery';
import { readFootballDataCsv, type RawFootballDataRow } from './footballDataReader';
import { normalizeRecord, NORMALIZATION_VERSION, SCHEMA_VERSION } from './normalize';
import { leagueCoverage, clusterCoverage } from './coverage';

export const OUTPUT_DIR = path.join(process.cwd(), 'data', 'golden', 'europe');
export const DATASET_VERSION = 'europe-dataset-v1';

interface Candidate {
  match: import('./types').CanonicalMatch;
  priority: number;
}

function writeJsonl(file: string, rows: unknown[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lines = rows.map((r) => JSON.stringify(r)).join('\n');
  fs.writeFileSync(file, lines + (rows.length ? '\n' : ''));
}

function readRowsForDiv(descriptor: { filePath: string; season: string }, div: string): { rows: RawFootballDataRow[]; parseError: string | null } {
  const { rows, parseError } = readFootballDataCsv(descriptor.filePath, descriptor.season);
  return { rows: rows.filter((r) => r.div === div), parseError };
}

export interface BuildSummary {
  matches: import('./types').CanonicalMatch[];
  leagues: LeagueCoverage[];
  manifest: HistoricalManifest;
  dedupDecisions: DedupDecision[];
  rejections: Array<{ leagueId: string; reason: string; count: number }>;
  parseErrors: Array<{ filePath: string; error: string }>;
}

export function buildHistoricalDataset(): BuildSummary {
  const included = EUROPEAN_LEAGUE_REGISTRY.filter((l) => l.status === 'INCLUDED');

  const candidates: Candidate[] = [];
  const rejections: Array<{ leagueId: string; reason: string; count: number }> = [];
  const parseErrors: Array<{ filePath: string; error: string }> = [];
  const dedupDecisions: DedupDecision[] = [];
  const leagueSources: Record<string, string[]> = {};

  for (const league of included) {
    const { descriptors } = discoverLeagueSources(league.leagueId, league.footballDataCode);
    leagueSources[league.leagueId] = descriptors.map((d) => `${d.season}@${d.rootLabel} (${path.basename(d.filePath)})`);
    const reject: Record<string, number> = {};

    for (const d of descriptors) {
      const { rows, parseError } = readRowsForDiv(d, league.footballDataCode);
      if (parseError) parseErrors.push({ filePath: d.filePath, error: parseError });
      for (const row of rows) {
        const { match, rejectReason } = normalizeRecord(row, league);
        if (match) {
          candidates.push({ match, priority: d.priority });
        } else if (rejectReason) {
          reject[rejectReason] = (reject[rejectReason] ?? 0) + 1;
        }
      }
    }
    for (const [reason, count] of Object.entries(reject)) {
      rejections.push({ leagueId: league.leagueId, reason, count });
    }
  }

  // ─── Deduplicate by canonical identity; highest source priority wins ───
  const keptById = new Map<string, Candidate>();
  const discardedByKept = new Map<string, string[]>();
  for (const c of candidates) {
    const id = c.match.canonicalId;
    const existing = keptById.get(id);
    if (!existing) {
      keptById.set(id, c);
      continue;
    }
    if (c.priority > existing.priority) {
      // Newer/higher-priority source replaces the kept record.
      discardedByKept.set(id, [existing.match.sourceFile]);
      keptById.set(id, c);
    } else {
      const list = discardedByKept.get(id) ?? [];
      list.push(c.match.sourceFile);
      discardedByKept.set(id, list);
    }
  }

  for (const [id, keptCandidate] of Array.from(keptById.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const discarded = discardedByKept.get(id) ?? [];
    if (discarded.length > 0) {
      dedupDecisions.push({ canonicalId: id, keptSource: keptCandidate.match.sourceFile, discardedSources: discarded });
    }
  }

  const matches = Array.from(keptById.values())
    .map((c) => c.match)
    .sort((a, b) =>
      a.leagueId.localeCompare(b.leagueId) ||
      a.season.localeCompare(b.season) ||
      a.matchDate.localeCompare(b.matchDate) ||
      a.homeTeam.localeCompare(b.homeTeam) ||
      a.awayTeam.localeCompare(b.awayTeam)
    );

  // ─── Per-league metadata + coverage ───
  const metaByLeague = new Map<string, LeagueMeta>();
  for (const league of EUROPEAN_LEAGUE_REGISTRY) {
    const leagueMatches = matches.filter((m) => m.leagueId === league.leagueId);
    const seasons = [...new Set(leagueMatches.map((m) => m.season))].sort();
    const rejectedForLeague = rejections
      .filter((r) => r.leagueId === league.leagueId)
      .reduce((s, r) => s + r.count, 0);
    const duplicatesInLeague = dedupDecisions.filter((d) => d.canonicalId.startsWith(`${league.leagueId}|`)).length;
    const dates = leagueMatches.map((m) => m.matchDate).sort();
    metaByLeague.set(league.leagueId, {
      leagueId: league.leagueId,
      name: league.name,
      country: league.country,
      cluster: league.cluster,
      status: leagueMatches.length > 0 ? 'INCLUDED' : league.status,
      excludeReason: leagueMatches.length > 0 ? undefined : league.excludeReason,
      seasons,
      earliestMatchDate: dates[0] ?? null,
      latestMatchDate: dates[dates.length - 1] ?? null,
      matches: leagueMatches.length,
      valid: leagueMatches.length,
      rejected: rejectedForLeague,
      duplicates: duplicatesInLeague,
    });
  }

  const allLeagues: LeagueCoverage[] = [];
  for (const league of EUROPEAN_LEAGUE_REGISTRY) {
    const meta = metaByLeague.get(league.leagueId)!;
    const leagueMatches = matches.filter((m) => m.leagueId === league.leagueId);
    allLeagues.push(leagueCoverage(meta, leagueMatches));
  }

  const clusters: ClusterId[] = ['A', 'B', 'C'];
  const clusterCovs = clusters.map((c) => clusterCoverage(c, allLeagues));

  const seasonsAll = [...new Set(matches.map((m) => m.season))].sort();

  // ─── Stable digest over the sorted canonical records (excludes timestamps) ───
  const hash = createHash('sha256')
    .update(matches.map((m) => JSON.stringify(m)).join('\n'))
    .digest('hex');

  const oddsCoverage = {
    ml: allLeagues.reduce((s, l) => s + l.coverage.ml, 0),
    ah: allLeagues.reduce((s, l) => s + l.coverage.ah, 0),
    ou: allLeagues.reduce((s, l) => s + l.coverage.ou, 0),
    btts: allLeagues.reduce((s, l) => s + l.coverage.btts, 0),
  };

  const rejectedTotal = rejections.reduce((s, r) => s + r.count, 0);

  // Duplicates remaining AFTER canonicalization must be zero (all resolved).
  const remainingDuplicateIds = new Map<string, number>();
  for (const m of matches) {
    remainingDuplicateIds.set(m.canonicalId, (remainingDuplicateIds.get(m.canonicalId) ?? 0) + 1);
  }
  const remainingDuplicates = Array.from(remainingDuplicateIds.values()).filter((n) => n > 1).length;

  const manifest: HistoricalManifest = {
    dataset_version: DATASET_VERSION,
    generated_at: new Date().toISOString(),
    source: 'football-data.co.uk CSVs (data/bronze/football_data + research/quant/data/bronze/football_data_co_uk)',
    schema_version: SCHEMA_VERSION,
    normalization_version: NORMALIZATION_VERSION,
    leagues: allLeagues,
    clusters: clusterCovs,
    seasons: seasonsAll,
    raw_record_count: candidates.length,
    match_count: matches.length + rejectedTotal,
    valid_match_count: matches.length,
    rejected_match_count: rejectedTotal,
    duplicate_resolved_count: dedupDecisions.length,
    duplicate_count: remainingDuplicates,
    odds_coverage: oddsCoverage,
    hash,
  };

  // ─── Persist ───
  writeJsonl(path.join(OUTPUT_DIR, 'canonical_matches.jsonl'), matches);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'leagues.json'), JSON.stringify(allLeagues, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'clusters.json'), JSON.stringify(clusterCovs, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'readiness.json'), JSON.stringify(
    allLeagues.map((l) => ({ leagueId: l.leagueId, name: l.name, cluster: l.cluster, status: l.status, readiness: l.readiness })),
    null, 2
  ));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'audit.json'), JSON.stringify({
    dedupDecisions,
    rejections,
    parseErrors,
    leagueSources,
    excluded: EUROPEAN_LEAGUE_REGISTRY.filter((l) => l.status === 'EXCLUDED')
      .map((l) => ({ leagueId: l.leagueId, cluster: l.cluster, reason: l.excludeReason })),
  }, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  return { matches, leagues: allLeagues, manifest, dedupDecisions, rejections, parseErrors };
}

export function getLeagueByIdOrUndefined(leagueId: string) {
  return getLeagueById(leagueId);
}
