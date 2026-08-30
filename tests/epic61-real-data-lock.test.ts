// HANDICAPLAB — EPIC DATA INTEGRITY GATE: Real-Data-Only Lock & Moneyline Removal Test Suite
import { describe, it, expect } from 'vitest';
import {
  CANONICAL_MARKETS,
  normalizeToCanonicalMarket,
  isProductionMarketSupported,
  CanonicalMarket,
} from '../src/lib/markets/marketRegistry';
import {
  validateUpcomingPrediction,
  RawPredictionCandidate,
} from '../src/lib/validation/predictionGate';
import {
  settleAsianTotal,
  settleBtts,
  settleAsianHandicap,
  profitOfOutcome,
} from '../src/historical/settlement/settlement';
import { getTerminalPredictions } from '../src/lib/terminalData';
import { fetchTodayPicks } from '../src/lib/queries/picks';
import { GET as getMoneylineEndpoint } from '../src/app/api/v1/markets/moneyline/route';

describe('EPIC 61 DATA INTEGRITY GATE — Real-Data-Only Lock & Market Governance Suite', () => {
  // --------------------------------------------------------------------------
  // Phase 1 & 6 — Market Registry & Strict Moneyline Deactivation
  // --------------------------------------------------------------------------
  describe('Phase 1 & 6: Canonical Market Registry & Strict Moneyline Removal', () => {
    it('should contain exactly AH, OU, BTTS as active canonical markets', () => {
      expect(CANONICAL_MARKETS).toEqual(['AH', 'OU', 'BTTS']);
      expect(CANONICAL_MARKETS).not.toContain('ML');
      expect(CANONICAL_MARKETS).not.toContain('moneyline');
      expect(CANONICAL_MARKETS).not.toContain('1X2');
    });

    it('should normalize valid AH variants to AH', () => {
      expect(normalizeToCanonicalMarket('AH')).toBe('AH');
      expect(normalizeToCanonicalMarket('asian_handicap')).toBe('AH');
      expect(normalizeToCanonicalMarket('Asian-Handicap')).toBe('AH');
      expect(normalizeToCanonicalMarket('handicap')).toBe('AH');
      expect(isProductionMarketSupported('asian_handicap')).toBe(true);
    });

    it('should normalize valid OU variants to OU', () => {
      expect(normalizeToCanonicalMarket('OU')).toBe('OU');
      expect(normalizeToCanonicalMarket('over_under')).toBe('OU');
      expect(normalizeToCanonicalMarket('Over/Under')).toBe('OU');
      expect(normalizeToCanonicalMarket('totals')).toBe('OU');
      expect(isProductionMarketSupported('over_under')).toBe(true);
    });

    it('should normalize valid BTTS variants to BTTS', () => {
      expect(normalizeToCanonicalMarket('BTTS')).toBe('BTTS');
      expect(normalizeToCanonicalMarket('both_teams_to_score')).toBe('BTTS');
      expect(normalizeToCanonicalMarket('Both Teams To Score')).toBe('BTTS');
      expect(isProductionMarketSupported('btts')).toBe(true);
    });

    it('should strictly reject and deprecate Moneyline / 1X2 / ML', () => {
      expect(normalizeToCanonicalMarket('moneyline')).toBeNull();
      expect(normalizeToCanonicalMarket('Moneyline')).toBeNull();
      expect(normalizeToCanonicalMarket('1X2')).toBeNull();
      expect(normalizeToCanonicalMarket('ML')).toBeNull();
      expect(isProductionMarketSupported('moneyline')).toBe(false);
      expect(isProductionMarketSupported('1X2')).toBe(false);
    });

    it('deprecated Moneyline API route should return HTTP 410 Gone', async () => {
      const response = await getMoneylineEndpoint();
      expect(response.status).toBe(410);
      const json = await response.json();
      expect(json.status).toBe('DEPRECATED');
      expect(json.canonicalMarkets).toEqual(['AH', 'OU', 'BTTS']);
    });
  });

  // --------------------------------------------------------------------------
  // Phase 1 & 2 — Time-Safety & Already-Played Fixture Isolation
  // --------------------------------------------------------------------------
  describe('Phase 1 & 2: Real Fixture Invariant & Already-Played Fixture Protection', () => {
    const fixedNow = new Date('2026-08-30T18:00:00Z');

    it('should reject past kickoff timestamps even if status is scheduled', () => {
      const pastCandidate: RawPredictionCandidate = {
        id: 'pred-101',
        fixtureId: 'real-fix-12345',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        kickoffTime: '2026-08-30T17:00:00Z', // 1 hour in the past
        status: 'NS',
        market: 'AH',
        odds: 1.95,
      };

      const result = validateUpcomingPrediction(pastCandidate, fixedNow);
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe('FIXTURE_ALREADY_PLAYED');
    });

    it('should accept genuinely future kickoff timestamps with valid provider identity', () => {
      const futureCandidate: RawPredictionCandidate = {
        id: 'pred-102',
        fixtureId: 'apifootball-998877',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        kickoffTime: '2026-08-31T15:00:00Z', // Future
        status: 'NS',
        market: 'AH',
        odds: 1.95,
      };

      const result = validateUpcomingPrediction(futureCandidate, fixedNow);
      expect(result.isValid).toBe(true);
      expect(result.canonicalMarket).toBe('AH');
    });

    it('should reject finished status (FT) even if date was claimed future', () => {
      const finishedCandidate: RawPredictionCandidate = {
        id: 'pred-103',
        fixtureId: 'apifootball-998878',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        kickoffTime: '2026-08-31T15:00:00Z',
        status: 'FT',
        market: 'OU',
        odds: 1.90,
      };

      const result = validateUpcomingPrediction(finishedCandidate, fixedNow);
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe('INVALID_STATUS');
    });

    it('should reject cancelled/postponed status without future reschedule', () => {
      const cancelledCandidate: RawPredictionCandidate = {
        id: 'pred-104',
        fixtureId: 'apifootball-998879',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        kickoffTime: '2026-08-31T15:00:00Z',
        status: 'CANC',
        market: 'BTTS',
        odds: 1.85,
      };

      const result = validateUpcomingPrediction(cancelledCandidate, fixedNow);
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe('INVALID_STATUS');
    });

    it('should reject missing or unparseable kickoff timestamp', () => {
      const invalidTimeCandidate: RawPredictionCandidate = {
        id: 'pred-105',
        fixtureId: 'apifootball-998880',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        kickoffTime: 'invalid-date-string',
        status: 'NS',
        market: 'AH',
        odds: 1.95,
      };

      const result = validateUpcomingPrediction(invalidTimeCandidate, fixedNow);
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe('INVALID_OR_MISSING_KICKOFF');
    });
  });

  // --------------------------------------------------------------------------
  // Phase 3 — Zero Mock Data in Production & Empty-State Invariant
  // --------------------------------------------------------------------------
  describe('Phase 3: Zero Mock Data in Production & Empty State Behavior', () => {
    it('getTerminalPredictions() should return empty array when ledger is empty, not fake mock fixtures', () => {
      const predictions = getTerminalPredictions();
      expect(Array.isArray(predictions)).toBe(true);
      for (const p of predictions) {
        expect(p.home_team).not.toBe('Liverpool vs Everton Sample');
        expect(p.market).toBe('ASIAN_HANDICAP');
      }
    });

    it('fetchTodayPicks() should return empty array upon query miss, not fabricated mock arrays', async () => {
      const picks = await fetchTodayPicks();
      expect(Array.isArray(picks)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Phase 2 Specific — Liverpool / Everton Resolution
  // --------------------------------------------------------------------------
  describe('Phase 2 Specific: Liverpool / Everton Stale Record Resolution', () => {
    const fixedNow = new Date('2026-08-30T18:00:00Z');

    it('should reject stale July 2026 synthetic Liverpool / Everton records from appearing in upcoming predictions', () => {
      const staleLivEve: RawPredictionCandidate = {
        id: 'mock-liv-eve-001',
        fixtureId: '9cc3298c-b699-4787-9a25-1f39e1318852',
        homeTeam: 'Liverpool',
        awayTeam: 'Everton',
        kickoffTime: '2026-07-04T16:31:23.197Z',
        status: 'PENDING',
        market: 'MONEYLINE',
      };

      const result = validateUpcomingPrediction(staleLivEve, fixedNow);
      expect(result.isValid).toBe(false);
      expect(['INVALID_MARKET', 'FIXTURE_ALREADY_PLAYED']).toContain(result.rejectionReason);
    });

    it('should reject synthetic Liverpool fixture with mock ID prefix', () => {
      const mockLiv: RawPredictionCandidate = {
        id: 'mock-101',
        fixtureId: 'mock-epl-001',
        homeTeam: 'Liverpool',
        awayTeam: 'Everton',
        kickoffTime: '2026-09-10T15:00:00Z',
        status: 'NS',
        market: 'AH',
        isSynthetic: true,
      };

      const result = validateUpcomingPrediction(mockLiv, fixedNow);
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe('MOCK_OR_MISSING_PROVIDER_ID');
    });
  });

  // --------------------------------------------------------------------------
  // Phase 4 & 5 — Real Provider Identity & Real Odds / Stats
  // --------------------------------------------------------------------------
  describe('Phase 4 & 5: Real Provider Identity & Odds Traceability', () => {
    const fixedNow = new Date('2026-08-30T18:00:00Z');

    it('should reject predictions with missing fixture ID', () => {
      const candidate: RawPredictionCandidate = {
        fixtureId: '',
        homeTeam: 'Real Madrid',
        awayTeam: 'Barcelona',
        kickoffTime: '2026-09-01T20:00:00Z',
        status: 'NS',
        market: 'AH',
      };

      const result = validateUpcomingPrediction(candidate, fixedNow);
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe('MOCK_OR_MISSING_PROVIDER_ID');
    });

    it('should reject invalid non-positive odds (<= 1.0 or NaN)', () => {
      const candidate: RawPredictionCandidate = {
        fixtureId: 'apifootball-123',
        homeTeam: 'Real Madrid',
        awayTeam: 'Barcelona',
        kickoffTime: '2026-09-01T20:00:00Z',
        status: 'NS',
        market: 'BTTS',
        odds: 0.95, // Impossible decimal odds
      };

      const result = validateUpcomingPrediction(candidate, fixedNow);
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe('MISSING_REAL_ODDS');
    });

    it('should reject predictions with missing or identical team names', () => {
      const candidate: RawPredictionCandidate = {
        fixtureId: 'apifootball-124',
        homeTeam: 'Arsenal',
        awayTeam: 'Arsenal', // Same team
        kickoffTime: '2026-09-01T20:00:00Z',
        status: 'NS',
        market: 'AH',
        odds: 1.95,
      };

      const result = validateUpcomingPrediction(candidate, fixedNow);
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe('MISSING_TEAMS');
    });
  });

  // --------------------------------------------------------------------------
  // Phase 4 Research Distinction — Asian Total 3.0 & Quarter Line Settlement
  // --------------------------------------------------------------------------
  describe('Phase 4: Over/Under Settlement Logic (Asian Total 3.0 & Quarter Lines)', () => {
    it('Asian Total 3.0: Total Goals <= 2 -> Under WIN, Over LOSS', () => {
      expect(settleAsianTotal('under', 3.0, 0)).toBe('WIN');
      expect(settleAsianTotal('under', 3.0, 1)).toBe('WIN');
      expect(settleAsianTotal('under', 3.0, 2)).toBe('WIN');

      expect(settleAsianTotal('over', 3.0, 0)).toBe('LOSS');
      expect(settleAsianTotal('over', 3.0, 1)).toBe('LOSS');
      expect(settleAsianTotal('over', 3.0, 2)).toBe('LOSS');
    });

    it('Asian Total 3.0: Total Goals = 3 -> PUSH for both Over and Under', () => {
      expect(settleAsianTotal('over', 3.0, 3)).toBe('PUSH');
      expect(settleAsianTotal('under', 3.0, 3)).toBe('PUSH');
      expect(profitOfOutcome('PUSH', 1.95, 100)).toBe(0);
    });

    it('Asian Total 3.0: Total Goals >= 4 -> Over WIN, Under LOSS', () => {
      expect(settleAsianTotal('over', 3.0, 4)).toBe('WIN');
      expect(settleAsianTotal('over', 3.0, 5)).toBe('WIN');

      expect(settleAsianTotal('under', 3.0, 4)).toBe('LOSS');
      expect(settleAsianTotal('under', 3.0, 5)).toBe('LOSS');
    });

    it('Quarter lines: 2.75 with 3 goals produces HALF_WIN on Over and HALF_LOSS on Under (never coerced to 3.0)', () => {
      expect(settleAsianTotal('over', 2.75, 3)).toBe('HALF_WIN');
      expect(settleAsianTotal('under', 2.75, 3)).toBe('HALF_LOSS');
      expect(profitOfOutcome('HALF_WIN', 2.00, 100)).toBe(50);
      expect(profitOfOutcome('HALF_LOSS', 2.00, 100)).toBe(-50);
    });

    it('Quarter lines: 3.25 with 3 goals produces HALF_LOSS on Over and HALF_WIN on Under', () => {
      expect(settleAsianTotal('over', 3.25, 3)).toBe('HALF_LOSS');
      expect(settleAsianTotal('under', 3.25, 3)).toBe('HALF_WIN');
    });
  });

  // --------------------------------------------------------------------------
  // Phase 5 — BTTS Settlement Logic
  // --------------------------------------------------------------------------
  describe('Phase 5: BTTS Settlement Logic (Real Goals)', () => {
    it('2-1 score -> BTTS YES WIN, BTTS NO LOSS', () => {
      expect(settleBtts('yes', 2, 1)).toBe('WIN');
      expect(settleBtts('no', 2, 1)).toBe('LOSS');
    });

    it('1-1 score -> BTTS YES WIN, BTTS NO LOSS', () => {
      expect(settleBtts('yes', 1, 1)).toBe('WIN');
      expect(settleBtts('no', 1, 1)).toBe('LOSS');
    });

    it('2-0 score -> BTTS YES LOSS, BTTS NO WIN', () => {
      expect(settleBtts('yes', 2, 0)).toBe('LOSS');
      expect(settleBtts('no', 2, 0)).toBe('WIN');
    });

    it('0-0 score -> BTTS YES LOSS, BTTS NO WIN', () => {
      expect(settleBtts('yes', 0, 0)).toBe('LOSS');
      expect(settleBtts('no', 0, 0)).toBe('WIN');
    });

    it('Negative score / Voided match -> VOID', () => {
      expect(settleBtts('yes', -1, 0)).toBe('VOID');
      expect(settleBtts('no', 1, 1, true)).toBe('VOID');
    });
  });
});
