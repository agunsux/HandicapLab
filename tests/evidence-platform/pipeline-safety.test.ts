// Sprint A6 + A7 + A8 + A9 — Leakage, Provenance, Versioning, Diff tests

import { describe, it, expect } from 'vitest';
import { LeakageDetector } from '../../src/lib/evidence-platform/leakageDetector';
import { ProvenanceEngine } from '../../src/lib/evidence-platform/provenanceEngine';
import { DatasetVersionStore } from '../../src/lib/evidence-platform/datasetVersionStore';
import { DiffEngine } from '../../src/lib/evidence-platform/diffEngine';
import { fingerprintDataset } from '../../src/lib/evidence-platform/hash';
import { buildDataset, cleanDataset, makeMatch } from './fixtures';

describe('A6 — LeakageDetector', () => {
  const detector = new LeakageDetector();

  it('passes a clean dataset', () => {
    const report = detector.detect(cleanDataset(), { flagClosingOdds: false });
    expect(report.passed).toBe(true);
    expect(report.issues.length).toBe(0);
  });

  it('detects future data leakage (odds after kickoff)', () => {
    const ds = buildDataset([
      makeMatch({ id: 'f1', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z', odds: [{ market: 'ML', homeOdds: 2, drawOdds: 3, awayOdds: 4, provider: 'b', timestamp: '2024-08-17T15:00:00Z' }] }),
    ]);
    const report = detector.detect(ds);
    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.check === 'future_data')).toBe(true);
  });

  it('detects result leakage on non-finished fixtures', () => {
    const ds = buildDataset([
      { ...makeMatch({ id: 'f1', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z', status: 'scheduled', withResult: true }) },
    ]);
    const report = detector.detect(ds);
    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.check === 'result_leakage')).toBe(true);
    expect(report.issues.some((i) => i.check === 'post_match_field')).toBe(true);
  });

  it('warns on closing odds presence', () => {
    const ds = buildDataset([
      makeMatch({ id: 'f1', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z', odds: [{ market: 'ML', homeOdds: 2, drawOdds: 3, awayOdds: 4, provider: 'b', closingHomeOdds: 1.9 }] }),
    ]);
    const report = detector.detect(ds, { flagClosingOdds: true });
    expect(report.issues.some((i) => i.check === 'closing_odds')).toBe(true);
    // warnings do not fail the dataset
    expect(report.passed).toBe(true);
  });

  it('validates feature timestamps against kickoff', () => {
    const ds = cleanDataset();
    const report = detector.detect(ds, {
      flagClosingOdds: false,
      featureTimestamps: [
        { fixtureId: 'fix:1', feature: 'elo', timestamp: '2024-08-16T00:00:00Z' }, // ok
        { fixtureId: 'fix:2', feature: 'form', timestamp: '2024-08-19T00:00:00Z' }, // after kickoff
      ],
    });
    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.check === 'feature_timestamp' && i.fixtureId === 'fix:2')).toBe(true);
  });
});

describe('A7 — ProvenanceEngine', () => {
  const engine = new ProvenanceEngine();

  it('creates a frozen provenance record with defaults', () => {
    const p = engine.create({ provider: 'football-data', version: '1.0.0', source: '/x.csv', checksum: 'c', fingerprint: 'f' });
    expect(Object.isFrozen(p)).toBe(true);
    expect(p.schemaVersion).toBe('v1');
    expect(p.validationVersion).toBe('1.0.0');
    expect(p.downloadDate).toBeTruthy();
    expect(p.importDate).toBeTruthy();
  });

  it('derives provenance from a dataset (checksum + fingerprint)', () => {
    const ds = cleanDataset();
    const p = engine.fromDataset(ds, 'raw-source-bytes', { provider: 'p', version: '2.0.0', source: 's' });
    expect(p.fingerprint).toBe(fingerprintDataset(ds));
    expect(p.version).toBe('2.0.0');
  });

  it('verifies a dataset against its provenance', () => {
    const ds = cleanDataset();
    const p = engine.fromDataset(ds, 'raw', { provider: 'p', version: '1', source: 's' });
    expect(engine.verify(ds, p)).toBe(true);
    const other = buildDataset([makeMatch({ id: 'z', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z' })]);
    expect(engine.verify(other, p)).toBe(false);
  });
});

describe('A8 — DatasetVersionStore', () => {
  it('assigns sequential immutable versions v1, v2, v3', () => {
    const store = new DatasetVersionStore();
    const key = 'epl:2024-2025';
    const v1 = store.commit(key, cleanDataset());
    const v2 = store.commit(key, buildDataset([makeMatch({ id: 'x', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z' })], 'dataset:v2'));
    const v3 = store.commit(key, buildDataset([makeMatch({ id: 'y', home: 'team:epl:charlie', away: 'team:epl:delta', kickoff: '2024-08-18T12:00:00Z' })], 'dataset:v3'));
    expect(v1.version).toBe('v1');
    expect(v2.version).toBe('v2');
    expect(v3.version).toBe('v3');
    expect(Object.isFrozen(v1)).toBe(true);
    expect(store.versionCount(key)).toBe(3);
  });

  it('retrieves specific and latest versions', () => {
    const store = new DatasetVersionStore();
    const key = 'k';
    store.commit(key, cleanDataset());
    const v2 = store.commit(key, buildDataset([makeMatch({ id: 'x', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z' })], 'dataset:v2'));
    expect(store.getVersion(key, 'v1')?.version).toBe('v1');
    expect(store.getLatest(key)?.datasetId).toBe(v2.datasetId);
    expect(store.getVersion(key, 'v99')).toBeUndefined();
    expect(store.getLatest('missing')).toBeUndefined();
  });

  it('detects duplicate fingerprints', () => {
    const store = new DatasetVersionStore();
    const key = 'k';
    const ds = cleanDataset();
    store.commit(key, ds);
    expect(store.isDuplicate(key, ds)).toBe(true);
    expect(store.isDuplicate(key, buildDataset([makeMatch({ id: 'x', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z' })]))).toBe(false);
  });

  it('lists keys and versions', () => {
    const store = new DatasetVersionStore();
    store.commit('a', cleanDataset());
    store.commit('b', cleanDataset());
    expect([...store.listKeys()].sort()).toEqual(['a', 'b']);
    expect(store.listVersions('a').length).toBe(1);
  });
});

describe('A9 — DiffEngine', () => {
  const engine = new DiffEngine();

  it('reports identical datasets', () => {
    const diff = engine.diff(cleanDataset(), cleanDataset());
    // same fixtures/odds/kickoffs => no fixture/odds/timestamp changes
    expect(diff.addedFixtures.length).toBe(0);
    expect(diff.removedFixtures.length).toBe(0);
    expect(diff.changedOdds.length).toBe(0);
    expect(diff.changedTimestamps.length).toBe(0);
  });

  it('detects added and removed fixtures', () => {
    const from = buildDataset([makeMatch({ id: 'f1', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z' })], 'a');
    const to = buildDataset([makeMatch({ id: 'f2', home: 'team:epl:charlie', away: 'team:epl:delta', kickoff: '2024-08-18T12:00:00Z' })], 'b');
    const diff = engine.diff(from, to);
    expect(diff.addedFixtures).toContain('f2');
    expect(diff.removedFixtures).toContain('f1');
    expect(diff.identical).toBe(false);
  });

  it('detects changed odds', () => {
    const from = buildDataset([makeMatch({ id: 'f1', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z', odds: [{ market: 'ML', homeOdds: 2.0, drawOdds: 3, awayOdds: 4, provider: 'b' }] })], 'a');
    const to = buildDataset([makeMatch({ id: 'f1', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z', odds: [{ market: 'ML', homeOdds: 2.5, drawOdds: 3, awayOdds: 4, provider: 'b' }] })], 'b');
    const diff = engine.diff(from, to);
    expect(diff.changedOdds.some((c) => c.field === 'homeOdds' && c.before === 2.0 && c.after === 2.5)).toBe(true);
  });

  it('detects changed kickoff timestamps', () => {
    const from = buildDataset([makeMatch({ id: 'f1', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z' })], 'a');
    const to = buildDataset([makeMatch({ id: 'f1', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T15:00:00Z' })], 'b');
    const diff = engine.diff(from, to);
    expect(diff.changedTimestamps.some((c) => c.field === 'kickoff')).toBe(true);
  });

  it('detects metadata changes', () => {
    const from = buildDataset([makeMatch({ id: 'f1', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z' })], 'a');
    const to = buildDataset([
      makeMatch({ id: 'f1', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z' }),
      makeMatch({ id: 'f2', home: 'team:epl:charlie', away: 'team:epl:delta', kickoff: '2024-08-18T12:00:00Z' }),
    ], 'b');
    const diff = engine.diff(from, to);
    expect(diff.changedMetadata.some((c) => c.field === 'fixtureCount')).toBe(true);
  });
});
