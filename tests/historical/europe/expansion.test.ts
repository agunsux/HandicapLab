// EPIC: Historical European 3-Cluster dataset — unit/integration tests.
// Location: tests/historical/europe/expansion.test.ts

import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { EUROPEAN_LEAGUE_REGISTRY, getLeagueByFootballDataCode, classifyCluster } from '../../../src/historical/europe/leagueRegistry';
import type { LeagueEntry } from '../../../src/historical/europe/types';
import { readFootballDataCsv, type RawFootballDataRow } from '../../../src/historical/europe/footballDataReader';
import { deriveResult, deriveMarkets, normalizeRecord } from '../../../src/historical/europe/normalize';
import { discoverLeagueSources } from '../../../src/historical/europe/sourceDiscovery';
import { buildHistoricalDataset } from '../../../src/historical/europe/ingest';

function league(id: string): LeagueEntry {
  const l = EUROPEAN_LEAGUE_REGISTRY.find((x) => x.leagueId === id);
  if (!l) throw new Error(`league ${id} not in registry`);
  return l;
}

function rawRow(over: Partial<RawFootballDataRow> = {}): RawFootballDataRow {
  return {
    div: 'E0',
    season: '2020-2021',
    sourceFile: 'test.csv',
    sourceRow: 2,
    dateIso: '2020-09-12',
    homeTeam: 'Fulham',
    awayTeam: 'Arsenal',
    homeGoals: 0,
    awayGoals: 3,
    ftr: 'A',
    bookmakerSource: 'pinnacle',
    h1: 6.5, d1: 4.2, a1: 1.53,
    ch1: null, cd1: null, ca1: null,
    ahLine: null, ahHome: null, ahAway: null,
    chLine: null, chHome: null, chAway: null,
    ouLine: null, over: null, under: null,
    couLine: null, cover: null, cunder: null,
    b365H: null, b365D: null, b365A: null, b365CH: null, b365CD: null, b365CA: null,
    b365AhHome: null, b365AhAway: null, b365AhCloseHome: null, b365AhCloseAway: null,
    bbAhLine: null, bbAhHome: null, bbAhAway: null,
    b365Over: null, b365Under: null, b365Cover: null, b365Cunder: null,
    bbOver: null, bbUnder: null,
    ...over,
  };
}

