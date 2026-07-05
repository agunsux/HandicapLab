import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeatureAssembler } from '../src/lib/warehouse/serving/featureAssembler';
import { InferenceOrchestrator, PredictionPayload } from '../src/lib/warehouse/serving/inferenceOrchestrator';
import { PredictionStore } from '../src/lib/warehouse/serving/predictionStore';
import { supabase } from '../src/lib/supabase.server';

describe('FeatureAssembler Leakage Prevention', () => {
  let assembler: FeatureAssembler;

  beforeEach(() => {
    assembler = new FeatureAssembler();
  });

  it('should query features strictly up to asOfTimestamp', async () => {
    const mockValues = [
      { feature_id: 'team_rolling_avg_goals', feature_value: 2.1, created_at: '2026-07-01T12:00:00Z' }
    ];

    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({ data: mockValues, error: null })
    } as any);

    // query asOf '2026-07-01T15:00:00Z' should find value 2.1, excluding 2.5
    const vector = await assembler.assembleVector(
      BigInt(10),
      ['team_rolling_avg_goals'],
      '2026-07-01T15:00:00Z'
    );

    expect(vector.features['team_rolling_avg_goals']).toBe(2.1);
  });
});

describe('InferenceOrchestrator Calibration & Kelly Stakes', () => {
  const orchestrator = new InferenceOrchestrator();

  it('should compute fractional Kelly allocations and expected value yield', () => {
    // Odds: 2.10, Probability: 55%
    const allocation = orchestrator.computeKellyStake(0.55, 2.10, 0.5, 1000.0);
    
    // (0.55 * 1.1 - 0.45)/1.1 = 0.155 / 1.1 = 0.1409. Half Kelly = 0.0705 * 1000 = 70.45
    expect(allocation.fraction).toBeCloseTo(0.0705, 3);
    expect(allocation.stake).toBe(70.45);
    expect(allocation.expectedValue).toBeCloseTo(0.1550, 4);
  });
});

describe('PredictionStore Duplicate Writing Guard', () => {
  const store = new PredictionStore();

  it('should generate distinct hashes for different fixtures', () => {
    const payload1: Omit<PredictionPayload, 'predictionHash'> = {
      modelVersionId: 'Poisson_v1',
      datasetVersionId: 'silver_fixtures_v1',
      fixtureId: BigInt(1002),
      market: '1X2',
      selection: 'Home',
      predictedProbability: 0.52,
      fairOdds: 1.92,
      bookmakerOdds: 2.0,
      expectedValue: 0.04,
      kellyFraction: 0.02,
      stakeRecommendation: 20.0,
      confidenceLevel: 'HIGH',
      predictionTimestamp: '2026-07-01T12:00:00Z',
      latencyMs: 15,
      featureVersion: '1.0.0',
      lineVersion: '1.0.0',
      reasonCode: 'value_home',
      jsonExplanation: {}
    };

    const payload2 = { ...payload1, fixtureId: BigInt(1003) };

    const hash1 = store.generateHash(payload1);
    const hash2 = store.generateHash(payload2);

    expect(hash1).not.toBe(hash2);
    expect(hash1.length).toBe(64);
  });
});
