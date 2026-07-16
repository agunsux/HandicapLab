import { describe, it, expect } from 'vitest';
import { EvaluationEngine } from '../../src/services/backtest/evaluationEngine';
import { BacktestSnapshot } from '../../src/services/backtest/bronzeBacktestEngine';

describe('EvaluationEngine', () => {
  it('should calculate Brier score, log loss, and accuracy correctly', () => {
    const engine = new EvaluationEngine();

    const snapshots: BacktestSnapshot[] = [
      {
        fixtureId: 'm1', modelVersion: 'test',
        prediction: { homeWin: 0.6, draw: 0.2, awayWin: 0.2 },
        actualResult: 'HOME_WIN',
        timestamp: 'ts', dataCutoffDate: 'dt'
      },
      {
        fixtureId: 'm2', modelVersion: 'test',
        prediction: { homeWin: 0.1, draw: 0.7, awayWin: 0.2 },
        actualResult: 'AWAY_WIN', // wrong prediction
        timestamp: 'ts', dataCutoffDate: 'dt'
      }
    ];

    const metrics = engine.evaluate(snapshots);

    expect(metrics.totalMatches).toBe(2);
    // Accuracy: Match 1 is correct (0.6 home). Match 2 is wrong (0.7 draw predicted, actual away)
    expect(metrics.accuracy).toBe(0.5);

    // Brier Score calculation
    // M1: (0.6-1)^2 + (0.2-0)^2 + (0.2-0)^2 = 0.16 + 0.04 + 0.04 = 0.24
    // M2: (0.1-0)^2 + (0.7-0)^2 + (0.2-1)^2 = 0.01 + 0.49 + 0.64 = 1.14
    // Avg Brier = (0.24 + 1.14) / 2 = 0.69
    expect(metrics.brierScore).toBeCloseTo(0.69, 2);

    // Log Loss calculation
    // M1: -ln(0.6) = 0.5108
    // M2: -ln(0.2) = 1.6094
    // Avg Log Loss = 1.0601
    expect(metrics.logLoss).toBeCloseTo(1.060, 2);

    // Calibration bucket mapping check
    // M1 homeWin prob = 0.6 (goes into 0.6-0.7 bucket)
    // M2 homeWin prob = 0.1 (goes into 0.1-0.2 bucket)
    const bucket60 = metrics.calibration.homeWin.find(b => b.minProb === 0.6);
    expect(bucket60?.count).toBe(1);
    expect(bucket60?.actualWinRate).toBe(1.0); // it won
  });
});
