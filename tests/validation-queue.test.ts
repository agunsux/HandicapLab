import { describe, it, expect } from 'vitest';
import { ValidationQueueManager } from '../src/lib/validation/validation-queue';

describe('Sprint 10: Validation Queue Ingestion Guards', () => {
  it('should accept eligible fixtures within 7 days with valid odds and liquidity', () => {
    const res = ValidationQueueManager.checkEligibility({
      fixtureId: 'fix_1',
      leagueId: 'bra_serie_a',
      scheduledTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
      marketAvailable: true,
      referenceBookAvailable: true,
      liquidityScore: 85
    });

    expect(res.eligible).toBe(true);
  });

  it('should reject fixtures scheduled more than 7 days in the future', () => {
    const res = ValidationQueueManager.checkEligibility({
      fixtureId: 'fix_2',
      leagueId: 'bra_serie_a',
      scheduledTime: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days from now
      marketAvailable: true,
      referenceBookAvailable: true,
      liquidityScore: 85
    });

    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('fixture kickoff > 7 days');
  });

  it('should reject fixtures when markets are not available', () => {
    const res = ValidationQueueManager.checkEligibility({
      fixtureId: 'fix_3',
      leagueId: 'bra_serie_a',
      scheduledTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      marketAvailable: false,
      referenceBookAvailable: true,
      liquidityScore: 85
    });

    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('market not available');
  });

  it('should reject fixtures if reference bookmaker is not available', () => {
    const res = ValidationQueueManager.checkEligibility({
      fixtureId: 'fix_4',
      leagueId: 'bra_serie_a',
      scheduledTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      marketAvailable: true,
      referenceBookAvailable: false,
      liquidityScore: 85
    });

    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('reference bookmaker not available');
  });

  it('should reject fixtures with liquidity score below league registry configuration', () => {
    const res = ValidationQueueManager.checkEligibility({
      fixtureId: 'fix_5',
      leagueId: 'bra_serie_a', // liquidity threshold is 85 in registry
      scheduledTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      marketAvailable: true,
      referenceBookAvailable: true,
      liquidityScore: 80 // below 85
    });

    expect(res.eligible).toBe(false);
    expect(res.reason).toContain('market liquidity below threshold');
  });
});
