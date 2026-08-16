// Historical Research service — the data layer behind the Historical Research
// Dashboard and `/api/v1/historical/status`.
//
// Honesty contract:
// - When the credentialed Supabase Gold Layer can be probed successfully, all
//   numbers come from the DATABASE and goldLayer.status = VERIFIED.
// - When it cannot (credentials unavailable, query error), the service
//   FAILS CLOSED: goldLayer.status = BLOCKED, dataSource = 'SOURCE', and only
//   frozen source-layer artifacts (data/golden/europe/*) are used. It never
//   presents source numbers as live DB numbers and never fakes a green state.
// Location: src/lib/historical/historicalResearchService.ts

import * as fs from 'fs';
import * as path from 'path';

const GOLDEN_DIR = path.resolve(process.cwd(), 'data', 'golden', 'europe');

// ─── Types ────────────────────────────────────────────────────────────────
export type StatusLevel = 'VERIFIED' | 'READY' | 'PENDING' | 'BLOCKED' | 'NOT_STARTED' | 'SOURCE';

export interface LeagueRow {
  leagueId: string;
  name: string;
  country: string;
  cluster: 'A' | 'B' | 'C';
  matches: number;
  seasons: number;
  ml: number; // coverage %
  ah: number;
  ou: number;
  status: 'READY' | 'PARTIAL' | 'INSUFFICIENT' | 'SOURCE ABSENT';
  excludeReason?: string;
}

export interface ClusterStatus {
  cluster: 'A' | 'B' | 'C';
  label: string;
  leaguesIncluded: number;
  leaguesPresent: string[]; // leagueIds + names of included leagues
  excludedNames: string[];
  matches: number;
  markets?: 'ML / AH / OU' | null;
}

export interface PipelineNode {
  id: string;
  label: string;
  status: StatusLevel;
}

export interface BacktestCheckItem {
  id: string;
  label: string;
  state: 'done' | 'pending' | 'blocked' | 'not_started';
  detail?: string;
}

export interface HistoricalStatusPayload {
  generatedAt: string;
  dataSource: 'SOURCE' | 'DATABASE';
  dataset: {
    version: string;
    source: string;
    hash: string; // full
    hashShort: string;
    canonicalMatches: number;
    rawRecordCount: number;
    rejected: number;
    duplicatesResolved: number;
    duplicatesRemaining: number;
    synthetic: number;
    unknownProvenance: number;
    generatedAt: string;
    schemaVersion: string;
    normalizationVersion: string;
    label: 'SOURCE VERIFIED' | 'DB VERIFIED';
  };
  market: {
    observations: { ml: number; ah: number; ou: number; total: number };
    coverage: { ml: number; ah: number; ou: number }; // overall %, derived
    window: { earliest: string | null; latest: string | null } | null;
  };
  leagues: LeagueRow[];
  clusters: ClusterStatus[];
  goldLayer: { status: 'VERIFIED' | 'BLOCKED'; reason: string | null; dbVerified: boolean; problems?: string[] };
  pipeline: PipelineNode[];
  backtest: { status: 'READY' | 'NOT_STARTED' | 'BLOCKED'; ready: boolean; checklist: BacktestCheckItem[] };
}

export interface DbSnapshot {
  manifest: Record<string, unknown> | null;
  coverageRows: Array<{
    league_id: string;
    matches: number;
    ml_rows: number;
    ah_rows: number;
    ou_rows: number;
    ml_coverage: number | null;
    ah_coverage: number | null;
    ou_coverage: number | null;
  }>;
  window?: { earliest: string | null; latest: string | null } | null;
}

export type HistoricalDbProbe = () => Promise<DbSnapshot>;

