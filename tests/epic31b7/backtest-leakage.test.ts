import { describe, it, expect, vi } from 'vitest';
import { BronzeBacktestEngine, BacktestSnapshot } from '../../src/services/backtest/bronzeBacktestEngine';
import { BronzePredictionAdapter } from '../../src/services/bronzePredictionAdapter';

// Mock the adapter
vi.mock('../../src/services/bronzePredictionAdapter', () => {
  const MockAdapter = vi.fn();
  MockAdapter.prototype.loadBronzeData = vi.fn().mockResolvedValue([
    {
      fixtureId: 'match-1',
      fixtureNaturalKey: 'EPL|2015-2016|ARSENAL|CHELSEA|2015-09-11',
      homeGoals: { value: 2 },
      awayGoals: { value: 0 },
      homeXg: { value: 1.5 },
      awayXg: { value: 0.5 },
    },
    {
      fixtureId: 'match-2',
      fixtureNaturalKey: 'EPL|2015-2016|LIVERPOOL|CHELSEA|2015-09-18',
      homeGoals: { value: 1 },
      awayGoals: { value: 1 },
      homeXg: { value: 1.0 },
      awayXg: { value: 1.0 },
    }
  ]);
  MockAdapter.prototype.predictMatch = vi.fn().mockImplementation((match) => {
    return Promise.resolve({
      fixtureId: match.fixtureId,
      model: 'mock_model',
      prediction: { homeWin: 0.6, draw: 0.2, awayWin: 0.2 },
      expectedGoals: { home: match.homeXg.value, away: match.awayXg.value },
      confidenceScore: 0.8,
      createdAt: new Date().toISOString()
    });
  });
  return { BronzePredictionAdapter: MockAdapter };
});

describe('BronzeBacktestEngine', () => {
  it('should run backtest without future leakage (chronological order) and probabilities sum to 1', async () => {
    const engine = new BronzeBacktestEngine();
    // Prevent actual file writing during test
    engine.init = vi.fn().mockResolvedValue(undefined);
    // @ts-ignore
    vi.spyOn(require('fs/promises'), 'writeFile').mockResolvedValue(undefined);

    const snapshots = await engine.runBacktest('EPL', ['2015-2016']);

    expect(snapshots.length).toBe(2);
    
    // Check chronological order
    expect(snapshots[0].dataCutoffDate).toBe('2015-09-11');
    expect(snapshots[1].dataCutoffDate).toBe('2015-09-18');

    // Check probability sum = 1 (within floating point precision)
    for (const snap of snapshots) {
      const sum = snap.prediction.homeWin + snap.prediction.draw + snap.prediction.awayWin;
      expect(Math.abs(1.0 - sum)).toBeLessThan(0.001);
    }

    // Check actual result mapping
    expect(snapshots[0].actualResult).toBe('HOME_WIN');
    expect(snapshots[1].actualResult).toBe('DRAW');
  });
});
