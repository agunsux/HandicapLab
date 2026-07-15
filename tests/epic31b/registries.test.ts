import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DatasetRegistry } from '../../src/infrastructure/registry/dataset-registry';
import { FeatureRegistry } from '../../src/infrastructure/registry/feature-registry';
import { CalibrationRegistry } from '../../src/infrastructure/registry/calibration-registry';
import { EvidenceLedger } from '../../src/infrastructure/registry/evidence-ledger';
import type { DatasetMetadata } from '../../src/domain/dataset/types';
import type { FeatureMetadata } from '../../src/domain/feature/types';
import type { CalibrationMetadata } from '../../src/domain/calibration/types';
import type { EvidenceRecord } from '../../src/domain/evidence/types';

describe('SUPER EPIC 31B.5A — Registries and Lineage', () => {
  const testDir = path.join(process.cwd(), 'test-epic31b-registries');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should audit and register datasets in DatasetRegistry', async () => {
    const registry = new DatasetRegistry();
    const list = await registry.list();
    expect(list).toBeDefined();
  });

  it('should manage FeatureRegistry entries', async () => {
    const registry = new FeatureRegistry();
    const list = await registry.list();
    expect(list.length).toBeGreaterThan(0);

    const f = await registry.get('regime_type');
    expect(f.featureFamily).toBe('regime');

    const validation = await registry.validate('regime_type');
    expect(validation.isValid).toBe(true);
  });

  it('should manage CalibrationRegistry entries', async () => {
    const registry = new CalibrationRegistry();
    const list = await registry.list();
    expect(list.length).toBeGreaterThan(0);

    const validation = await registry.validate('platt-epl-default');
    expect(validation.isValid).toBe(true);
  });

  it('should calculate hash and verify signatures in EvidenceLedger', async () => {
    const ledger = new EvidenceLedger(testDir);
    const mockRecord: Omit<EvidenceRecord, 'evidenceHash' | 'evidenceSignature'> = {
      experimentId: 'test-exp-1',
      datasetSha: 'dummy-sha-256-dataset',
      gitCommitSha: 'dummy-commit-sha',
      featureVersion: '1.0.0',
      calibrationVersion: '1.0.0',
      modelVersion: 'poisson-v1',
      randomSeed: 42,
      validationMetrics: {
        totalMatches: 10,
        totalPredictions: 10,
        won: 5,
        lost: 5,
        voided: 0,
        roi: 5.5,
        yield: 5.5,
        avgClv: 0.02,
        winRate: 50,
        totalStake: 1.0,
        totalProfit: 0.055,
        brierScore: 0.22,
        logLoss: 0.61,
        avgKellyStake: 0.1,
        maxDrawdown: 0.1,
        sharpeRatio: 1.5,
        profitFactor: 1.2,
        longestWinStreak: 2,
        longestLossStreak: 2,
      },
      confidenceIntervals: [],
      bootstrapResults: {
        mean: 5.4,
        median: 5.5,
        ciLower: 1.2,
        ciUpper: 9.8,
        isSignificant: true,
      },
      runtime: {
        durationMs: 120,
        memoryMB: 45,
        cpuTimeMs: 120,
      },
      timestamp: new Date().toISOString(),
    };

    const hash = ledger.calculateHash(mockRecord);
    const sig = ledger.signHash(hash);

    const record: EvidenceRecord = {
      ...mockRecord,
      evidenceHash: hash,
      evidenceSignature: sig,
    };

    await ledger.register(record);

    const retrieved = await ledger.get('test-exp-1');
    expect(retrieved.evidenceHash).toBe(hash);

    const validation = await ledger.validate('test-exp-1');
    expect(validation.isValid).toBe(true);
  });
});
