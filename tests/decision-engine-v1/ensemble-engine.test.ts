import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRegistry } from '../../src/lib/engines/decision-engine-v1/registry';

import { PredictionModel, Prediction, ModelMetadata } from '../../src/lib/engines/decision-engine-v1/models/predictionModel';
import { EnsembleEngine } from '../../src/lib/engines/decision-engine-v1/ensemble-engine';
import { MatchFeatures } from '../../src/lib/engines/feature-engine/types';

class MockModel implements PredictionModel {
  constructor(public id: string, public name: string, private pHome: number, private pDraw: number, private pAway: number) {}

  public async predict(features: MatchFeatures): Promise<Prediction> {
    return {
      pHome: this.pHome,
      pDraw: this.pDraw,
      pAway: this.pAway
    };
  }

  public async train(trainData: any[]): Promise<void> {}

  public async predictProbability(features: MatchFeatures): Promise<{ pHome: number; pDraw: number; pAway: number }> {
    return { pHome: this.pHome, pDraw: this.pDraw, pAway: this.pAway };
  }

  public async predictScore(features: MatchFeatures): Promise<{ home: number; away: number }> {
    return { home: 1.5, away: 1.0 };
  }

  public metadata(): ModelMetadata {
    return { name: this.name, version: '1.0.0', description: '', isOnline: false };
  }
}


describe('Ensemble Engine V1 Tests', () => {
  const dummyFeatures: MatchFeatures = {
    matchId: 'match-test',
    marketType: 'ML',
    kickoffAt: new Date(),
    homeFormLast5: [1, 2, 3, 4, 5],
    awayFormLast5: [1, 2, 3, 4, 5],
    homeFormWeighted: 1.5,
    awayFormWeighted: 1.2,
    homeTravelKm: 0,
    homeElo: 1600,
    awayElo: 1550,
    eloDelta: 50,
    generatedAt: new Date(),
    homeAttack: 1.5,
    homeDefense: 1.0,
    awayAttack: 1.2,
    awayDefense: 1.1,
    homeRestDays: 5,
    awayRestDays: 4,
    leagueAvgGoals: 2.82,
    isHomeAdvantage: true,
    leagueId: '39',
    season: '2024-2025'
  };

  beforeEach(() => {
    ModelRegistry.clear();
  });

  it('should compute ensembled probabilities that sum to exactly 1.0', async () => {
    ModelRegistry.register('m1', new MockModel('m1', 'Model 1', 0.50, 0.25, 0.25));
    ModelRegistry.register('m2', new MockModel('m2', 'Model 2', 0.40, 0.30, 0.30));

    const result = await EnsembleEngine.predict(dummyFeatures);
    expect(result.pHome + result.pDraw + result.pAway).toBeCloseTo(1.0, 4);
    expect(result.pHome).toBe(0.45);
    expect(result.pDraw).toBe(0.275);
    expect(result.pAway).toBe(0.275);
  });

  it('should calculate high disagreement when model predictions diverge significantly', async () => {
    ModelRegistry.register('m1', new MockModel('m1', 'Model 1', 0.80, 0.10, 0.10));
    ModelRegistry.register('m2', new MockModel('m2', 'Model 2', 0.20, 0.40, 0.40));

    const result = await EnsembleEngine.predict(dummyFeatures);
    expect(result.disagreementScore).toBeGreaterThan(35); // Significant divergence
  });

  it('should allow dynamic model registration and unregistration at runtime', async () => {
    const m1 = new MockModel('m1', 'Model 1', 0.50, 0.25, 0.25);
    ModelRegistry.register('m1', m1);
    expect(ModelRegistry.getModels().length).toBe(1);

    ModelRegistry.unregister('m1');
    expect(ModelRegistry.getModels().length).toBe(0);
  });
});
