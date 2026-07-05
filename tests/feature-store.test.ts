import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeatureGenerator, FeatureValidator, FeatureStoreService, FeatureRegistryModel } from '../src/lib/warehouse/metadata/featureStore';
import { supabase } from '../src/lib/supabase.server';

describe('FeatureGenerator Calculations', () => {
  const generator = new FeatureGenerator();

  it('should compute rolling average goals for a team correctly', () => {
    const fixtures = [
      { home_team_id: 10, away_team_id: 20, home_goals: 3, away_goals: 1, status: 'finished' },
      { home_team_id: 30, away_team_id: 10, home_goals: 0, away_goals: 2, status: 'finished' },
      { home_team_id: 10, away_team_id: 40, home_goals: 1, away_goals: 1, status: 'scheduled' } // Ignored
    ];

    const avg = generator.generateTeamGoalAverage(fixtures, 10);
    // Goals: 3 (home) + 2 (away) = 5 goals in 2 games.
    expect(avg).toBe(2.5);
  });

  it('should compute market overround margins correctly', () => {
    const margin = generator.generateMarketOverround(2.0, 2.0); // 1/2 + 1/2 = 1.0 (overround = 0)
    expect(margin).toBe(0.0);

    const highMargin = generator.generateMarketOverround(1.85, 1.85); // 1/1.85 + 1/1.85 = 1.081
    expect(highMargin).toBeCloseTo(0.081, 3);
  });
});

describe('FeatureValidator Constraints', () => {
  it('should pass on clean inputs', () => {
    const values = [1.2, 0.9, -0.4, 2.5];
    const validation = FeatureValidator.validate(values);
    expect(validation.isValid).toBe(true);
    expect(validation.nullPct).toBe(0.0);
  });

  it('should flag outliers and failures on high null levels', () => {
    const values = [1.5, NaN, 12.0, -15.0]; // NaN is null, 12 and -15 are outliers
    const validation = FeatureValidator.validate(values);
    expect(validation.nullPct).toBe(25.0);
    expect(validation.outlierCount).toBe(2);
    expect(validation.isValid).toBe(false); // Nulls exceeded 5% limit
  });
});

describe('FeatureRegistry Service Mocks', () => {
  let service: FeatureStoreService;

  beforeEach(() => {
    service = new FeatureStoreService();
  });

  it('should mock feature catalog registration successfully', async () => {
    const model: FeatureRegistryModel = {
      featureId: 'team_rolling_avg_goals',
      version: '1.0.0',
      description: 'Goal average rolling features',
      dependencies: ['silver_fixtures'],
      sourceDataset: 'silver_fixtures',
      generatorVersion: '1.0.0',
      owner: 'quant-team',
      tags: ['team', 'strength']
    };

    vi.spyOn(service, 'registerFeature').mockResolvedValue(model);
    const result = await service.registerFeature(model);
    expect(result.featureId).toBe('team_rolling_avg_goals');
  });
});
