// Historical Research status service + API tests.
// Location: tests/historical/ui/historical-status.test.ts

import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { getHistoricalStatus, type DbSnapshot } from '../../../src/lib/historical/historicalResearchService';
import { GET } from '../../../src/app/api/v1/historical/status/route';

function rows(id: string, matches: number, mlRows: number, ahRows: number, ouRows: number, ml: number, ah: number, ou: number): DbSnapshot['coverageRows'][number] {
  return { league_id: id, matches, ml_rows: mlRows, ah_rows: ahRows, ou_rows: ouRows, ml_coverage: ml, ah_coverage: ah, ou_coverage: ou };
}

const FULL_HASH = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'golden', 'europe', 'manifest.json'), 'utf-8')).hash as string;

const DB_ROWS = [
  rows('ENG-PL', 4180, 15200, 13678, 13679, 100, 100, 100),
  rows('ESP-LALIGA', 1520, 4939, 3790, 3800, 100, 99.87, 100),
  rows('DEU-BUNDESLIGA', 918, 2753, 1836, 1836, 100, 100, 100),
  rows('ITA-SERIEA', 1140, 3420, 2280, 2280, 100, 100, 100),
  rows('FRA-LIGUE1', 1140, 3420, 2280, 2280, 100, 100, 100),
];

const DB_SNAPSHOT: DbSnapshot = {
  manifest: {
    dataset_version: 'europe-dataset-v1',
    hash: FULL_HASH,
    source: 'football-data.co.uk CSVs',
    valid_match_count: 8898,
    raw_record_count: 10418,
    rejected_match_count: 0,
    duplicate_count: 0,
  },
  coverageRows: DB_ROWS,
};

const GOLDEN = path.join(process.cwd(), 'data', 'golden', 'europe');

describe('Historical status — SOURCE mode (fail-closed, DB unavailable)', () => {
  it('reports Gold Layer as BLOCKED with CREDENTIAL_UNAVAILABLE and never fakes VERIFIED', async () => {
    const p = await getHistoricalStatus({});
    expect(p.dataSource).toBe('SOURCE');
    expect(p.goldLayer.status).toBe('BLOCKED');
    expect(p.goldLayer.reason).toBe('CREDENTIAL_UNAVAILABLE');
    expect(p.goldLayer.dbVerified).toBe(false);
    expect(p.pipeline.find((n) => n.id === 'supabase-gold')?.status).toBe('BLOCKED');
    expect(p.backtest.status).toBe('NOT_STARTED');
    expect(p.backtest.checklist.find((c) => c.id === 'gold-verify')?.state).toBe('blocked');
  });

  it('reports the frozen dataset facts without fabrication', async () => {
    const man = JSON.parse(fs.readFileSync(path.join(GOLDEN, 'manifest.json'), 'utf-8'));
    const p = await getHistoricalStatus({});
    expect(p.dataset.version).toBe('europe-dataset-v1');
    expect(p.dataset.canonicalMatches).toBe(8898);
    expect(p.dataset.hash).toBe(man.hash);
    expect(p.dataset.hashShort.startsWith('e2500a7b01c7569798b15429')).toBe(true);
    expect(p.dataset.rejected).toBe(0);
    expect(p.dataset.duplicatesRemaining).toBe(0);
    expect(p.dataset.synthetic).toBe(0);
    expect(p.dataset.unknownProvenance).toBe(0);
  });

  it('derives market observations and coverage from the data layer, not hardcoded literals', async () => {
    const mm = JSON.parse(fs.readFileSync(path.join(GOLDEN, 'market_odds_manifest.json'), 'utf-8'));
    const p = await getHistoricalStatus({});
    expect(p.market.observations.ml).toBe(mm.by_market.ML);
    expect(p.market.observations.ah).toBe(mm.by_market.AH);
    expect(p.market.observations.ou).toBe(mm.by_market.OU);
    expect(p.market.observations.total).toBe(mm.odds_row_count);
    expect(p.market.coverage.ml).toBe(100);
  });

  it('reports clusters: A loaded, B/C source-absent but visible', async () => {
    const p = await getHistoricalStatus({});
    const a = p.clusters.find((c) => c.cluster === 'A')!;
    const b = p.clusters.find((c) => c.cluster === 'B')!;
    const c = p.clusters.find((x) => x.cluster === 'C')!;
    expect(a.leaguesIncluded).toBe(5);
    expect(a.leaguesPresent).toContain('Premier League');
    expect(b.leaguesIncluded).toBe(0);
    expect(b.excludedNames.length).toBe(7);
    expect(c.excludedNames.length).toBe(12);
  });
});

