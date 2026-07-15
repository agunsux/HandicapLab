import { describe, it, expect } from 'vitest';
import { RegimeSelector } from '../../src/domain/dataset/regime-selector';
import { LeakageAuditor } from '../../src/application/validation/leakage-auditor';
import { DriftDetector } from '../../src/application/validation/drift-detector';
import { StatisticalValidator } from '../../src/application/validation/statistical-validator';
import type { ReplayOutcome } from '../../src/lib/epic31b/types';

describe('SUPER EPIC 31B.5B — Validation Platform (Science)', () => {
  it('should correctly select crowd and temporal regimes', () => {
    const closedDoorRegimes = RegimeSelector.selectRegime(new Date('2020-11-15'), '2020-2021');
    expect(closedDoorRegimes).toContain('COVID_ClosedDoor');
    expect(closedDoorRegimes).toContain('VAR_Era');

    const normalRegimes = RegimeSelector.selectRegime(new Date('2023-04-12'), '2022-2023');
    expect(normalRegimes).toContain('FullCrowd_Normal');
    expect(normalRegimes).toContain('VAR_Era');

    const congestionRegimes = RegimeSelector.selectRegime(new Date('2023-04-12'), '2022-2023', { restDays: 3 });
    expect(congestionRegimes).toContain('FixtureCongestion');
  });

  it('should audit leakage correctly', () => {
    const outcomes: ReplayOutcome[] = [
      {
        fixtureId: 'EPL-2020-Liverpool-Chelsea',
        marketType: 'ML',
        selection: 'home',
        predictedProbability: 0.65,
        actualResult: 1,
        profitLoss: 0.1,
        brierScore: 0.12,
        logLoss: 0.43,
        clv: 0.02,
        kellyStake: 0.05,
        expectedValue: 0.02,
        settledOutcome: 'WIN',
        settlementProfitUnits: 0.1,
      },
    ];

    const matches = [
      {
        kickoffAt: new Date('2020-09-20T16:30:00Z'),
        homeTeam: 'Liverpool',
        awayTeam: 'Chelsea',
      },
    ];

    const audit = LeakageAuditor.audit(outcomes, matches);
    expect(audit.hasLeakage).toBe(false);
  });

  it('should compute probability and PSI drift in stable and drifting data', () => {
    const outcomes: ReplayOutcome[] = [];
    // Generate stable base & target predictions
    for (let i = 0; i < 20; i++) {
      outcomes.push({
        fixtureId: `test-${i}`,
        marketType: 'ML',
        selection: 'home',
        predictedProbability: 0.5,
        actualResult: 1,
        profitLoss: 0.1,
        brierScore: 0.25,
        logLoss: 0.69,
        clv: 0.01,
        kellyStake: 0.05,
        expectedValue: 0.01,
        settledOutcome: 'WIN',
        settlementProfitUnits: 0.1,
      });
    }

    const drift = DriftDetector.calculateDrift(outcomes);
    expect(drift.psi).toBeCloseTo(0.0, 3);
    expect(drift.driftStatus).toBe('STABLE');
  });
});