describe('1. League classification (same league → same cluster, deterministic)', () => {
  it('maps football-data.co.uk codes to the 3 clusters', () => {
    expect(getLeagueByFootballDataCode('E0')?.leagueId).toBe('ENG-PL');
    expect(getLeagueByFootballDataCode('SP1')?.cluster).toBe('A');
    expect(getLeagueByFootballDataCode('D1')?.cluster).toBe('A');
    expect(getLeagueByFootballDataCode('I1')?.cluster).toBe('A');
    expect(getLeagueByFootballDataCode('F1')?.cluster).toBe('A');
    expect(classifyCluster('NED-ERE')).toBe('B');
    expect(classifyCluster('SWE-AL')).toBe('C');
  });

  it('registry is unique and deterministic', () => {
    const ids = EUROPEAN_LEAGUE_REGISTRY.map((l) => l.leagueId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(EUROPEAN_LEAGUE_REGISTRY.filter((l) => l.cluster === 'A' && l.status === 'INCLUDED').length).toBe(5);
  });
});

describe('2. Result + derived markets are deterministic', () => {
  it('2-0 → H, 1-1 → D, 0-2 → A', () => {
    expect(deriveResult(2, 0)).toBe('H');
    expect(deriveResult(1, 1)).toBe('D');
    expect(deriveResult(0, 2)).toBe('A');
  });

  it('derives BTTS and OU thresholds from the scoreline', () => {
    const m = deriveMarkets(2, 1);
    expect(m.totalGoals).toBe(3);
    expect(m.btts).toBe(true);
    expect(m.over25).toBe(true);
    expect(m.under25).toBe(false);
    expect(m.over35).toBe(false);
  });
});

describe('3. Data integrity — reject, never fabricate', () => {
  it('rejects negative goals', () => {
    const { match, rejectReason } = normalizeRecord(rawRow({ homeGoals: -1, awayGoals: 1 }), league('ENG-PL'));
    expect(match).toBeNull();
    expect(rejectReason).toBe('negative_goals');
  });

  it('rejects home == away', () => {
    const { rejectReason } = normalizeRecord(rawRow({ homeTeam: 'Arsenal', awayTeam: 'Arsenal' }), league('ENG-PL'));
    expect(rejectReason).toBe('home_equals_away');
  });

  it('rejects invalid date', () => {
    const { rejectReason } = normalizeRecord(rawRow({ dateIso: null }), league('ENG-PL'));
    expect(rejectReason).toBe('invalid_date');
  });

  it('rejects result inconsistencies (FTR mismatch)', () => {
    const { rejectReason } = normalizeRecord(rawRow({ homeGoals: 2, awayGoals: 0, ftr: 'A' }), league('ENG-PL'));
    expect(rejectReason).toBe('result_mismatch');
  });

  it('accepts a valid record with derived identity', () => {
    const { match } = normalizeRecord(rawRow(), league('ENG-PL'));
    expect(match?.result).toBe('A');
    expect(match?.totalGoals).toBe(3);
    expect(match?.canonicalId).toBe('ENG-PL|2020-2021|2020-09-12|fulham|arsenal');
  });
});

describe('4. No synthetic data — missing odds stay null', () => {
  it('reader never invents odds when columns are absent', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eurotest-'));
    const file = path.join(dir, '2020-2021.csv');
    // Header deliberately lacks all odds columns.
    fs.writeFileSync(file, 'Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR\nE0,12/09/2020,Fulham,Arsenal,0,3,A\n');
    const { rows, parseError } = readFootballDataCsv(file, '2020-2021');
    expect(parseError).toBeNull();
    expect(rows.length).toBe(1);
    expect(rows[0].h1).toBeNull();
    expect(rows[0].over).toBeNull();
    expect(rows[0].bookmakerSource).toBe('none');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('discovery returns no sources for leagues without files (EXCLUDED stays excluded)', () => {
    const { descriptors } = discoverLeagueSources('NED-ERE', 'N1');
    expect(descriptors.length).toBe(0);
  });
});

describe('5. Duplicate detection + source priority (real overlapping EPL files)', () => {
  it('EPL seasons exist in both bronze roots and dedup keeps the highest priority', () => {
    const { dedupDecisions } = buildHistoricalDataset();
    const engDups = dedupDecisions.filter((d) => d.canonicalId.startsWith('ENG-PL|'));
    // 2016-2017..2019-2020 EPL seasons exist in BOTH roots → duplicates resolved.
    expect(engDups.length).toBeGreaterThanOrEqual(4);
    for (const d of engDups) {
      expect(d.keptSource).toContain('data' + path.sep + 'bronze' + path.sep + 'football_data');
      expect(d.discardedSources.length).toBeGreaterThan(0);
    }
  });
});

describe('6. Determinism — two runs produce identical canonical output', () => {
  it('produces a stable hash and identical canonical id list', () => {
    const first = buildHistoricalDataset();
    const second = buildHistoricalDataset();
    expect(second.manifest.hash).toBe(first.manifest.hash);
    expect(first.matches.map((m) => m.canonicalId)).toEqual(second.matches.map((m) => m.canonicalId));
    expect(first.matches.length).toBe(second.matches.length);
  });

  it('cluster A leagues all have real, validated data', () => {
    const { leagues } = buildHistoricalDataset();
    const aIds = ['ENG-PL', 'ESP-LALIGA', 'DEU-BUNDESLIGA', 'ITA-SERIEA', 'FRA-LIGUE1'];
    for (const id of aIds) {
      const l = leagues.find((x) => x.leagueId === id);
      expect(l?.status).toBe('INCLUDED');
      expect((l?.valid ?? 0)).toBeGreaterThan(0);
      expect(l?.readiness.ml).not.toBe('INSUFFICIENT');
    }
  });
});

describe('7. Coverage helper sanity', () => {
  it('computes usable market counts and readiness from records', () => {
    const { match } = normalizeRecord(rawRow(), league('ENG-PL'));
    const { leagues } = buildHistoricalDataset();
    const eng = leagues.find((x) => x.leagueId === 'ENG-PL')!;
    expect(eng.name).toBe('Premier League');
    expect(eng.coverage.ml).toBeGreaterThan(0);
    expect(eng.coverage.btts).toBe(eng.valid);
    void match;
  });
});