describe('Historical status — DATABASE mode (credentialed probe succeeds)', () => {
  it('reports VERIFIED Gold Layer and DB-backed numbers when all reconciliation gates pass', async () => {
    const p = await getHistoricalStatus({ db: async () => DB_SNAPSHOT });
    expect(p.dataSource).toBe('DATABASE');
    expect(p.goldLayer.status).toBe('VERIFIED');
    expect(p.goldLayer.reason).toBeNull();
    expect(p.goldLayer.dbVerified).toBe(true);
    expect(p.dataset.label).toBe('DB VERIFIED');
    expect(p.dataset.canonicalMatches).toBe(8898);
    expect(p.dataset.hash).toBe(FULL_HASH); // full, untruncated hash in backend verification
    expect(p.market.observations.ml).toBe(29732);
    expect(p.market.observations.ah).toBe(23864);
    expect(p.market.observations.ou).toBe(23875);
    expect(p.market.observations.total).toBe(77471);
    expect(p.pipeline.find((n) => n.id === 'supabase-gold')?.status).toBe('VERIFIED');
    expect(p.pipeline.find((n) => n.id === 'gold-views')?.status).toBe('VERIFIED');
    expect(p.backtest.ready).toBe(true);
    expect(p.backtest.checklist.find((x) => x.id === 'gold-verify')?.state).toBe('done');
  });
});

