// Sprint A3 + A4 + A5 — Manifest, Integrity, Coverage tests

import { describe, it, expect } from 'vitest';
import { IntegrityEngine } from '../../src/lib/evidence-platform/integrityEngine';
import { ManifestGenerator } from '../../src/lib/evidence-platform/manifestGenerator';
import { CoverageAnalyzer } from '../../src/lib/evidence-platform/coverageAnalyzer';
import { buildDataset, cleanDataset, makeMatch } from './fixtures';

describe('A4 — IntegrityEngine', () => {
  const engine = new IntegrityEngine();

  it('gives a clean dataset a perfect score', () => {
    const report = engine.verify(cleanDataset());
    expect(report.score).toBe(100);
    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBe(0);
    expect(report.passedChecks).toBe(report.totalChecks);
    expect(report.totalChecks).toBe(12);
  });

  it('detects duplicate fixture IDs', () => {
    const ds = buildDataset([
      makeMatch({ id: 'dup', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z' }),
      makeMatch({ id: 'dup', home: 'team:epl:charlie', away: 'team:epl:delta', kickoff: '2024-08-18T12:00:00Z' }),
    ]);
    const report = engine.verify(ds);
    expect(report.issues.some((i) => i.check === 'duplicate_fixtures')).toBe(true);
    expect(report.score).toBeLessThan(100);
  });

  it('detects negative and invalid odds', () => {
    const neg = buildDataset([
      makeMatch({ id: 'f1', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z', odds: [{ market: 'ML', homeOdds: -2, drawOdds: 3, awayOdds: 4, provider: 'b' }] }),
    ]);
    const negReport = engine.verify(neg);
    expect(negReport.issues.some((i) => i.check === 'negative_odds')).toBe(true);

    const invalid = buildDataset([
      makeMatch({ id: 'f2', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z', odds: [{ market: 'ML', homeOdds: 0.5, drawOdds: 3, awayOdds: 4, provider: 'b' }] }),
    ]);
    const invReport = engine.verify(invalid);
    expect(invReport.issues.some((i) => i.check === 'invalid_odds')).toBe(true);
  });

  it('detects invalid scores', () => {
    const ds = buildDataset([
      { ...makeMatch({ id: 'f1', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z' }), result: { fixtureId: 'f1', homeGoals: -1, awayGoals: 2, status: 'finished' } },
    ]);
    const report = engine.verify(ds);
    expect(report.issues.some((i) => i.check === 'invalid_scores')).toBe(true);
  });

  it('detects missing team references', () => {
    const ds = buildDataset([
      makeMatch({ id: 'f1', home: 'team:epl:ghost', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z' }),
    ]);
    const report = engine.verify(ds);
    expect(report.issues.some((i) => i.check === 'missing_teams')).toBe(true);
  });

  it('warns on missing bookmaker and non-chronological order', () => {
    const ds = buildDataset([
      makeMatch({ id: 'f2', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-24T12:00:00Z', odds: [{ market: 'ML', homeOdds: 2, drawOdds: 3, awayOdds: 4 }] }),
      makeMatch({ id: 'f1', home: 'team:epl:charlie', away: 'team:epl:delta', kickoff: '2024-08-17T12:00:00Z', odds: [{ market: 'ML', homeOdds: 2, drawOdds: 3, awayOdds: 4 }] }),
    ]);
    // remove provider to trigger missing_bookmakers
    ds.matches.forEach((m) => m.odds.forEach((o) => { (o as { provider?: string }).provider = undefined; }));
    const report = engine.verify(ds);
    expect(report.issues.some((i) => i.check === 'missing_bookmakers')).toBe(true);
    expect(report.issues.some((i) => i.check === 'chronological_ordering')).toBe(true);
    expect(report.warningCount).toBeGreaterThan(0);
    expect(report.score).toBeLessThan(100);
  });

  it('warns on timezone inconsistency', () => {
    const ds = buildDataset([
      makeMatch({ id: 'f1', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z' }),
      makeMatch({ id: 'f2', home: 'team:epl:charlie', away: 'team:epl:delta', kickoff: '2024-08-18T12:00:00+02:00' }),
    ]);
    const report = engine.verify(ds);
    expect(report.issues.some((i) => i.check === 'timezone_consistency')).toBe(true);
  });

  it('detects duplicate logical matches', () => {
    const ds = buildDataset([
      makeMatch({ id: 'a', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z' }),
      makeMatch({ id: 'b', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z' }),
    ]);
    const report = engine.verify(ds);
    expect(report.issues.some((i) => i.check === 'duplicate_matches')).toBe(true);
  });
});

describe('A3 — ManifestGenerator', () => {
  const gen = new ManifestGenerator();

  it('generates a manifest with fingerprint and validation summary', () => {
    const ds = cleanDataset();
    const manifest = gen.generate({ dataset: ds, checksum: 'chk', provider: 'football-data', competition: 'comp:epl', season: 'season:epl:2024-2025' });
    expect(manifest.datasetId).toBe(ds.manifest.id);
    expect(manifest.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.checksum).toBe('chk');
    expect(manifest.provider).toBe('football-data');
    expect(manifest.rowCount).toBe(3);
    expect(manifest.validationSummary.valid).toBe(true);
    expect(manifest.schemaVersion).toBe('v1');
  });

  it('detects missing fields', () => {
    const ds = buildDataset([
      { ...makeMatch({ id: 'f1', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z' }), odds: [] },
    ]);
    const manifest = gen.generate({ dataset: ds, checksum: 'c', provider: 'p', competition: 'comp:epl', season: 's' });
    expect(manifest.missingFields).toContain('odds');
    expect(manifest.missingFields).toContain('odds.closing');
  });

  it('serializes to JSON', () => {
    const ds = cleanDataset();
    const manifest = gen.generate({ dataset: ds, checksum: 'c', provider: 'p', competition: 'comp:epl', season: 's' });
    const json = gen.toJSON(manifest);
    expect(JSON.parse(json).datasetId).toBe(ds.manifest.id);
  });
});

describe('A5 — CoverageAnalyzer', () => {
  const analyzer = new CoverageAnalyzer();

  it('computes per-league fixture and odds coverage', () => {
    const report = analyzer.analyze(cleanDataset());
    expect(report.leagues.length).toBe(1);
    const epl = report.leagues[0];
    expect(epl.leagueId).toBe('comp:epl');
    expect(epl.fixtures.pct).toBe(100);
    expect(epl.odds.pct).toBe(100);
    expect(epl.moneyline.pct).toBe(100);
    expect(epl.closingOdds.pct).toBe(0);
    expect(epl.xg.pct).toBe(0);
  });

  it('honours enrichment inputs for xG/lineups/injuries/weather', () => {
    const ds = cleanDataset();
    const report = analyzer.analyze(ds, {
      fixturesWithXg: ['fix:1', 'fix:2', 'fix:3'],
      fixturesWithLineups: ['fix:1'],
    });
    const epl = report.leagues[0];
    expect(epl.xg.pct).toBe(100);
    expect(epl.lineups.pct).toBeCloseTo(33.33, 1);
    expect(epl.injuries.pct).toBe(0);
  });

  it('detects closing odds coverage', () => {
    const ds = buildDataset([
      makeMatch({ id: 'f1', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z', odds: [{ market: 'ML', homeOdds: 2, drawOdds: 3, awayOdds: 4, closingHomeOdds: 1.9, provider: 'b' }] }),
    ]);
    const report = analyzer.analyze(ds);
    expect(report.leagues[0].closingOdds.pct).toBe(100);
  });

  it('computes AH and OU coverage', () => {
    const ds = buildDataset([
      makeMatch({ id: 'f1', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z', odds: [
        { market: 'ML', homeOdds: 2, drawOdds: 3, awayOdds: 4, provider: 'b' },
        { market: 'AH', line: -0.5, homeOdds: 1.9, drawOdds: null, awayOdds: 2.0, provider: 'b' },
        { market: 'OU', line: 2.5, homeOdds: 1.8, drawOdds: null, awayOdds: 2.1, provider: 'b' },
      ] }),
    ]);
    const report = analyzer.analyze(ds);
    expect(report.leagues[0].asianHandicap.pct).toBe(100);
    expect(report.leagues[0].overUnder.pct).toBe(100);
  });

  it('reports an overall coverage percentage', () => {
    const report = analyzer.analyze(cleanDataset());
    expect(report.overallPct).toBeGreaterThan(0);
    expect(report.overallPct).toBeLessThanOrEqual(100);
  });
});