// ─── Source-layer readers ─────────────────────────────────────────────────
interface SourceManifest {
  dataset_version: string;
  generated_at: string;
  source: string;
  schema_version: string;
  normalization_version: string;
  valid_match_count: number;
  raw_record_count: number;
  rejected_match_count: number;
  duplicate_resolved_count: number;
  duplicate_count: number;
  hash: string;
}
interface SourceMarketManifest {
  dataset_version: string;
  odds_row_count: number;
  by_market: { ML: number; AH: number; OU: number };
  by_league: Array<{
    leagueId: string;
    matches: number;
    ml_coverage_pct: number;
    ah_coverage_pct: number;
    ou_coverage_pct: number;
  }>;
}
interface SourceLeague {
  leagueId: string;
  name: string;
  country: string;
  cluster: 'A' | 'B' | 'C';
  status: string;
  excludeReason?: string;
  seasons: string[];
  earliestMatchDate: string | null;
  latestMatchDate: string | null;
  valid: number;
  readiness: { ml: string; ah: string; ou: string; btts: string };
}
interface SourceCluster {
  cluster: 'A' | 'B' | 'C';
  leaguesIncluded: number;
  matches: number;
}

function readJson<T>(file: string): T | null {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return null;
  }
}

const REGISTRY: Array<{ cluster: 'A' | 'B' | 'C'; leagueId: string; name: string }> = [
  { cluster: 'A', leagueId: 'ENG-PL', name: 'Premier League' },
  { cluster: 'A', leagueId: 'ESP-LALIGA', name: 'La Liga' },
  { cluster: 'A', leagueId: 'DEU-BUNDESLIGA', name: 'Bundesliga' },
  { cluster: 'A', leagueId: 'ITA-SERIEA', name: 'Serie A' },
  { cluster: 'A', leagueId: 'FRA-LIGUE1', name: 'Ligue 1' },
  { cluster: 'B', leagueId: 'NED-ERE', name: 'Eredivisie' },
  { cluster: 'B', leagueId: 'POR-PRIMEIRA', name: 'Primeira Liga' },
  { cluster: 'B', leagueId: 'BEL-PRO', name: 'Belgian Pro League' },
  { cluster: 'B', leagueId: 'SCO-PREM', name: 'Scottish Premiership' },
  { cluster: 'B', leagueId: 'TUR-SL', name: 'Süper Lig' },
  { cluster: 'B', leagueId: 'AUT-BUND', name: 'Austrian Bundesliga' },
  { cluster: 'B', leagueId: 'SUI-SL', name: 'Swiss Super League' },
  { cluster: 'C', leagueId: 'DNK-SL', name: 'Danish Superliga' },
  { cluster: 'C', leagueId: 'NOR-EL', name: 'Eliteserien' },
  { cluster: 'C', leagueId: 'SWE-AL', name: 'Allsvenskan' },
  { cluster: 'C', leagueId: 'POL-EKS', name: 'Ekstraklasa' },
  { cluster: 'C', leagueId: 'CZE-1L', name: 'Czech First League' },
  { cluster: 'C', leagueId: 'GRC-SL', name: 'Greek Super League' },
  { cluster: 'C', leagueId: 'ROU-L1', name: 'Liga I' },
  { cluster: 'C', leagueId: 'HRV-HNL', name: 'HNL' },
  { cluster: 'C', leagueId: 'SRB-SL', name: 'SuperLiga' },
  { cluster: 'C', leagueId: 'HUN-NB1', name: 'NB I' },
  { cluster: 'C', leagueId: 'FIN-VL', name: 'Veikkausliiga' },
  { cluster: 'C', leagueId: 'IRL-PD', name: 'Premier Division' },
];

const CLUSTER_A_LEAGUES = ['ENG-PL', 'ESP-LALIGA', 'DEU-BUNDESLIGA', 'ITA-SERIEA', 'FRA-LIGUE1'];

/**
 * Reconciliation gates (EPIC §6/§9/§10/§13). VERIFIED is only granted when the
 * loaded database matches the frozen source exactly. Full (untruncated) hash
 * is used for the provenance gate.
 */
