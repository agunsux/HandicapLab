/**
 * Adapter Layer — Tests
 * =======================
 * Verifies adapter registration, execution, and comparator correctness.
 * No changes to existing services or tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  },
}));

import { StepRegistry } from '@/lib/pipeline/adapters/StepRegistry';
import { FeatureAdapter } from '@/lib/pipeline/adapters/FeatureAdapter';
import { PredictionAdapter } from '@/lib/pipeline/adapters/PredictionAdapter';
import { CaptureAdapter } from '@/lib/pipeline/adapters/CaptureAdapter';
import { SettlementAdapter } from '@/lib/pipeline/adapters/SettlementAdapter';
import { CLVAdapter } from '@/lib/pipeline/adapters/CLVAdapter';
import { LedgerAdapter } from '@/lib/pipeline/adapters/LedgerAdapter';
import { Comparator } from '@/lib/pipeline/adapters/Comparator';
import { PIPELINE_CONTRACTS } from '@/lib/pipeline/contracts';
import { registerAllContracts } from '@/lib/pipeline/contracts/steps';

registerAllContracts();

const LIVE = { mode: 'LIVE' as const };
const REPLAY = { mode: 'REPLAY' as const };
const DRY_RUN = { mode: 'LIVE' as const, dryRun: true };

beforeEach(() => {
  StepRegistry.clear();
});

// ─── Adapter Registration ───────────────────────────────────────────────────

describe('StepRegistry', () => {
  it('should register adapters', () => {
    new FeatureAdapter();
    expect(StepRegistry.has('feature_engineering')).toBe(true);
  });

  it('should get registered adapters', () => {
    new PredictionAdapter();
    const adapter = StepRegistry.get('prediction');
    expect(adapter).toBeDefined();
    expect(adapter?.manifest.name).toBe('prediction');
  });

  it('should generate coverage report', () => {
    new FeatureAdapter();
    new PredictionAdapter();
    new CaptureAdapter();
    new SettlementAdapter();
    new CLVAdapter();
    new LedgerAdapter();

    const report = StepRegistry.generateCoverageReport();
    expect(report).toHaveLength(6);
    
    for (const entry of report) {
      expect(entry.replay).toBe('✅');
      expect(entry.dryRun).toBe('✅');
      expect(entry.idempotent).toBe('✅');
    }
  });

  it('should warn on re-registration', () => {
    new FeatureAdapter();
    expect(() => new FeatureAdapter()).not.toThrow();
  });
});

// ─── Adapter Manifests ──────────────────────────────────────────────────────

describe('Adapter Manifests', () => {
  it('FeatureAdapter manifest is correct', () => {
    const a = new FeatureAdapter();
    expect(a.manifest.name).toBe('feature_engineering');
    expect(a.manifest.contractId).toBe('feature_engineering');
    expect(a.manifest.dependencies).toEqual([]);
    expect(a.manifest.capabilities.supportsReplay).toBe(true);
    expect(a.manifest.capabilities.supportsDryRun).toBe(true);
  });

  it('PredictionAdapter manifest is correct', () => {
    const a = new PredictionAdapter();
    expect(a.manifest.name).toBe('prediction');
    expect(a.manifest.dependencies).toContain('feature_engineering');
    expect(a.manifest.capabilities.idempotent).toBe(true);
  });

  it('CaptureAdapter manifest is correct', () => {
    const a = new CaptureAdapter();
    expect(a.manifest.name).toBe('capture');
    expect(a.manifest.dependencies).toContain('prediction');
  });

  it('SettlementAdapter manifest does NOT include rollback (truthful)', () => {
    const a = new SettlementAdapter();
    expect(a.manifest.capabilities.supportsRollback).toBe(false);
  });

  it('CLVAdapter manifest is correct', () => {
    const a = new CLVAdapter();
    expect(a.manifest.name).toBe('clv');
    expect(a.manifest.dependencies).toContain('settlement');
    expect(a.manifest.dependencies).toContain('capture');
  });

  it('LedgerAdapter manifest does NOT include rollback (truthful)', () => {
    const a = new LedgerAdapter();
    expect(a.manifest.capabilities.supportsRollback).toBe(false);
  });
});

// ─── Adapter Execution ──────────────────────────────────────────────────────

describe('Adapter Execution', () => {
  const contract = PIPELINE_CONTRACTS['feature_engineering'];
  const input = { fixtureId: 'f-1', homeTeam: 'A', awayTeam: 'B', league: 'EPL', season: '2024' };

  it('FeatureAdapter LIVE mode returns output with guaranteed fields', async () => {
    const adapter = new FeatureAdapter();
    const result = await adapter.execute(contract, input, LIVE);
    expect(result.success).toBe(true);
    expect(result.output.featureVersion).toBeDefined();
    expect(result.output.featureCount).toBe(42);
    expect(result.contractHash).toBeDefined();
  });

  it('FeatureAdapter REPLAY mode returns without execution', async () => {
    const adapter = new FeatureAdapter();
    const result = await adapter.execute(contract, input, REPLAY);
    expect(result.success).toBe(true);
    expect(result.output.replay).toBe(true);
  });

  it('FeatureAdapter DRY_RUN mode returns without execution', async () => {
    const adapter = new FeatureAdapter();
    const result = await adapter.execute(contract, input, DRY_RUN);
    expect(result.success).toBe(true);
    expect(result.output.dryRun).toBe(true);
  });

  it('FeatureAdapter fails on missing required input', async () => {
    const adapter = new FeatureAdapter();
    const result = await adapter.execute(contract, {}, LIVE);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required input');
  });

  it('PredictionAdapter returns probabilities', async () => {
    const adapter = new PredictionAdapter();
    const predContract = PIPELINE_CONTRACTS['prediction'];
    const predInput = { 
      fixtureId: 'f-1', homeTeam: 'A', awayTeam: 'B', 
      league: 'EPL', kickoff: new Date(), 
      features: {}, openingOdds: {} 
    };
    const result = await adapter.execute(predContract, predInput, LIVE);
    expect(result.success, `Failed: ${result.error}`).toBe(true);
    expect(typeof result.output.homeProb).toBe('number');
    expect(typeof result.output.drawProb).toBe('number');
    expect(typeof result.output.awayProb).toBe('number');
    expect(result.contractHash).toBeDefined();
  });

  it('CaptureAdapter returns capture metadata', async () => {
    const adapter = new CaptureAdapter();
    const capContract = PIPELINE_CONTRACTS['capture_closing'];
    const result = await adapter.execute(capContract, { fixtureId: 'f-1', homeTeam: 'A', awayTeam: 'B', kickoff: new Date() }, LIVE);
    expect(result.success).toBe(true);
    expect(result.output.capturedAt).toBeDefined();
    expect(result.output.capturePhase).toBeDefined();
  });

  it('SettlementAdapter returns hit/miss results', async () => {
    const adapter = new SettlementAdapter();
    const setContract = PIPELINE_CONTRACTS['settlement'];
    const result = await adapter.execute(setContract, { fixtureId: 'f-1', homeScore: 2, awayScore: 1, predictionId: 'p-1' }, LIVE);
    expect(result.success).toBe(true);
    expect(typeof result.output.hit1x2).toBe('boolean');
    expect(typeof result.output.hitAH).toBe('boolean');
  });

  it('CLVAdapter returns CLV values', async () => {
    const adapter = new CLVAdapter();
    const clvContract = PIPELINE_CONTRACTS['clv'];
    const result = await adapter.execute(clvContract, { predictionId: 'p-1', fixtureId: 'f-1', marketType: 'moneyline', modelPrice: 1.85, closingPrice: 2.10 }, LIVE);
    expect(result.success).toBe(true);
    expect(typeof result.output.clv).toBe('number');
    expect(typeof result.output.clvBps).toBe('number');
  });

  it('LedgerAdapter returns chain hash', async () => {
    const adapter = new LedgerAdapter();
    const ledContract = PIPELINE_CONTRACTS['ledger'];
    const result = await adapter.execute(ledContract, {
      predictionId: 'p-1', fixtureId: 'f-1', modelVersion: 'v1',
      marketType: 'moneyline', predictionProb: 0.5, marketProb: 0.48,
      edge: 0.02, clv: 0.05,
    }, LIVE);
    expect(result.success).toBe(true);
    expect(result.output.chainHash).toBeDefined();
    expect(result.output.entryId).toBeDefined();
  });
});

// ─── Comparator ─────────────────────────────────────────────────────────────

describe('Comparator', () => {
  const comparator = new Comparator();

  it('should report match when identical (fingerprint)', () => {
    const result = comparator.compare({
      label: 'prediction',
      old: { homeProb: 0.5, drawProb: 0.3, awayProb: 0.2 },
      engine: { homeProb: 0.5, drawProb: 0.3, awayProb: 0.2 },
    });
    expect(result.passed).toBe(true);
    expect(result.summary).toContain('fingerprint');
    expect(result.stats?.maxDifference).toBe(0);
    expect(result.stats?.confidence).toBe(1);
    expect(result.provenance?.outputFingerprintLegacy).toBeDefined();
  });

  it('should report mismatch on different values', () => {
    const result = comparator.compare({
      label: 'prediction',
      old: { homeProb: 0.5, drawProb: 0.3, awayProb: 0.2 },
      engine: { homeProb: 0.6, drawProb: 0.2, awayProb: 0.2 },
    });
    expect(result.passed).toBe(false);
    expect(result.business.some(b => !b.match)).toBe(true);
  });

  it('should use numeric tolerance for floating point', () => {
    const result = comparator.compare({
      label: 'prediction',
      old: { homeProb: 0.50001, drawProb: 0.3, awayProb: 0.2 },
      engine: { homeProb: 0.5, drawProb: 0.3, awayProb: 0.2 },
    });
    expect(result.passed).toBe(true);
  });

  it('should detect state mismatches', () => {
    const result = comparator.compare({
      label: 'prediction',
      old: { currentState: 'FEATURES_READY', version: 1 },
      engine: { currentState: 'PREDICTED', version: 2 },
    });
    expect(result.passed).toBe(false);
    expect(result.state.some(s => !s.match)).toBe(true);
  });

  it('should handle empty inputs gracefully', () => {
    const result = comparator.compare({
      label: 'unknown_step',
      old: {},
      engine: {},
    });
    expect(result).toBeDefined();
    expect(Array.isArray(result.business)).toBe(true);
  });

  it('compareBatch should summarize multiple comparisons', () => {
    const results = comparator.compareBatch([
      { label: 'prediction', old: { homeProb: 0.5 }, engine: { homeProb: 0.5 } },
      { label: 'prediction', old: { homeProb: 0.5 }, engine: { homeProb: 0.6 } },
    ]);
    expect(results.total).toBe(2);
    expect(results.passed).toBe(1);
    expect(results.failed).toBe(1);
  });
});

// ─── Engine ↔ Adapter Integration ──────────────────────────────────────────

describe('Engine ↔ Adapter Integration', () => {
  it('adapters are discoverable via StepRegistry after registration', () => {
    new FeatureAdapter();
    new PredictionAdapter();
    new CaptureAdapter();
    new SettlementAdapter();
    new CLVAdapter();
    new LedgerAdapter();

    expect(StepRegistry.has('feature_engineering')).toBe(true);
    expect(StepRegistry.has('prediction')).toBe(true);
    expect(StepRegistry.has('capture')).toBe(true);
    expect(StepRegistry.has('settlement')).toBe(true);
    expect(StepRegistry.has('clv')).toBe(true);
    expect(StepRegistry.has('ledger')).toBe(true);
  });

  it('each adapter computes a deterministic contractHash', () => {
    const a1 = new FeatureAdapter();
    const a2 = new FeatureAdapter();
    const contract = PIPELINE_CONTRACTS['feature_engineering'];
    
    const h1 = a1['computeContractHash'](contract);
    const h2 = a2['computeContractHash'](contract);
    expect(h1).toBe(h2);
  });

  it('adapter output includes contract metadata', async () => {
    const adapter = new FeatureAdapter();
    const contract = PIPELINE_CONTRACTS['feature_engineering'];
    const result = await adapter.execute(contract, { fixtureId: 'f-1', homeTeam: 'A', awayTeam: 'B', league: 'EPL', season: '2024' }, LIVE);
    
    expect(result.contractVersion).toBe('1.0.0');
    expect(result.contractHash).toMatch(/^ch_/);
  });
});