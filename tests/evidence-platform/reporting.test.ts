// Sprint A12 + parsers/hash — Reporting, CSV parsing, hashing tests

import { describe, it, expect } from 'vitest';
import * as reporting from '../../src/lib/evidence-platform/reporting';
import { parseCsv, normalizeCsv, normalizeJson, slugify } from '../../src/lib/evidence-platform/parsers';
import { sha256, checksumOfSource, fingerprintDataset } from '../../src/lib/evidence-platform/hash';
import { IntegrityEngine } from '../../src/lib/evidence-platform/integrityEngine';
import { CoverageAnalyzer } from '../../src/lib/evidence-platform/coverageAnalyzer';
import { ManifestGenerator } from '../../src/lib/evidence-platform/manifestGenerator';
import { DatasetValidator } from '../../src/lib/dataset/validator';
import { cleanDataset } from './fixtures';
import type { DatasetRegistryEntry } from '../../src/lib/evidence-platform/types';

describe('hash utilities', () => {
  it('produces deterministic sha256', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
    expect(sha256('abc')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('checksums strings and objects', () => {
    expect(checksumOfSource('x')).toBe(sha256('x'));
    expect(checksumOfSource({ a: 1 })).toBe(sha256(JSON.stringify({ a: 1 })));
  });

  it('fingerprints datasets order-independently', () => {
    const a = cleanDataset();
    const b = cleanDataset();
    b.matches.reverse();
    expect(fingerprintDataset(a)).toBe(fingerprintDataset(b));
  });
});

describe('parsers', () => {
  it('slugifies names', () => {
    expect(slugify('Manchester United!')).toBe('manchester-united');
    expect(slugify('  A  B  ')).toBe('a-b');
  });

  it('parses CSV with quoted fields', () => {
    const table = parseCsv('a,b,c\n1,"hello, world",3\n4,5,6');
    expect(table.headers).toEqual(['a', 'b', 'c']);
    expect(table.rows.length).toBe(2);
    expect(table.rows[0].b).toBe('hello, world');
  });

  it('returns empty table for empty text', () => {
    expect(parseCsv('').rows.length).toBe(0);
  });

  it('normalizes CSV rows into a bundle', () => {
    const table = parseCsv('Date,HomeTeam,AwayTeam,FTHG,FTAG\n2024-08-17T14:00:00Z,Alpha,Bravo,2,1');
    const out = normalizeCsv(table, { homeTeam: 'HomeTeam', awayTeam: 'AwayTeam', kickoff: 'Date', homeGoals: 'FTHG', awayGoals: 'FTAG' }, 'comp:epl', 'season:epl:2024-2025', 'football-data');
    expect(out.bundle.fixtures.length).toBe(1);
    expect(out.bundle.results.length).toBe(1);
    expect(out.teams.length).toBe(2);
    expect(out.competitions[0].id).toBe('comp:epl');
  });

  it('normalizes JSON and derives missing teams', () => {
    const out = normalizeJson({
      fixtures: [{ id: 'f1', competitionId: 'comp:epl', seasonId: 's', homeTeamId: 'team:epl:alpha', awayTeamId: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z', status: 'finished' }],
      odds: [],
      results: [],
    }, 'comp:epl', 'season:epl:2024-2025');
    expect(out.teams.length).toBe(2);
    expect(out.bundle.fixtures.length).toBe(1);
  });

  it('throws on invalid JSON payloads', () => {
    expect(() => normalizeJson(null, 'comp:epl', 's')).toThrow();
  });
});

describe('A12 — reporting', () => {
  const entry: DatasetRegistryEntry = {
    id: 'ds_000001',
    provider: 'football-data',
    leagueId: 'comp:epl',
    seasonId: 'season:epl:2024-2025',
    sourcePath: '/x.csv',
    checksum: 'a'.repeat(64),
    fingerprint: 'b'.repeat(64),
    fileSize: 1234,
    createdAt: '2025-01-01T00:00:00Z',
    importedAt: '2025-01-02T00:00:00Z',
    schemaVersion: 'v1',
    rowCount: 3,
    integrityScore: 100,
    version: '1.0.0',
    status: 'validated',
  };

  it('renders a dataset report in markdown', () => {
    const ds = cleanDataset();
    const manifest = new ManifestGenerator().generate({ dataset: ds, checksum: 'c', provider: 'p', competition: 'comp:epl', season: 's' });
    const md = reporting.datasetReportMarkdown(entry, manifest);
    expect(md).toContain('# Dataset Report — ds_000001');
    expect(md).toContain('Integrity Score');
    expect(md).toContain('Validation Summary');
  });

  it('renders integrity reports in markdown and CSV', () => {
    const report = new IntegrityEngine().verify(cleanDataset());
    const md = reporting.integrityReportMarkdown(report);
    expect(md).toContain('Integrity Report');
    expect(md).toContain('Score:** 100/100');
    const csv = reporting.integrityReportCSV(report);
    expect(csv.split('\n')[0]).toBe('check,severity,fixtureId,message');
  });

  it('renders coverage reports in markdown and CSV', () => {
    const report = new CoverageAnalyzer().analyze(cleanDataset());
    const md = reporting.coverageReportMarkdown(report);
    expect(md).toContain('Coverage Report');
    expect(md).toContain('| League |');
    const csv = reporting.coverageReportCSV(report);
    expect(csv.split('\n')[0]).toContain('league,season,fixtures');
    expect(csv.split('\n').length).toBe(2);
  });

  it('renders validation reports in markdown', () => {
    const ds = cleanDataset();
    const report = new DatasetValidator().validate(ds, ds.teams, ds.competitions);
    const md = reporting.validationReportMarkdown(report);
    expect(md).toContain('Validation Report');
    expect(md).toContain('Total fixtures: 3');
  });

  it('serializes to JSON', () => {
    expect(JSON.parse(reporting.toJSON({ a: 1 })).a).toBe(1);
  });
});
