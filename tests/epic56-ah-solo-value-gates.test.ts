import { describe, it, expect } from 'vitest';
import { AhValueEngine } from '../src/lib/research/ah-solo/ahValueEngine';
import { AhUpcomingShadowEngine } from '../src/lib/research/ah-solo/ahUpcomingShadowEngine';

describe('EPIC 56: Value Engine, De-Vig, & Evidence Gating', () => {
  it('de-vigs 2-way Asian Handicap odds with canonical proportional method', () => {
    const devig = AhValueEngine.devig2WayAh(1.95, 1.95);
    expect(devig.homeFairProb).toBeCloseTo(0.5, 3);
    expect(devig.awayFairProb).toBeCloseTo(0.5, 3);
    expect(devig.overround).toBeGreaterThan(0);
  });

  it('computes canonical CLV (%) correctly', () => {
    // Taken 2.10, Closed 2.00 -> (2.10 / 2.00 - 1) * 100 = +5.0%
    const clvPos = AhValueEngine.computeClv(2.10, 2.00);
    expect(clvPos).toBe(5.0);

    // Taken 1.90, Closed 2.00 -> (1.90 / 2.00 - 1) * 100 = -5.0%
    const clvNeg = AhValueEngine.computeClv(1.90, 2.00);
    expect(clvNeg).toBe(-5.0);

    // Missing closing odds -> undefined
    expect(AhValueEngine.computeClv(2.00, undefined)).toBeUndefined();
  });

  it('enforces sample size gating on sparse lines (|line| >= 2.25)', () => {
    expect(AhValueEngine.getSampleSizeStatus(-2.5, 150)).toBe('INSUFFICIENT');
    expect(AhValueEngine.getSampleSizeStatus(-0.5, 1500)).toBe('ADEQUATE');
    expect(AhValueEngine.getSampleSizeStatus(-0.25, 450)).toBe('LIMITED');
  });

  it('guards upcoming shadow inference: blocks QUALIFIED_VALUE if unconfirmed', () => {
    const fixture = {
      fixtureId: 'UPCOMING-001',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      leagueId: 'ENG-PL',
      kickoffTime: '2026-09-01T15:00:00Z',
      ahLines: [{ line: -0.5, homeOdds: 2.5, awayOdds: 1.6, bookmaker: 'pinnacle' }],
    };

    // When historical confirmation has NOT passed:
    const shadowUnconfirmed = AhUpcomingShadowEngine.inferShadow(fixture, [], false, -0.05);
    for (const p of shadowUnconfirmed.predictions) {
      expect(p.qualificationState).not.toBe('QUALIFIED_VALUE');
    }
  });
});