describe('Historical status — DATABASE mode FAILS closed on reconciliation gates', () => {
  const blocked = async (snap: DbSnapshot) => {
    const p = await getHistoricalStatus({ db: async () => snap });
    return p;
  };

  it('canonical count mismatch → BLOCKED GOLD_COUNT_MISMATCH (never VERIFIED)', async () => {
    const snap: DbSnapshot = { ...DB_SNAPSHOT, manifest: { ...DB_SNAPSHOT.manifest, valid_match_count: 9000 } };
    const p = await blocked(snap);
    expect(p.goldLayer.status).toBe('BLOCKED');
    expect(p.goldLayer.reason).toBe('GOLD_COUNT_MISMATCH');
    expect(p.dataSource).toBe('SOURCE'); // DB not trusted
    expect(p.backtest.ready).toBe(false);
  });

  it('provenance (full hash) mismatch → BLOCKED GOLD_PROVENANCE_MISMATCH', async () => {
    const snap: DbSnapshot = { ...DB_SNAPSHOT, manifest: { ...DB_SNAPSHOT.manifest, hash: 'deadbeefcafe' } };
    const p = await blocked(snap);
    expect(p.goldLayer.status).toBe('BLOCKED');
    expect(p.goldLayer.reason).toBe('GOLD_PROVENANCE_MISMATCH');
    expect((p.goldLayer.problems ?? []).some((x) => x.startsWith('PROVENANCE_MISMATCH'))).toBe(true);
  });

  it('missing cluster-A league coverage → BLOCKED (count + schema problems both reported)', async () => {
    const snap: DbSnapshot = { ...DB_SNAPSHOT, coverageRows: DB_ROWS.filter((r) => r.league_id !== 'FRA-LIGUE1') };
    const p = await blocked(snap);
    expect(p.goldLayer.status).toBe('BLOCKED');
    // Dropping a league also drops its matches, so the strict count gate fires first…
    expect(p.goldLayer.reason).toBe('GOLD_COUNT_MISMATCH');
    // …and the missing-coverage (schema) problem is still surfaced for operators.
    expect((p.goldLayer.problems ?? []).some((x) => x.startsWith('SCHEMA/COVERAGE: missing coverage row for FRA-LIGUE1'))).toBe(true);
  });

  it('league present but zero matches (totals balanced) → BLOCKED GOLD_SCHEMA_FAILED', async () => {
    const snap: DbSnapshot = {
      ...DB_SNAPSHOT,
      coverageRows: [
        rows('ENG-PL', 5320, 15200, 13678, 13679, 100, 100, 100),
        rows('ESP-LALIGA', 1520, 4939, 3790, 3800, 100, 99.87, 100),
        rows('DEU-BUNDESLIGA', 918, 2753, 1836, 1836, 100, 100, 100),
        rows('ITA-SERIEA', 1140, 3420, 2280, 2280, 100, 100, 100),
        rows('FRA-LIGUE1', 0, 3420, 2280, 2280, 100, 100, 100),
      ],
    };
    const p = await blocked(snap);
    expect(p.goldLayer.status).toBe('BLOCKED');
    expect(p.goldLayer.reason).toBe('GOLD_SCHEMA_FAILED');
  });

  it('non-zero remaining duplicates → BLOCKED GOLD_RECONCILIATION_FAILED', async () => {
    const snap: DbSnapshot = { ...DB_SNAPSHOT, manifest: { ...DB_SNAPSHOT.manifest, duplicate_count: 4 } };
    const p = await blocked(snap);
    expect(p.goldLayer.status).toBe('BLOCKED');
    expect(p.goldLayer.reason).toBe('GOLD_RECONCILIATION_FAILED');
  });

  it('market observation mismatch (ML rows) → BLOCKED GOLD_RECONCILIATION_FAILED', async () => {
    const snap: DbSnapshot = { ...DB_SNAPSHOT, coverageRows: [rows('ENG-PL', 4180, 15201, 13678, 13679, 100, 100, 100), ...DB_ROWS.slice(1)] };
    const p = await blocked(snap);
    expect(p.goldLayer.status).toBe('BLOCKED');
    expect(p.goldLayer.reason).toBe('GOLD_RECONCILIATION_FAILED');
  });

  it('rejected records non-zero → BLOCKED GOLD_RECONCILIATION_FAILED', async () => {
    const snap: DbSnapshot = { ...DB_SNAPSHOT, manifest: { ...DB_SNAPSHOT.manifest, rejected_match_count: 2 } };
    const p = await blocked(snap);
    expect(p.goldLayer.status).toBe('BLOCKED');
    expect(p.goldLayer.reason).toBe('GOLD_RECONCILIATION_FAILED');
  });
});

describe('Historical status — DB probe FAILS (never fake READY)', () => {
  it('fails closed to SOURCE and reports BLOCKED DB_QUERY_ERROR when the DB probe throws', async () => {
    const p = await getHistoricalStatus({ db: async () => { throw new Error('gold query failed: 500/200'); } });
    expect(p.goldLayer.status).toBe('BLOCKED');
    expect(p.goldLayer.reason).toBe('DB_QUERY_ERROR');
    expect(p.dataSource).toBe('SOURCE');
    expect(p.backtest.ready).toBe(false);
    expect(p.goldLayer.dbVerified).toBe(false);
  });
});

describe('Historical status API route', () => {
  it('returns 200 with a BLOCKED Gold Layer when no credentialed URL is available', async () => {
    // setup-env provides a fake structural key but NO SUPABASE_URL → probe is
    // not attempted → CREDENTIAL_UNAVAILABLE (deterministic, no network).
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as { goldLayer: { status: string; reason: string | null } };
    expect(body.goldLayer.status).toBe('BLOCKED');
    expect(body.goldLayer.reason).toBe('CREDENTIAL_UNAVAILABLE');
  });
});
