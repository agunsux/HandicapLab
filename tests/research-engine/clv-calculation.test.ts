import { describe, it, expect } from 'vitest';
import { ClvCalculator, type ClvObservation } from '../../src/lib/research/settlement/clvCalculator';

describe('Phase 3: Closing Line Value (CLV) Calculator Tests', () => {
  it('1. Computes single ratio CLV correctly', () => {
    // Bet taken at 2.10, closed at 1.95: CLV = (2.10 / 1.95) - 1 = +7.69%
    const clvPositive = ClvCalculator.computeSingleClv(2.10, 1.95);
    expect(clvPositive).toBeCloseTo(0.07692, 4);

    // Bet taken at 1.90, closed at 2.05: CLV = (1.90 / 2.05) - 1 = -7.32%
    const clvNegative = ClvCalculator.computeSingleClv(1.90, 2.05);
    expect(clvNegative).toBeCloseTo(-0.07317, 4);
  });

  it('2. Summarizes CLV across a distribution of bets', () => {
    const observations: ClvObservation[] = [
      { matchId: 'm1', market: 'AH', line: -0.5, selection: 'home', predictionTimeOdds: 2.10, closingOdds: 1.95 }, // +7.69%
      { matchId: 'm2', market: 'AH', line: -0.5, selection: 'home', predictionTimeOdds: 2.00, closingOdds: 1.98 }, // +1.01%
      { matchId: 'm3', market: 'AH', line: -0.5, selection: 'home', predictionTimeOdds: 1.90, closingOdds: 1.95 }, // -2.56%
      { matchId: 'm4', market: 'AH', line: -0.5, selection: 'home', predictionTimeOdds: 2.05, closingOdds: 2.00 }, // +2.50%
      { matchId: 'm5', market: 'AH', line: -0.5, selection: 'home', predictionTimeOdds: 1.85, closingOdds: 1.95 }, // -5.13%
    ];

    const summary = ClvCalculator.summarize(observations);
    expect(summary.sampleSize).toBe(5);
    expect(summary.positiveClvRate).toBe(0.60); // 3 of 5 beat the close
    expect(summary.meanClv).toBeGreaterThan(0);
    expect(summary.medianClv).toBeCloseTo(0.0101, 3);
  });

  it('3. Flags divergence alert when positive ROI coexists with negative CLV', () => {
    const observations: ClvObservation[] = [
      { matchId: 'm1', market: 'ML', line: null, selection: 'home', predictionTimeOdds: 1.80, closingOdds: 1.95 }, // -7.69%
      { matchId: 'm2', market: 'ML', line: null, selection: 'home', predictionTimeOdds: 1.85, closingOdds: 1.95 }, // -5.13%
      { matchId: 'm3', market: 'ML', line: null, selection: 'home', predictionTimeOdds: 1.82, closingOdds: 1.95 }, // -6.67%
    ];

    // Realized ROI is +15% (lucky variance), but mean CLV is negative (-6.5%)
    const summary = ClvCalculator.summarize(observations, 0.15);
    expect(summary.divergenceAlert).toBe(true);
  });
});