function reconcileGold(snapshot: DbSnapshot, srcManifest: SourceManifest | null, srcMarket: SourceMarketManifest | null, expectedValid: number): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const m = snapshot.manifest ?? {};
  const dbHash = m.hash != null ? String(m.hash) : '';
  const srcHash = srcManifest?.hash ?? '';
  if (srcHash && dbHash && dbHash !== srcHash) problems.push(`PROVENANCE_MISMATCH: db hash != source hash (${dbHash.slice(0, 16)}…)`);

  const dbValid = m.valid_match_count != null ? Number(m.valid_match_count) : undefined;
  if (dbValid !== expectedValid) problems.push(`COUNT_MISMATCH: manifest valid_match_count=${dbValid} expected=${expectedValid}`);

  const covMatches = (snapshot.coverageRows ?? []).reduce((s, r) => s + (Number(r.matches) || 0), 0);
  if (covMatches !== expectedValid) problems.push(`COUNT_MISMATCH: coverage sum=${covMatches} expected=${expectedValid}`);

  const rejected = m.rejected_match_count != null ? Number(m.rejected_match_count) : undefined;
  if (rejected !== undefined && rejected !== 0) problems.push(`INTEGRITY: rejected=${rejected} (expected 0)`);
  const dup = m.duplicate_count != null ? Number(m.duplicate_count) : undefined;
  if (dup !== undefined && dup !== 0) problems.push(`INTEGRITY: duplicates_remaining=${dup} (expected 0)`);

  const sumRows = (market: 'ML' | 'AH' | 'OU') => (snapshot.coverageRows ?? []).reduce((s, r) => s + (Number(r[market === 'ML' ? 'ml_rows' : market === 'AH' ? 'ah_rows' : 'ou_rows']) || 0), 0);
  if (srcMarket) {
    if (sumRows('ML') !== srcMarket.by_market.ML) problems.push(`ML_RECONCILE: db=${sumRows('ML')} source=${srcMarket.by_market.ML}`);
    if (sumRows('AH') !== srcMarket.by_market.AH) problems.push(`AH_RECONCILE: db=${sumRows('AH')} source=${srcMarket.by_market.AH}`);
    if (sumRows('OU') !== srcMarket.by_market.OU) problems.push(`OU_RECONCILE: db=${sumRows('OU')} source=${srcMarket.by_market.OU}`);
  }

  for (const id of CLUSTER_A_LEAGUES) {
    const c = (snapshot.coverageRows ?? []).find((x) => x.league_id === id);
    if (!c || !c.matches) problems.push(`SCHEMA/COVERAGE: missing coverage row for ${id}`);
  }

  return { ok: problems.length === 0, problems };
}

function blockedGoldReason(problems: string[]): string {
  if (problems.some((p) => p.startsWith('PROVENANCE_MISMATCH'))) return 'GOLD_PROVENANCE_MISMATCH';
  if (problems.some((p) => p.startsWith('COUNT_MISMATCH'))) return 'GOLD_COUNT_MISMATCH';
  if (problems.some((p) => p.startsWith('SCHEMA'))) return 'GOLD_SCHEMA_FAILED';
  if (problems.some((p) => p.startsWith('INTEGRITY') || p.includes('_RECONCILE'))) return 'GOLD_RECONCILIATION_FAILED';
  return 'GOLD_VERIFICATION_FAILED';
}

function blockedPayload(problems: string[], reason: string): HistoricalStatusPayload {
  const base = sourcePayload();
  return {
    ...base,
    generatedAt: new Date().toISOString(),
    goldLayer: { status: 'BLOCKED', reason, dbVerified: false, problems },
    backtest: { status: 'BLOCKED', ready: false, checklist: base.backtest.checklist.map((c) => (c.id === 'gold-verify' ? { ...c, state: 'blocked' as const, detail: reason } : c)) },
  };
}

