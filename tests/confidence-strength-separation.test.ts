import { describe, it, expect } from 'vitest';
import { ProductionValidityGate } from '@/lib/publishing/productionValidityGate';
import { mapConfidenceToStrength } from '@/lib/publishing/confidenceMapping';

describe('Separation of Production Validity from Confidence / Strength', () => {
  const baseValidInput = {
    canonicalMatchId: 'canonical_12345678',
    fixtureId: 'af_12345678',
    providerFixtureId: '12345678',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    leagueKey: 'ENG-PL', // Active league
    kickoffUtc: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    market: 'AH',
    selection: 'Arsenal -0.25',
    line: -0.25,
    marketOdds: 1.95,
    oddsTimestampUtc: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    predictionTimestampUtc: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    modelVersion: 'dixon-coles-v1.0',
    providerSources: {
      fixtures: 'api-football-pro',
      odds: 'oddspapi-pinnacle',
      statistics: 'apifootball-baseline',
    },
    sampleSizeHome: 10,
    sampleSizeAway: 10,
    quotaAllowed: true,
  };

  it('validates a production-valid fixture independently of confidence score', () => {
    const validity = ProductionValidityGate.evaluate(baseValidInput);
    expect(validity.isValid).toBe(true);
    expect(validity.state).toBe('VALID');
    expect(validity.validityStatus).toBe('VALID');
    expect(validity.rejectionReason).toBeNull();
  });

  it('maps low confidence (< 40%) to VERY_WEAK (Red) without gating or hiding the prediction', () => {
    const lowConf = mapConfidenceToStrength(31);
    expect(lowConf.confidence).toBe(31);
    expect(lowConf.strengthLevel).toBe('VERY_WEAK');
    expect(lowConf.signalColor).toBe('red');
    expect(lowConf.badgeText).toContain('31% · VERY WEAK');

    // A valid prediction with 31% confidence remains VALID
    const validity = ProductionValidityGate.evaluate(baseValidInput);
    expect(validity.isValid).toBe(true);
  });

  it('maps 40-49% confidence to WEAK (Orange)', () => {
    const weakConf = mapConfidenceToStrength(44);
    expect(weakConf.confidence).toBe(44);
    expect(weakConf.strengthLevel).toBe('WEAK');
    expect(weakConf.signalColor).toBe('orange');
    expect(weakConf.badgeText).toContain('44% · WEAK');
  });

  it('maps 50-59% confidence to MODERATE (Yellow)', () => {
    const modConf = mapConfidenceToStrength(56);
    expect(modConf.confidence).toBe(56);
    expect(modConf.strengthLevel).toBe('MODERATE');
    expect(modConf.signalColor).toBe('yellow');
    expect(modConf.badgeText).toContain('56% · MODERATE');
  });

  it('maps >= 60% confidence to STRONG (Green)', () => {
    const strongConf = mapConfidenceToStrength(73);
    expect(strongConf.confidence).toBe(73);
    expect(strongConf.strengthLevel).toBe('STRONG');
    expect(strongConf.signalColor).toBe('green');
    expect(strongConf.badgeText).toContain('73% · STRONG');
  });

  it('fails closed to SHADOW when league is non-active, even with high confidence', () => {
    const shadowInput = {
      ...baseValidInput,
      leagueKey: 'IDN-L1', // Indonesia Liga 1 is SHADOW
    };

    const validity = ProductionValidityGate.evaluate(shadowInput);
    expect(validity.isValid).toBe(false);
    expect(validity.state).toBe('SHADOW');
    expect(validity.validityStatus).toBe('SHADOW');
    expect(validity.rejectionReason).toContain('SHADOW_LEAGUE');
  });

  it('fails closed to INVALID when synthetic or mock data is detected', () => {
    const syntheticInput = {
      ...baseValidInput,
      homeTeam: 'Mock FC',
    };

    const validity = ProductionValidityGate.evaluate(syntheticInput);
    expect(validity.isValid).toBe(false);
    expect(validity.state).toBe('INVALID');
    expect(validity.rejectionReason).toContain('SYNTHETIC_DATA_PROHIBITED');
  });

  it('fails closed to INVALID when Moneyline (1X2) is requested', () => {
    const moneylineInput = {
      ...baseValidInput,
      market: '1X2',
      selection: 'Home Win',
    };

    const validity = ProductionValidityGate.evaluate(moneylineInput);
    expect(validity.isValid).toBe(false);
    expect(validity.state).toBe('INVALID');
    expect(validity.rejectionReason).toContain('MONEYLINE_UNSUPPORTED');
  });

  it('fails closed to STALE when odds snapshot is older than 24 hours', () => {
    const staleOddsInput = {
      ...baseValidInput,
      oddsTimestampUtc: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(), // 30h old
    };

    const validity = ProductionValidityGate.evaluate(staleOddsInput);
    expect(validity.isValid).toBe(false);
    expect(validity.state).toBe('STALE');
    expect(validity.rejectionReason).toContain('STALE_ODDS');
  });
});
