// Sprint A10 + A11 — Import Pipeline & Evidence Ledger tests

import { describe, it, expect } from 'vitest';
import {
  ImportPipeline,
  InMemoryEvidenceStorage,
} from '../../src/lib/evidence-platform/importPipeline';
import { DatasetRegistry } from '../../src/lib/evidence-platform/datasetRegistry';
import { DatasetVersionStore } from '../../src/lib/evidence-platform/datasetVersionStore';
import { DatasetEvidenceLedger } from '../../src/lib/evidence-platform/evidenceLedger';
import type { ImportSource } from '../../src/lib/evidence-platform/types';

function jsonPayload(overrides?: { status?: 'scheduled' | 'finished'; homeOdds?: number; withResult?: boolean }) {
  const status = overrides?.status ?? 'finished';
  const withResult = overrides?.withResult ?? true;
  return {
    fixtures: [
      { id: 'j1', competitionId: 'comp:epl', seasonId: 'season:epl:2024-2025', homeTeamId: 'team:epl:alpha', awayTeamId: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z', status },
      { id: 'j2', competitionId: 'comp:epl', seasonId: 'season:epl:2024-2025', homeTeamId: 'team:epl:charlie', awayTeamId: 'team:epl:delta', kickoff: '2024-08-18T12:00:00Z', status: 'finished' },
    ],
    odds: [
      { fixtureId: 'j1', market: 'ML', homeOdds: overrides?.homeOdds ?? 2.0, drawOdds: 3.4, awayOdds: 3.8, timestamp: '2024-08-17T10:00:00Z', provider: 'book-a' },
      { fixtureId: 'j2', market: 'ML', homeOdds: 2.2, drawOdds: 3.2, awayOdds: 3.5, timestamp: '2024-08-18T10:00:00Z', provider: 'book-a' },
    ],
    results: withResult
      ? [
          { fixtureId: 'j1', homeGoals: 2, awayGoals: 1, status: 'finished' },
          { fixtureId: 'j2', homeGoals: 0, awayGoals: 0, status: 'finished' },
        ]
      : [{ fixtureId: 'j2', homeGoals: 0, awayGoals: 0, status: 'finished' }],
  };
}

const CSV = [
  'Date,HomeTeam,AwayTeam,FTHG,FTAG,B365H,B365D,B365A',
  '2024-08-17T14:00:00Z,Alpha,Bravo,2,1,2.10,3.40,3.60',
  '2024-08-18T14:00:00Z,Charlie,Delta,0,0,2.50,3.20,2.90',
].join('\n');

const CSV_MAP = {
  homeTeam: 'HomeTeam',
  awayTeam: 'AwayTeam',
  kickoff: 'Date',
  homeGoals: 'FTHG',
  awayGoals: 'FTAG',
  homeOdds: 'B365H',
  drawOdds: 'B365D',
  awayOdds: 'B365A',
};

function freshPipeline() {
  return new ImportPipeline({
    registry: new DatasetRegistry(),
    versionStore: new DatasetVersionStore(),
    ledger: new DatasetEvidenceLedger(),
    storage: new InMemoryEvidenceStorage(),
  });
}

describe('A10 — ImportPipeline (JSON)', () => {
  it('imports a valid JSON payload end-to-end', () => {
    const pipeline = freshPipeline();
    const source: ImportSource = {
      format: 'json',
      provider: 'api-football',
      leagueId: 'comp:epl',
      seasonId: 'season:epl:2024-2025',
      sourcePath: 'snapshot.json',
      raw: jsonPayload(),
    };
    const result = pipeline.run(source);
    expect(result.ok).toBe(true);
    expect(result.datasetId).toMatch(/^ds_\d{6}$/);
    expect(result.manifest).not.toBeNull();
    expect(result.integrityReport?.score).toBe(100);
    expect(result.leakageReport?.passed).toBe(true);
    expect(result.provenance).not.toBeNull();
    expect(result.registryEntry?.status).toBe('validated');
    expect(result.evidenceArtifact?.artifactId).toMatch(/^evd_\d{6}$/);
  });

  it('runs all pipeline stages in order', () => {
    const pipeline = freshPipeline();
    const result = pipeline.run({ format: 'json', provider: 'p', leagueId: 'comp:epl', seasonId: 'season:epl:2024-2025', sourcePath: 's.json', raw: jsonPayload() });
    const stageNames = result.stages.map((s) => s.stage);
    expect(stageNames).toEqual(['import', 'normalize', 'canonical_mapping', 'validation', 'integrity', 'manifest', 'registry', 'storage', 'ready']);
    expect(result.stages.every((s) => s.ok)).toBe(true);
  });

  it('rejects datasets with result leakage', () => {
    const pipeline = freshPipeline();
    const result = pipeline.run({ format: 'json', provider: 'p', leagueId: 'comp:epl', seasonId: 'season:epl:2024-2025', sourcePath: 's.json', raw: jsonPayload({ status: 'scheduled' }) });
    expect(result.ok).toBe(false);
    expect(result.leakageReport?.passed).toBe(false);
    expect(result.registryEntry).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects datasets with invalid odds', () => {
    const pipeline = freshPipeline();
    const result = pipeline.run({ format: 'json', provider: 'p', leagueId: 'comp:epl', seasonId: 'season:epl:2024-2025', sourcePath: 's.json', raw: jsonPayload({ homeOdds: -1 }) });
    expect(result.ok).toBe(false);
    expect(result.registryEntry).toBeNull();
  });

  it('fails when the payload has no fixtures', () => {
    const pipeline = freshPipeline();
    const result = pipeline.run({ format: 'json', provider: 'p', leagueId: 'comp:epl', seasonId: 'season:epl:2024-2025', sourcePath: 's.json', raw: { fixtures: [], odds: [], results: [] } });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('No fixtures'))).toBe(true);
  });

  it('persists dataset to storage and versions it', () => {
    const registry = new DatasetRegistry();
    const versionStore = new DatasetVersionStore();
    const storage = new InMemoryEvidenceStorage();
    const pipeline = new ImportPipeline({ registry, versionStore, storage, ledger: new DatasetEvidenceLedger() });
    const result = pipeline.run({ format: 'json', provider: 'p', leagueId: 'comp:epl', seasonId: 'season:epl:2024-2025', sourcePath: 's.json', raw: jsonPayload() });
    expect(result.ok).toBe(true);
    expect(storage.has(result.datasetId as string)).toBe(true);
    expect(versionStore.versionCount('comp:epl:season:epl:2024-2025')).toBe(1);
  });
});