function sourcePayload(): HistoricalStatusPayload {
  const manifest = readJson<SourceManifest>(path.join(GOLDEN_DIR, 'manifest.json'));
  const market = readJson<SourceMarketManifest>(path.join(GOLDEN_DIR, 'market_odds_manifest.json'));
  const leagues = readJson<SourceLeague[]>(path.join(GOLDEN_DIR, 'leagues.json'));
  const clusters = readJson<SourceCluster[]>(path.join(GOLDEN_DIR, 'clusters.json'));

  const version = manifest?.dataset_version ?? 'unknown';
  const hash = manifest?.hash ?? '';
  const canonicalMatches = manifest?.valid_match_count ?? 0;

  const ml = market?.by_market.ML ?? 0;
  const ah = market?.by_market.AH ?? 0;
  const ou = market?.by_market.OU ?? 0;
  const total = market?.odds_row_count ?? ml + ah + ou;

  const leagueRows: LeagueRow[] = REGISTRY.map((r) => {
    const l = leagues?.find((x) => x.leagueId === r.leagueId);
    const m = market?.by_league.find((x) => x.leagueId === r.leagueId);
    if (!l || l.status !== 'INCLUDED' || !l.valid) {
      return {
        leagueId: r.leagueId, name: r.name, country: l?.country ?? '', cluster: r.cluster,
        matches: 0, seasons: 0, ml: 0, ah: 0, ou: 0, status: 'SOURCE ABSENT',
        excludeReason: l?.excludeReason ?? 'SOURCE_DATA_ABSENT',
      };
    }
    return {
      leagueId: r.leagueId, name: r.name, country: l.country, cluster: r.cluster,
      matches: l.valid, seasons: l.seasons.length,
      ml: m?.ml_coverage_pct ?? 0, ah: m?.ah_coverage_pct ?? 0, ou: m?.ou_coverage_pct ?? 0,
      status: 'READY',
    };
  });

  const included = leagueRows.filter((x) => x.status !== 'SOURCE ABSENT');
  const avg = (...vals: number[]) => (included.length ? vals.reduce((s, v) => s + v, 0) / included.length : 0);

  const dates = (leagues ?? []).map((l) => [l.earliestMatchDate, l.latestMatchDate] as const).filter((x) => x[0] && x[1]);
  const window = dates.length
    ? { earliest: dates.reduce((a, b) => (a[0]! < b[0]! ? a : b), dates[0])[0] ?? null, latest: dates.reduce((a, b) => (a[1]! > b[1]! ? a : b), dates[0])[1] ?? null }
    : null;

  const clustersStatus: ClusterStatus[] = (['A', 'B', 'C'] as const).map((c) => {
    const members = REGISTRY.filter((r) => r.cluster === c);
    const present = members.filter((m) => leagueRows.find((x) => x.leagueId === m.leagueId)?.status !== 'SOURCE ABSENT');
    const cc = clusters?.find((x) => x.cluster === c);
    return {
      cluster: c,
      label: c === 'A' ? 'TOP EUROPEAN LEAGUES' : c === 'B' ? 'STRONG SECOND TIER' : 'OTHER MODELABLE EUROPE',
      leaguesIncluded: present.length,
      leaguesPresent: present.map((p) => p.name),
      excludedNames: members.filter((m) => !present.includes(m)).map((m) => m.name),
      matches: cc?.matches ?? present.reduce((s, p) => s + (leagueRows.find((x) => x.leagueId === p.leagueId)?.matches ?? 0), 0),
      markets: c === 'A' ? 'ML / AH / OU' : null,
    };
  });

  const dbVerified = false;
  const pipeline: PipelineNode[] = [
    { id: 'source', label: 'SOURCE', status: 'VERIFIED' },
    { id: 'normalization', label: 'NORMALIZATION', status: 'VERIFIED' },
    { id: 'canonical', label: 'CANONICAL DATASET', status: 'VERIFIED' },
    { id: 'supabase-gold', label: 'SUPABASE GOLD', status: 'BLOCKED' },
    { id: 'gold-views', label: 'GOLD VIEWS', status: 'BLOCKED' },
    { id: 'gold-service', label: 'GOLD SERVICE', status: 'READY' },
    { id: 'historical-ui', label: 'HISTORICAL UI', status: 'PENDING' },
  ];

  const backtestReady =
    dbVerified && included.every((l) => l.ml === 100) && included.every((l) => l.ah >= 99 || l.ah === 100) && included.every((l) => l.ou === 100);

  const checklist: BacktestCheckItem[] = [
    { id: 'matches', label: 'Historical matches', state: 'done' },
    { id: 'ml', label: 'ML odds', state: 'done', detail: `${ml} observations` },
    { id: 'ah', label: 'AH odds', state: 'done', detail: `${ah} observations` },
    { id: 'ou', label: 'OU odds', state: 'done', detail: `${ou} observations` },
    { id: 'provenance', label: 'Provenance', state: 'done' },
    { id: 'reproducibility', label: 'Dataset reproducibility', state: 'done' },
    { id: 'gold-schema', label: 'Gold schema', state: 'done' },
    { id: 'gold-verify', label: 'Supabase Gold verification', state: 'blocked', detail: 'Credentialed database verification required' },
    { id: 'ui-verify', label: 'UI verification', state: 'pending' },
    { id: 'backtest-run', label: 'Backtest execution', state: 'not_started' },
  ];

  return {
    generatedAt: new Date().toISOString(),
    dataSource: 'SOURCE',
    dataset: {
      version,
      source: manifest?.source ?? 'football-data.co.uk CSVs',
      hash,
      hashShort: hash.slice(0, 24),
      canonicalMatches,
      rawRecordCount: manifest?.raw_record_count ?? 0,
      rejected: manifest?.rejected_match_count ?? 0,
      duplicatesResolved: manifest?.duplicate_resolved_count ?? 0,
      duplicatesRemaining: manifest?.duplicate_count ?? 0,
      synthetic: 0,
      unknownProvenance: 0,
      generatedAt: manifest?.generated_at ?? '',
      schemaVersion: manifest?.schema_version ?? '',
      normalizationVersion: manifest?.normalization_version ?? '',
      label: 'SOURCE VERIFIED',
    },
    market: {
      observations: { ml, ah, ou, total },
      coverage: {
        ml: Math.round(avg(...included.map((l) => l.ml)) * 100) / 100,
        ah: Math.round(avg(...included.map((l) => l.ah)) * 100) / 100,
        ou: Math.round(avg(...included.map((l) => l.ou)) * 100) / 100,
      },
      window,
    },
    leagues: leagueRows,
    clusters: clustersStatus,
    goldLayer: { status: 'BLOCKED', reason: 'CREDENTIAL_UNAVAILABLE', dbVerified },
    pipeline,
    backtest: { status: backtestReady ? 'READY' : 'NOT_STARTED', ready: backtestReady, checklist },
  };
}

