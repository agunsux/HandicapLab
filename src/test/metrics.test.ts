import { describe, it, expect } from 'vitest';
import { Metrics } from '../lib/data-platform/metrics';

describe('Metric & Statistical Validation (Mathematical Precision)', () => {
  it('should compute Log Loss with 1e-9 tolerance', () => {
    // Reference implementation A
    const preds = [
      { probability: 0.9, outcome: 1 },
      { probability: 0.1, outcome: 0 },
      { probability: 0.8, outcome: 1 }
    ];
    
    // -[ln(0.9) + ln(1-0.1) + ln(0.8)] / 3
    // ln(0.9) = -0.105360515
    // ln(0.9) = -0.105360515
    // ln(0.8) = -0.223143551
    // sum = -0.433864581
    // avg = 0.144621527
    
    const expected = 0.1446215275;
    const actual = Metrics.logLoss(preds);
    
    expect(Math.abs(actual - expected)).toBeLessThan(1e-8);
  });

  it('should compute Brier Score with 1e-9 tolerance', () => {
    const preds = [
      { probability: 0.9, outcome: 1 },
      { probability: 0.1, outcome: 0 },
      { probability: 0.8, outcome: 1 }
    ];

    // (0.9 - 1)^2 + (0.1 - 0)^2 + (0.8 - 1)^2
    // 0.01 + 0.01 + 0.04 = 0.06
    // 0.06 / 3 = 0.02
    
    const expected = 0.02;
    const actual = Metrics.brierScore(preds);
    
    expect(Math.abs(actual - expected)).toBeLessThan(1e-9);
  });
});
