import { describe, it, expect, vi } from 'vitest';
import { BronzePredictionAdapter, BronzeMatch } from '../../src/services/bronzePredictionAdapter';

describe('BronzePredictionAdapter', () => {
  it('should generate a deterministic prediction given bronze match data', async () => {
    const adapter = new BronzePredictionAdapter();
    
    const mockMatch: BronzeMatch = {
      fixtureId: 'test-fixture-123',
      fixtureNaturalKey: 'EPL|2023-2024|ARSENAL|LIVERPOOL|2023-10-01',
      competitionId: 'EPL',
      seasonId: '2023-2024',
      homeTeamId: 'arsenal',
      awayTeamId: 'liverpool',
      homeGoals: { value: 2 },
      awayGoals: { value: 1 },
      homeXg: { value: 1.8 },
      awayXg: { value: 0.9 },
    };

    const prediction = await adapter.predictMatch(mockMatch);

    expect(prediction.fixtureId).toBe('test-fixture-123');
    expect(prediction.model).toBe('poisson_xg');
    expect(prediction.prediction.homeWin).toBeGreaterThan(prediction.prediction.awayWin); // Home xG > Away xG
    expect(prediction.expectedGoals.home).toBe(1.8);
    expect(prediction.expectedGoals.away).toBe(0.9);
    
    // Determinism test: calling it again should yield same exact numbers
    const prediction2 = await adapter.predictMatch(mockMatch);
    expect(prediction.prediction.homeWin).toEqual(prediction2.prediction.homeWin);
    expect(prediction.prediction.draw).toEqual(prediction2.prediction.draw);
    expect(prediction.prediction.awayWin).toEqual(prediction2.prediction.awayWin);
  });
});
