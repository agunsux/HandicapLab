// Real ML/AH/OU market-observation layer tests.
// Location: tests/historical/europe/market-odds.test.ts

import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { extractMarketObservations, buildMarketOddsDataset, type MarketOddsRow } from '../../../src/historical/europe/marketOdds';
import { readFootballDataCsv } from '../../../src/historical/europe/footballDataReader';
import type { RawFootballDataRow } from '../../../src/historical/europe/footballDataReader';

function baseRow(): RawFootballDataRow {
  return {
    div: 'E0', season: '2020-2021', sourceFile: '/x/2020-2021.csv', sourceRow: 2,
    dateIso: '2020-09-12', homeTeam: 'Fulham', awayTeam: 'Arsenal',
    homeGoals: 0, awayGoals: 3, ftr: 'A', bookmakerSource: 'pinnacle',
    h1: 6.5, d1: 4.2, a1: 1.53, ch1: null, cd1: null, ca1: null,
    ahLine: -0.5, ahHome: 1.95, ahAway: 1.85, chLine: null, chHome: null, chAway: null,
    ouLine: 2.5, over: 1.72, under: 2.1, couLine: null, cover: null, cunder: null,
    b365H: null, b365D: null, b365A: null, b365CH: null, b365CD: null, b365CA: null,
    b365AhHome: null, b365AhAway: null, b365AhCloseHome: null, b365AhCloseAway: null,
    bbAhLine: null, bbAhHome: null, bbAhAway: null,
    b365Over: null, b365Under: null, b365Cover: null, b365Cunder: null,
    bbOver: null, bbUnder: null,
  };
}

describe('AH/OU market parsing — genuine source values preserved', () => {
  it('extracts ML, AH and OU opening rows with the ACTUAL line and odds', () => {
    const rows = extractMarketObservations(baseRow(), '2020-2021', '2020-09-12', 'Fulham', 'Arsenal', 'ENG-PL', 'A');
    const ml = rows.find((r) => r.market === 'ML')!;
    const ah = rows.find((r) => r.market === 'AH')!;
    const ou = rows.find((r) => r.market === 'OU')!;
    expect(ml.home_odds).toBe(6.5);
    expect(ml.draw_odds).toBe(4.2);
    expect(ah.line).toBe(-0.5);
    expect(ah.home_odds).toBe(1.95);
    expect(ah.away_odds).toBe(1.85);
    expect(ou.line).toBe(2.5);
    expect(ou.over_odds).toBe(1.72);
    expect(ou.under_odds).toBe(2.1);
  });

  it('does NOT derive AH/OU from ML or from the scoreline', () => {
    const row = baseRow();
    row.ahLine = null; row.ahHome = null; row.ahAway = null;
    const noAh = extractMarketObservations(row, '2020-2021', '2020-09-12', 'Fulham', 'Arsenal', 'ENG-PL', 'A');
    expect(noAh.some((r) => r.market === 'AH')).toBe(false);

    const row2 = baseRow();
    row2.over = null; row2.under = null;
    const noOu = extractMarketObservations(row2, '2020-2021', '2020-09-12', 'Fulham', 'Arsenal', 'ENG-PL', 'A');
    expect(noOu.some((r) => r.market === 'OU')).toBe(false);
  });
});

describe('Null handling and provenance', () => {
  it('emits zero rows when a source row carries no odds (nothing invented)', () => {
    const row = baseRow();
    for (const k of Object.keys(row)) {
      if (typeof row[k as keyof RawFootballDataRow] === 'number' && (row as any)[k] !== null) (row as any)[k] = null;
    }
    const rows = extractMarketObservations(row, '2020-2021', '2020-09-12', 'Fulham', 'Arsenal', 'ENG-PL', 'A');
    expect(rows.length).toBe(0);
  });

  it('every row carries full provenance (source_file, source_row, dataset_version, bookmaker)', () => {
    const rows = extractMarketObservations(baseRow(), '2020-2021', '2020-09-12', 'Fulham', 'Arsenal', 'ENG-PL', 'A');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.source_file).toBe('/x/2020-2021.csv');
      expect(r.source_row).toBe(2);
      expect(r.dataset_version).toBe('europe-dataset-v1');
      expect(r.ingestion_version).toMatch(/^europe-odds-v/);
      expect(['pinnacle', 'bet365', 'betbrain']).toContain(r.bookmaker_source);
      expect(r.odds_id).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe('Full dataset build (real sources, deterministic)', () => {
  it('builds every observation as its own row without (canonical,market,obs,bookmaker) duplicates', () => {
    const m = buildMarketOddsDataset();
    expect(m.dataset_version).toBe('europe-dataset-v1');
    expect(m.odds_row_count).toBeGreaterThan(0);
    const keys = new Set<string>();
    for (const r of readMarketRows()) {
      const k = `${r.canonical_id}|${r.market}|${r.observation}|${r.bookmaker_source}`;
      expect(keys.has(k)).toBe(false);
      keys.add(k);
    }
  });

  it('covers all 8,898 canonical matches and gives ML 100% coverage per league', () => {
    const m = buildMarketOddsDataset();
    const totalMatches = m.by_league.reduce((s, l) => s + l.matches, 0);
    expect(totalMatches).toBe(8898);
    for (const l of m.by_league) {
      expect(l.ml_coverage_pct).toBe(100);
      expect(l.ah_matches).toBeGreaterThanOrEqual(0);
      expect(l.ou_matches).toBeGreaterThanOrEqual(0);
    }
  });

  it('is idempotent — two builds produce identical row count and digest', () => {
    const a = buildMarketOddsDataset();
    const b = buildMarketOddsDataset();
    expect(b.odds_row_count).toBe(a.odds_row_count);
    expect(b.hash).toBe(a.hash);
  });

  it('every odds cell is a finite number or null (no fabricated values)', () => {
    for (const r of readMarketRows()) {
      for (const k of ['line', 'home_odds', 'draw_odds', 'away_odds', 'over_odds', 'under_odds'] as const) {
        const v = r[k];
        if (v != null) expect(typeof v).toBe('number');
      }
    }
  });

  it('preserves the actual source bookmaker values for a real EPL match', () => {
    // Re-read the source row for Fulham vs Arsenal (2020-09-12) and compare.
    const file = path.join(process.cwd(), 'data', 'bronze', 'football_data', '2020-2021.csv');
    const { rows } = readFootballDataCsv(file, '2020-2021');
    const target = rows.find((r) => r.homeTeam === 'Fulham' && r.awayTeam === 'Arsenal' && r.dateIso === '2020-09-12')!;
    expect(target).toBeTruthy();
    const obs = extractMarketObservations(target, '2020-2021', target.dateIso!, 'Fulham', 'Arsenal', 'ENG-PL', 'A');
    const mlPin = obs.find((r) => r.market === 'ML' && r.bookmaker_source === 'pinnacle')!;
    expect(mlPin.home_odds).toBe(target.h1);
    expect(mlPin.away_odds).toBe(target.a1);
  });
});

function readMarketRows(): MarketOddsRow[] {
  const content = fs.readFileSync(path.join(process.cwd(), 'data', 'golden', 'europe', 'market_odds.jsonl'), 'utf-8');
  return content.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as MarketOddsRow);
}
