import { describe, it, expect } from 'vitest';
import { MultiLeagueGates } from '@/lib/validation/multiLeagueGates';

describe('MultiLeagueGates Specification Tests', () => {
  describe('Data Quality Gate', () => {
    it('passes clean, genuine fixture with valid canonical ID and kickoff', () => {
      const result = MultiLeagueGates.evaluateDataQuality({
        fixtureId: 'af_1203456',
        providerFixtureId: '1203456',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        kickoffUtc: '2026-10-15T15:00:00Z',
        competitionId: 39,
        season: '2026',
      });

      expect(result.passed).toBe(true);
      expect(result.reasons).toHaveLength(0);
      expect(result.isSynthetic).toBe(false);
      expect(result.canonicalIdGenerated).toBe(true);
      expect(result.kickoffValid).toBe(true);
    });

    it('rejects synthetic and mock fixtures', () => {
      const mockResult = MultiLeagueGates.evaluateDataQuality({
        fixtureId: 'af_test_123',
        homeTeam: 'Mock FC',
        awayTeam: 'Test United',
        kickoffUtc: '2026-10-15T15:00:00Z',
      });

      expect(mockResult.passed).toBe(false);
      expect(mockResult.isSynthetic).toBe(true);
      expect(mockResult.reasons).toContain('SYNTHETIC_DATA_PROHIBITED');
    });

    it('rejects fixtures with missing teams or invalid kickoff timestamps', () => {
      const invalidResult = MultiLeagueGates.evaluateDataQuality({
        fixtureId: 'af_12345678',
        homeTeam: '',
        awayTeam: 'Real Madrid',
        kickoffUtc: 'invalid-date',
      });

      expect(invalidResult.passed).toBe(false);
      expect(invalidResult.reasons).toContain('MISSING_HOME_TEAM');
      expect(invalidResult.reasons).toContain('INVALID_KICKOFF_TIMESTAMP');
    });
  });

  describe('Model Sample Gate (3+ matches requirement)', () => {
    it('passes when both home and away have 3 or more historical matches', () => {
      const result = MultiLeagueGates.evaluateModelSample({
        homeMatchesPlayed: 5,
        awayMatchesPlayed: 4,
        homeTeam: 'Barcelona',
        awayTeam: 'Valencia',
      });

      expect(result.passed).toBe(true);
      expect(result.validationStatus).toBe('MODEL_VALID');
      expect(result.verdict).toBe('ACTIONABLE');
      expect(result.actionable).toBe(true);
      expect(result.rejectionReason).toBeNull();
    });

    it('fails closed with LEWATI / actionable=false when either team has < 3 matches', () => {
      const result = MultiLeagueGates.evaluateModelSample({
        homeMatchesPlayed: 2,
        awayMatchesPlayed: 5,
        homeTeam: 'Como',
        awayTeam: 'Juventus',
      });

      expect(result.passed).toBe(false);
      expect(result.validationStatus).toBe('INSUFFICIENT_MODEL');
      expect(result.verdict).toBe('LEWATI');
      expect(result.actionable).toBe(false);
      expect(result.rejectionReason).toContain('INSUFFICIENT_MODEL');
      expect(result.rejectionReason).toContain('Como');
    });
  });

  describe('Point-in-Time Temporal Anti-Leakage Invariant', () => {
    it('passes when oddsTimestamp <= predictionTimestamp < kickoffTimestamp', () => {
      const result = MultiLeagueGates.verifyPointInTimeInvariant({
        kickoffUtc: '2026-10-15T19:45:00Z',
        predictionTimestampUtc: '2026-10-15T10:00:00Z',
        oddsTimestampUtc: '2026-10-15T09:30:00Z',
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('detects lookahead leakage when prediction timestamp is at or after kickoff', () => {
      const result = MultiLeagueGates.verifyPointInTimeInvariant({
        kickoffUtc: '2026-10-15T19:45:00Z',
        predictionTimestampUtc: '2026-10-15T20:00:00Z',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('LOOK_AHEAD_LEAKAGE');
      expect(result.error).toContain('strictly before kickoff');
    });

    it('detects lookahead leakage when odds timestamp is after prediction timestamp', () => {
      const result = MultiLeagueGates.verifyPointInTimeInvariant({
        kickoffUtc: '2026-10-15T19:45:00Z',
        predictionTimestampUtc: '2026-10-15T10:00:00Z',
        oddsTimestampUtc: '2026-10-15T11:00:00Z',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('LOOK_AHEAD_LEAKAGE');
      expect(result.error).toContain('cannot be after prediction timestamp');
    });
  });

  describe('Market Support Gate', () => {
    it('strictly disallows Moneyline (1X2) recommendations by product policy', () => {
      const result1x2 = MultiLeagueGates.evaluateMarketSupport({
        marketType: '1X2',
        homeOdds: 1.95,
        awayOdds: 1.95,
      });

      expect(result1x2.passed).toBe(false);
      expect(result1x2.rejectionReason).toContain('MONEYLINE_UNSUPPORTED');

      const resultMoneyline = MultiLeagueGates.evaluateMarketSupport({
        marketType: 'MONEYLINE',
        homeOdds: 1.95,
        awayOdds: 1.95,
      });

      expect(resultMoneyline.passed).toBe(false);
      expect(resultMoneyline.rejectionReason).toContain('MONEYLINE_UNSUPPORTED');
    });

    it('rejects when Pinnacle sharp reference is unavailable', () => {
      const result = MultiLeagueGates.evaluateMarketSupport({
        marketType: 'AH',
        line: -0.5,
        homeOdds: 1.95,
        awayOdds: 1.95,
        isPinnacle: false,
      });

      expect(result.passed).toBe(false);
      expect(result.rejectionReason).toContain('PINNACLE_UNAVAILABLE');
    });

    it('validates Asian Handicap market with Pinnacle odds and line', () => {
      const result = MultiLeagueGates.evaluateMarketSupport({
        marketType: 'AH',
        line: -0.25,
        homeOdds: 1.92,
        awayOdds: 1.98,
        isPinnacle: true,
      });

      expect(result.passed).toBe(true);
      expect(result.marketType).toBe('AH');
      expect(result.hasPinnacleOdds).toBe(true);
    });

    it('validates Over/Under market with Pinnacle odds and line', () => {
      const result = MultiLeagueGates.evaluateMarketSupport({
        marketType: 'OU',
        line: 2.5,
        overOdds: 1.90,
        underOdds: 2.00,
        isPinnacle: true,
      });

      expect(result.passed).toBe(true);
      expect(result.marketType).toBe('OU');
      expect(result.hasPinnacleOdds).toBe(true);
    });

    it('validates Both Teams to Score (BTTS) market with Pinnacle odds', () => {
      const result = MultiLeagueGates.evaluateMarketSupport({
        marketType: 'BTTS',
        yesOdds: 1.85,
        noOdds: 2.05,
        isPinnacle: true,
      });

      expect(result.passed).toBe(true);
      expect(result.marketType).toBe('BTTS');
      expect(result.hasPinnacleOdds).toBe(true);
    });
  });
});