describe('A10 — ImportPipeline (CSV)', () => {
  it('imports a valid CSV payload', () => {
    const pipeline = freshPipeline();
    const result = pipeline.run({
      format: 'csv',
      provider: 'football-data',
      leagueId: 'comp:epl',
      seasonId: 'season:epl:2024-2025',
      sourcePath: 'epl.csv',
      raw: CSV,
      csvColumnMap: CSV_MAP,
    });
    expect(result.ok).toBe(true);
    expect(result.dataset?.matches.length).toBe(2);
    expect(result.registryEntry?.rowCount).toBe(2);
  });

  it('fails CSV import without a column map', () => {
    const pipeline = freshPipeline();
    const result = pipeline.run({ format: 'csv', provider: 'p', leagueId: 'comp:epl', seasonId: 's', sourcePath: 'x.csv', raw: CSV });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('csvColumnMap'))).toBe(true);
  });
});

describe('A11 — DatasetEvidenceLedger', () => {
  it('appends frozen evidence artifacts with evd_ ids', () => {
    const ledger = new DatasetEvidenceLedger();
    const artifact = ledger.append({
      datasetId: 'ds_000001',
      checksum: 'c',
      fingerprint: 'f',
      integrityScore: 99,
      validationResult: { valid: true, totalFixtures: 3, validFixtures: 3, invalidFixtures: 0, errorCount: 0, warningCount: 0 },
    });
    expect(artifact.artifactId).toMatch(/^evd_\d{6}$/);
    expect(Object.isFrozen(artifact)).toBe(true);
    expect(artifact.architectureVersion).toBe('3.0.0');
    expect(artifact.commitHash).toBeTruthy();
  });

  it('retrieves artifacts by id and dataset', () => {
    const ledger = new DatasetEvidenceLedger();
    const a = ledger.append({ datasetId: 'ds_1', checksum: 'c', fingerprint: 'f', integrityScore: 90, validationResult: { valid: true, totalFixtures: 1, validFixtures: 1, invalidFixtures: 0, errorCount: 0, warningCount: 0 } });
    ledger.append({ datasetId: 'ds_2', checksum: 'c', fingerprint: 'f', integrityScore: 80, validationResult: { valid: true, totalFixtures: 1, validFixtures: 1, invalidFixtures: 0, errorCount: 0, warningCount: 0 } });
    expect(ledger.get(a.artifactId)?.datasetId).toBe('ds_1');
    expect(ledger.getByDataset('ds_1').length).toBe(1);
    expect(ledger.count()).toBe(2);
  });

  it('builds an artifact from an integrity report', () => {
    const ledger = new DatasetEvidenceLedger();
    const artifact = ledger.appendFromIntegrity(
      { datasetId: 'ds_x', score: 88, totalChecks: 12, passedChecks: 11, issues: [], errorCount: 0, warningCount: 1, checkedAt: 't', validationVersion: '1.0.0' },
      'fp',
      'chk',
      { valid: true, totalFixtures: 5, validFixtures: 5, invalidFixtures: 0, errorCount: 0, warningCount: 1 }
    );
    expect(artifact.integrityScore).toBe(88);
    expect(artifact.datasetId).toBe('ds_x');
  });
});