function dbPayload(snapshot: DbSnapshot, manifest: SourceManifest | null): HistoricalStatusPayload {
  const coverageRows = snapshot.coverageRows ?? [];
  const ml = coverageRows.reduce((s, r) => s + (r.ml_rows ?? 0), 0);
  const ah = coverageRows.reduce((s, r) => s + (r.ah_rows ?? 0), 0);
  const ou = coverageRows.reduce((s, r) => s + (r.ou_rows ?? 0), 0);
  const matches = coverageRows.reduce((s, r) => s + (r.matches ?? 0), 0);
  const hash = String(snapshot.manifest?.hash ?? manifest?.hash ?? '');
  const version = String(snapshot.manifest?.dataset_version ?? manifest?.dataset_version ?? 'europe-dataset-v1');

  const leagueRows: LeagueRow[] = REGISTRY.map((r) => {
    const c = coverageRows.find((x) => x.league_id === r.leagueId);
    if (!c || !c.matches) {
      return { leagueId: r.leagueId, name: r.name, country: '', cluster: r.cluster, matches: 0, seasons: 0, ml: 0, ah: 0, ou: 0, status: 'SOURCE ABSENT' };
    }
    return {
      leagueId: r.leagueId, name: r.name, country: '', cluster: r.cluster,
      matches: c.matches, seasons: 0,
      ml: c.ml_coverage ?? 0, ah: c.ah_coverage ?? 0, ou: c.ou_coverage ?? 0,
      status: 'READY',
    };
  });

  const clustersStatus: ClusterStatus[] = (['A', 'B', 'C'] as const).map((c) => {
    const members = REGISTRY.filter((x) => x.cluster === c);
    const present = members.filter((m) => leagueRows.find((x) => x.leagueId === m.leagueId)?.status !== 'SOURCE ABSENT');
    return {
      cluster: c,
      label: c === 'A' ? 'TOP EUROPEAN LEAGUES' : c === 'B' ? 'STRONG SECOND TIER' : 'OTHER MODELABLE EUROPE',
      leaguesIncluded: present.length,
      leaguesPresent: present.map((p) => p.name),
      excludedNames: members.filter((m) => !present.includes(m)).map((m) => m.name),
      matches: present.reduce((s, p) => s + (leagueRows.find((x) => x.leagueId === p.leagueId)?.matches ?? 0), 0),
      markets: c === 'A' ? 'ML / AH / OU' : null,
    };
  });

  const pipeline: PipelineNode[] = [
    { id: 'source', label: 'SOURCE', status: 'VERIFIED' },
    { id: 'normalization', label: 'NORMALIZATION', status: 'VERIFIED' },
    { id: 'canonical', label: 'CANONICAL DATASET', status: 'VERIFIED' },
    { id: 'supabase-gold', label: 'SUPABASE GOLD', status: 'VERIFIED' },
    { id: 'gold-views', label: 'GOLD VIEWS', status: 'VERIFIED' },
    { id: 'gold-service', label: 'GOLD SERVICE', status: 'READY' },
    { id: 'historical-ui', label: 'HISTORICAL UI', status: 'PENDING' },
  ];

  const checklist: BacktestCheckItem[] = [
    { id: 'matches', label: 'Historical matches', state: 'done' },
    { id: 'ml', label: 'ML odds', state: 'done' },
    { id: 'ah', label: 'AH odds', state: 'done' },
    { id: 'ou', label: 'OU odds', state: 'done' },
    { id: 'provenance', label: 'Provenance', state: 'done' },
    { id: 'reproducibility', label: 'Dataset reproducibility', state: 'done' },
    { id: 'gold-schema', label: 'Gold schema', state: 'done' },
    { id: 'gold-verify', label: 'Supabase Gold verification', state: 'done' },
    { id: 'ui-verify', label: 'UI verification', state: 'pending' },
    { id: 'backtest-run', label: 'Backtest execution', state: 'not_started' },
  ];

  return {
    generatedAt: new Date().toISOString(),
    dataSource: 'DATABASE',
    dataset: {
      version,
      source: String(snapshot.manifest?.source ?? manifest?.source ?? 'football-data.co.uk CSVs'),
      hash,
      hashShort: hash.slice(0, 24),
      canonicalMatches: matches,
      rawRecordCount: Number(snapshot.manifest?.raw_record_count ?? matches),
      rejected: Number(snapshot.manifest?.rejected_match_count ?? 0),
      duplicatesResolved: Number(snapshot.manifest?.duplicate_resolved_count ?? 0),
      duplicatesRemaining: Number(snapshot.manifest?.duplicate_count ?? 0),
      synthetic: 0,
      unknownProvenance: 0,
      generatedAt: String(snapshot.manifest?.generated_at ?? ''),
      schemaVersion: String(snapshot.manifest?.schema_version ?? ''),
      normalizationVersion: String(snapshot.manifest?.normalization_version ?? ''),
      label: 'DB VERIFIED',
    },
    market: {
      observations: { ml, ah, ou, total: ml + ah + ou },
      coverage: {
        ml: Math.round((ml / Math.max(matches, 1)) * 10000) / 100,
        ah: Math.round((ah / Math.max(matches, 1)) * 10000) / 100,
        ou: Math.round((ou / Math.max(matches, 1)) * 10000) / 100,
      },
      window: snapshot.window ?? null,
    },
    leagues: leagueRows,
    clusters: clustersStatus,
    goldLayer: { status: 'VERIFIED', reason: null, dbVerified: true },
    pipeline,
    backtest: { status: 'READY', ready: true, checklist },
  };
}

