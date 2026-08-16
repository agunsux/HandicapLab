// Gold-layer loader correctness — proves the exact payload the credentialed load
// will insert, without touching the database. Fail-closed behavior is asserted.
// Location: tests/historical/europe/gold-loader.test.ts

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { buildLoadPayload, loadGoldLayer } from '../../../src/historical/europe/goldDbLoader';

const KEYS = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'] as const;

describe('Gold-layer loader — deterministic payload (frozen europe-dataset-v1)', () => {
  it('builds exactly 8,898 canonical match rows', () => {
    const payload = buildLoadPayload();
    expect(payload.matches.length).toBe(8898);
  });

  it('preserves the frozen dataset version and hash', () => {
    const payload = buildLoadPayload();
    const frozen = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'golden', 'europe', 'manifest.json'), 'utf-8'));
    expect(payload.manifest.dataset_version).toBe('europe-dataset-v1');
    expect(payload.manifest.hash).toBe(frozen.hash);
    expect(payload.manifest.hash.startsWith('e2500a7b01c7569798b15429')).toBe(true);
    expect(payload.manifest.valid_match_count).toBe(8898);
    expect(payload.manifest.duplicate_count).toBe(0);
    expect(payload.manifest.rejected_match_count).toBe(0);
  });

  it('assigns every league to a cluster and matches the cluster distribution', () => {
    const payload = buildLoadPayload();
    const byCluster = new Map<string, number>();
    for (const m of payload.matches) {
      const c = String(m.cluster);
      byCluster.set(c, (byCluster.get(c) ?? 0) + 1);
    }
    expect(byCluster.get('A')).toBe(8898);
    expect(byCluster.get('B')).toBeUndefined();
    expect(byCluster.get('C')).toBeUndefined();
  });

  it('preserves the league distribution (ENG-PL 4180, ESP 1520, DEU 918, ITA 1140, FRA 1140)', () => {
    const payload = buildLoadPayload();
    const byLeague = new Map<string, number>();
    for (const m of payload.matches) {
      const k = String(m.league_id);
      byLeague.set(k, (byLeague.get(k) ?? 0) + 1);
    }
    expect(byLeague.get('ENG-PL')).toBe(4180);
    expect(byLeague.get('ESP-LALIGA')).toBe(1520);
    expect(byLeague.get('DEU-BUNDESLIGA')).toBe(918);
    expect(byLeague.get('ITA-SERIEA')).toBe(1140);
    expect(byLeague.get('FRA-LIGUE1')).toBe(1140);
    expect(byLeague.size).toBe(5);
  });

  it('loads genuine row-based ML/AH/OU observations with provenance', () => {
    const payload = buildLoadPayload();
    const marketFile = path.join(process.cwd(), 'data', 'golden', 'europe', 'market_odds.jsonl');
    const expected = fs.existsSync(marketFile)
      ? fs.readFileSync(marketFile, 'utf-8').split('\n').filter((l: string) => l.trim()).length
      : 0;
    expect(payload.odds.length).toBe(expected);
    expect(payload.odds.length).toBeGreaterThan(0);

    // Every ML opening row must be a complete 1X2 triple.
    const mlRows = payload.odds.filter((o) => o.market === 'ML' && o.observation === 'opening');
    expect(mlRows.length).toBeGreaterThan(0);
    for (const o of mlRows) {
      expect(typeof o.home_odds).toBe('number');
      expect(typeof o.draw_odds).toBe('number');
      expect(typeof o.away_odds).toBe('number');
    }
    // AH/OU rows preserve the genuine source observation: at least one numeric
    // price is present, any present cell is a finite number, and line is
    // present when the source provided it (partial observations are kept, never
    // completed with invented numbers).
    for (const o of payload.odds) {
      if (o.market === 'AH') {
        if (o.home_odds != null) expect(typeof o.home_odds).toBe('number');
        if (o.away_odds != null) expect(typeof o.away_odds).toBe('number');
        expect(o.home_odds != null || o.away_odds != null || o.line != null).toBe(true);
      }
      if (o.market === 'OU') {
        expect(o.over_odds).not.toBeNull();
        expect(o.under_odds).not.toBeNull();
        expect(o.line).toBe(2.5);
      }
    }
    // Mandatory provenance on every odds row.
    for (const o of payload.odds) {
      expect(o.source_file).toBeTruthy();
      expect(typeof o.source_row).toBe('number');
      expect(o.dataset_version).toBe('europe-dataset-v1');
    }
  });

  it('seeds all 24 league metadata rows (5 included + 19 excluded with reasons)', () => {
    const payload = buildLoadPayload();
    expect(payload.leagueMeta.length).toBe(24);
    expect(payload.leagueMeta.filter((l) => l.status === 'INCLUDED').length).toBe(5);
    expect(payload.leagueMeta.filter((l) => l.status === 'EXCLUDED').length).toBe(19);
    for (const l of payload.leagueMeta.filter((x) => x.status === 'EXCLUDED')) {
      expect(String(l.exclude_reason)).toContain('SOURCE_DATA_ABSENT');
    }
  });
});

describe('Gold-layer loader — fail-closed credential behavior', () => {
  const original: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of KEYS) {
      original[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });

  it('throws [FAIL CLOSED] without credentials — never runs against the DB', async () => {
    await expect(loadGoldLayer()).rejects.toThrow(/FAIL CLOSED/);
  });
});