/**
 * Main entry: probes the DB when available; fails closed to the source layer.
 * `db` is injected for tests; the route passes the production probe (or none
 * when credentials are missing).
 */
export async function getHistoricalStatus(opts: { db?: HistoricalDbProbe | undefined } = {}): Promise<HistoricalStatusPayload> {
  const manifest = readJson<SourceManifest>(path.join(GOLDEN_DIR, 'manifest.json'));
  const market = readJson<SourceMarketManifest>(path.join(GOLDEN_DIR, 'market_odds_manifest.json'));
  const expectedValid = manifest?.valid_match_count ?? 8898;

  if (opts.db) {
    try {
      const snapshot = await opts.db();
      if (snapshot && typeof snapshot === 'object') {
        const rec = reconcileGold(snapshot, manifest, market, expectedValid);
        if (rec.ok) {
          return dbPayload(snapshot, manifest);
        }
        return blockedPayload(rec.problems, blockedGoldReason(rec.problems));
      }
    } catch {
      // fall through to fail-closed source payload with BLOCKED gold layer
      const base = sourcePayload();
      return { ...base, goldLayer: { status: 'BLOCKED', reason: 'DB_QUERY_ERROR', dbVerified: false }, generatedAt: new Date().toISOString() };
    }
  }

  return sourcePayload();
}
