import { describe, it, expect, beforeEach } from 'vitest';
import { CanonicalBetLedgerService, classifyLineType } from '@/lib/ledger/canonicalBetLedger';
import { CanonicalSettlementEngine } from '@/lib/ledger/canonicalSettlementEngine';
import { CanonicalPerformanceEngine } from '@/lib/ledger/canonicalPerformanceEngine';
import { ReconciliationEngine } from '@/lib/ledger/reconciliationEngine';
import { SalmoPerformanceSyncService } from '@/lib/pipeline/salmoPerformanceSyncService';
import { ExactSettlementEngine } from '@/lib/research/settlement/exactSettlement';

describe('Canonical Prediction Ledger & Settlement & Performance Accounting', () => {
  beforeEach(() => {
    CanonicalBetLedgerService.clearForTesting();
  });

  describe('1. Line Type Classification & Deterministic Identity', () => {
    it('classifies full, half, quarter, and none lines correctly', () => {
      expect(classifyLineType(1.0)).toBe('FULL');
      expect(classifyLineType(2.0)).toBe('FULL');
      expect(classifyLineType(3.0)).toBe('FULL');
      expect(classifyLineType(1.5)).toBe('HALF');
      expect(classifyLineType(2.5)).toBe('HALF');
      expect(classifyLineType(3.5)).toBe('HALF');
      expect(classifyLineType(1.25)).toBe('QUARTER');
      expect(classifyLineType(1.75)).toBe('QUARTER');
      expect(classifyLineType(2.25)).toBe('QUARTER');
      expect(classifyLineType(2.75)).toBe('QUARTER');
      expect(classifyLineType(3.25)).toBe('QUARTER');
      expect(classifyLineType(3.75)).toBe('QUARTER');
      expect(classifyLineType(null)).toBe('NONE');
    });

    it('generates unique deterministic prediction ID and prevents collisions', () => {
      const id1 = CanonicalBetLedgerService.generatePredictionId('m_001', 'AH', 0.25, 'HOME', 'Pinnacle');
      const id2 = CanonicalBetLedgerService.generatePredictionId('m_001', 'AH', -0.25, 'HOME', 'Pinnacle');
      const id3 = CanonicalBetLedgerService.generatePredictionId('m_001', 'OU', 2.25, 'OVER', 'Pinnacle');
      const id4 = CanonicalBetLedgerService.generatePredictionId('m_001', 'OU', 2.50, 'OVER', 'Pinnacle');
      const id5 = CanonicalBetLedgerService.generatePredictionId('m_001', 'OU', 2.25, 'UNDER', 'Pinnacle');
      const id6 = CanonicalBetLedgerService.generatePredictionId('m_001', 'BTTS', null, 'YES', 'Pinnacle');

      const set = new Set([id1, id2, id3, id4, id5, id6]);
      expect(set.size).toBe(6);
    });

    it('enforces duplicate protection (idempotency)', () => {
      const predInput = {
        canonicalFixtureId: 'match_dup_01',
        fixture: 'Arsenal vs Chelsea',
        competition: 'Premier League',
        league: 'Premier League',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        kickoffTimestamp: '2026-10-01T15:00:00.000Z',
        market: 'AH' as const,
        selection: 'HOME',
        line: -0.5,
        provider: 'OddsPapi',
        bookmaker: 'Pinnacle',
        marketOdds: 2.05,
        oddsTimestamp: '2026-10-01T10:00:00.000Z',
        modelProbability: 0.55,
        fairOdds: 1.818,
        expectedValue: 0.1275,
        edge: 0.062,
        confidence: 'HIGH' as const,
        confidenceScore: 82,
        valueStatus: 'VALUE' as const,
        predictionTimestamp: '2026-10-01T10:00:00.000Z',
        featureTimestamp: '2026-10-01T09:30:00.000Z',
        modelVersion: 'dixon-coles-v1.0',
        pipelineVersion: 'production-v1.0',
        dataVersion: 'silver-v1.0',
      };

      const res1 = CanonicalBetLedgerService.recordPrediction(predInput);
      expect(res1.isNew).toBe(true);

      const res2 = CanonicalBetLedgerService.recordPrediction(predInput);
      expect(res2.isNew).toBe(false);
      expect(res2.record.predictionId).toBe(res1.record.predictionId);

      const all = CanonicalBetLedgerService.getAllPredictions();
      expect(all.length).toBe(1);
    });

    it('enforces immutability: historical odds and probabilities cannot be mutated', () => {
      const pred = CanonicalBetLedgerService.recordPrediction({
        canonicalFixtureId: 'match_immut_01',
        fixture: 'Liverpool vs Everton',
        competition: 'Premier League',
        league: 'Premier League',
        homeTeam: 'Liverpool',
        awayTeam: 'Everton',
        kickoffTimestamp: '2026-10-02T19:00:00.000Z',
        market: 'OU' as const,
        selection: 'OVER',
        line: 2.5,
        provider: 'OddsPapi',
        bookmaker: 'Pinnacle',
        marketOdds: 1.85,
        oddsTimestamp: '2026-10-02T12:00:00.000Z',
        modelProbability: 0.60,
        fairOdds: 1.667,
        expectedValue: 0.11,
        edge: 0.059,
        confidence: 'HIGH' as const,
        confidenceScore: 80,
        valueStatus: 'VALUE' as const,
        predictionTimestamp: '2026-10-02T12:00:00.000Z',
        featureTimestamp: '2026-10-02T11:30:00.000Z',
        modelVersion: 'dixon-coles-v1.0',
        pipelineVersion: 'production-v1.0',
        dataVersion: 'silver-v1.0',
      }).record;

      // Attempt second ingestion with different odds
      const attempt = CanonicalBetLedgerService.recordPrediction({
        ...pred,
        marketOdds: 2.50, // altered odds
        modelProbability: 0.90, // altered prob
      });

      expect(attempt.isNew).toBe(false);
      expect(attempt.record.marketOdds).toBe(1.85); // Preserved original
      expect(attempt.record.modelProbability).toBe(0.60); // Preserved original
    });
  });

  describe('2. Exact Multi-Market Settlement Semantics', () => {
    it('accurately settles Asian Handicap full, half, and quarter lines', () => {
      // AH -0.25 (Win 2-1) -> Full Win
      const r1 = ExactSettlementEngine.settleAsianHandicap(2, 1, -0.25, 2.00, 'HOME', 1.0);
      expect(r1.outcome).toBe('WIN');
      expect(r1.profit).toBeCloseTo(1.00, 4);
      expect(r1.returnAmount).toBeCloseTo(2.00, 4);

      // AH -0.25 (Draw 1-1) -> Half Loss
      const r2 = ExactSettlementEngine.settleAsianHandicap(1, 1, -0.25, 2.00, 'HOME', 1.0);
      expect(r2.outcome).toBe('HALF_LOSS');
      expect(r2.profit).toBeCloseTo(-0.50, 4);
      expect(r2.returnAmount).toBeCloseTo(0.50, 4);

      // AH +0.25 (Draw 1-1) -> Half Win
      const r3 = ExactSettlementEngine.settleAsianHandicap(1, 1, 0.25, 2.00, 'HOME', 1.0);
      expect(r3.outcome).toBe('HALF_WIN');
      expect(r3.profit).toBeCloseTo(0.50, 4);
      expect(r3.returnAmount).toBeCloseTo(1.50, 4);

      // AH 0.0 (Draw 0-0) -> Push
      const r4 = ExactSettlementEngine.settleAsianHandicap(0, 0, 0.0, 1.95, 'HOME', 1.0);
      expect(r4.outcome).toBe('PUSH');
      expect(r4.profit).toBe(0.0);
      expect(r4.returnAmount).toBe(1.0);

      // AH -0.75 (Win by 1: 1-0) -> Half Win
      const r5 = ExactSettlementEngine.settleAsianHandicap(1, 0, -0.75, 2.00, 'HOME', 1.0);
      expect(r5.outcome).toBe('HALF_WIN');
      expect(r5.profit).toBeCloseTo(0.50, 4);

      // AH -0.75 (Win by 2: 2-0) -> Full Win
      const r6 = ExactSettlementEngine.settleAsianHandicap(2, 0, -0.75, 2.00, 'HOME', 1.0);
      expect(r6.outcome).toBe('WIN');
      expect(r6.profit).toBeCloseTo(1.00, 4);

      // AH +0.75 (Loss by 1: 0-1) -> Half Loss
      const r7 = ExactSettlementEngine.settleAsianHandicap(0, 1, 0.75, 2.00, 'HOME', 1.0);
      expect(r7.outcome).toBe('HALF_LOSS');
      expect(r7.profit).toBeCloseTo(-0.50, 4);
    });

    it('accurately settles Over/Under whole, half, and quarter lines', () => {
      // OU 2.0 (Total = 2) -> PUSH
      const ouWholePush = ExactSettlementEngine.settleOverUnder(2, 2.0, 1.95, 'OVER', 1.0);
      expect(ouWholePush.outcome).toBe('PUSH');
      expect(ouWholePush.profit).toBe(0.0);

      // OU 2.0 (Total = 3) -> WIN
      const ouWholeWin = ExactSettlementEngine.settleOverUnder(3, 2.0, 1.95, 'OVER', 1.0);
      expect(ouWholeWin.outcome).toBe('WIN');
      expect(ouWholeWin.profit).toBeCloseTo(0.95, 4);

      // OU 2.5 (Total = 3) -> WIN
      const ouHalfWin = ExactSettlementEngine.settleOverUnder(3, 2.5, 1.90, 'OVER', 1.0);
      expect(ouHalfWin.outcome).toBe('WIN');
      expect(ouHalfWin.profit).toBeCloseTo(0.90, 4);

      // OU 2.5 (Total = 2) -> LOSS
      const ouHalfLoss = ExactSettlementEngine.settleOverUnder(2, 2.5, 1.90, 'OVER', 1.0);
      expect(ouHalfLoss.outcome).toBe('LOSS');
      expect(ouHalfLoss.profit).toBeCloseTo(-1.0, 4);

      // OU 2.25 OVER (Total = 2) -> HALF_LOSS (-0.5 stake)
      const ouQ225Over2 = ExactSettlementEngine.settleOverUnder(2, 2.25, 2.00, 'OVER', 1.0);
      expect(ouQ225Over2.outcome).toBe('HALF_LOSS');
      expect(ouQ225Over2.profit).toBeCloseTo(-0.50, 4);

      // OU 2.25 UNDER (Total = 2) -> HALF_WIN (+0.5 * (odds - 1))
      const ouQ225Under2 = ExactSettlementEngine.settleOverUnder(2, 2.25, 2.00, 'UNDER', 1.0);
      expect(ouQ225Under2.outcome).toBe('HALF_WIN');
      expect(ouQ225Under2.profit).toBeCloseTo(0.50, 4);

      // OU 2.75 OVER (Total = 3) -> HALF_WIN
      const ouQ275Over3 = ExactSettlementEngine.settleOverUnder(3, 2.75, 2.00, 'OVER', 1.0);
      expect(ouQ275Over3.outcome).toBe('HALF_WIN');
      expect(ouQ275Over3.profit).toBeCloseTo(0.50, 4);

      // OU 2.75 UNDER (Total = 3) -> HALF_LOSS
      const ouQ275Under3 = ExactSettlementEngine.settleOverUnder(3, 2.75, 2.00, 'UNDER', 1.0);
      expect(ouQ275Under3.outcome).toBe('HALF_LOSS');
      expect(ouQ275Under3.profit).toBeCloseTo(-0.50, 4);
    });

    it('accurately settles BTTS (Yes / No)', () => {
      // BTTS YES (1-1) -> WIN
      const btts1 = ExactSettlementEngine.settleBtts(1, 1, 1.80, 'YES', 1.0);
      expect(btts1.outcome).toBe('WIN');
      expect(btts1.profit).toBeCloseTo(0.80, 4);

      // BTTS YES (2-0) -> LOSS
      const btts2 = ExactSettlementEngine.settleBtts(2, 0, 1.80, 'YES', 1.0);
      expect(btts2.outcome).toBe('LOSS');
      expect(btts2.profit).toBeCloseTo(-1.0, 4);

      // BTTS NO (2-0) -> WIN
      const btts3 = ExactSettlementEngine.settleBtts(2, 0, 2.05, 'NO', 1.0);
      expect(btts3.outcome).toBe('WIN');
      expect(btts3.profit).toBeCloseTo(1.05, 4);
    });
  });

  describe('3. Lifecycle, Postponed, Void, and CLV Validation', () => {
    it('prevents settlement before kickoff timestamp', () => {
      const pred = CanonicalBetLedgerService.recordPrediction({
        canonicalFixtureId: 'match_time_01',
        fixture: 'Real Madrid vs Barcelona',
        competition: 'La Liga',
        league: 'La Liga',
        homeTeam: 'Real Madrid',
        awayTeam: 'Barcelona',
        kickoffTimestamp: '2026-10-10T20:00:00.000Z',
        market: 'AH',
        selection: 'HOME',
        line: -0.25,
        provider: 'OddsPapi',
        bookmaker: 'Pinnacle',
        marketOdds: 1.95,
        oddsTimestamp: '2026-10-10T12:00:00.000Z',
        modelProbability: 0.55,
        fairOdds: 1.818,
        expectedValue: 0.0725,
        edge: 0.037,
        confidence: 'HIGH',
        confidenceScore: 81,
        valueStatus: 'VALUE',
        predictionTimestamp: '2026-10-10T12:00:00.000Z',
        featureTimestamp: '2026-10-10T11:30:00.000Z',
        modelVersion: 'dixon-coles-v1.0',
        pipelineVersion: 'production-v1.0',
        dataVersion: 'silver-v1.0',
      }).record;

      // Try settling 2 hours before kickoff
      const beforeKickoffMs = new Date('2026-10-10T18:00:00.000Z').getTime();
      const res = CanonicalSettlementEngine.settlePrediction(pred, {
        status: 'FT',
        homeGoals: 2,
        awayGoals: 1,
      }, { nowMs: beforeKickoffMs });

      expect(res.settled).toBe(false);
      expect(res.reason).toContain('KICKOFF_NOT_REACHED');
      expect(pred.status).toBe('PENDING');
    });

    it('keeps postponed matches in PENDING state with zero profit impact', () => {
      const pred = CanonicalBetLedgerService.recordPrediction({
        canonicalFixtureId: 'match_pst_01',
        fixture: 'Bayern Munich vs Dortmund',
        competition: 'Bundesliga',
        league: 'Bundesliga',
        homeTeam: 'Bayern Munich',
        awayTeam: 'Dortmund',
        kickoffTimestamp: '2026-10-05T16:30:00.000Z',
        market: 'OU',
        selection: 'OVER',
        line: 3.5,
        provider: 'OddsPapi',
        bookmaker: 'Pinnacle',
        marketOdds: 2.10,
        oddsTimestamp: '2026-10-05T10:00:00.000Z',
        modelProbability: 0.52,
        fairOdds: 1.923,
        expectedValue: 0.092,
        edge: 0.044,
        confidence: 'MEDIUM',
        confidenceScore: 72,
        valueStatus: 'VALUE',
        predictionTimestamp: '2026-10-05T10:00:00.000Z',
        featureTimestamp: '2026-10-05T09:30:00.000Z',
        modelVersion: 'dixon-coles-v1.0',
        pipelineVersion: 'production-v1.0',
        dataVersion: 'silver-v1.0',
      }).record;

      const afterKickoffMs = new Date('2026-10-05T19:00:00.000Z').getTime();
      const res = CanonicalSettlementEngine.settlePrediction(pred, {
        status: 'PST',
        homeGoals: null,
        awayGoals: null,
      }, { nowMs: afterKickoffMs });

      expect(res.settled).toBe(false);
      expect(res.reason).toContain('MATCH_POSTPONED');
      expect(pred.status).toBe('PENDING');
      expect(pred.settlement).toBeNull();
    });

    it('settles cancelled or abandoned match as VOID with stake returned in full', () => {
      const pred = CanonicalBetLedgerService.recordPrediction({
        canonicalFixtureId: 'match_canc_01',
        fixture: 'Milan vs Inter',
        competition: 'Serie A',
        league: 'Serie A',
        homeTeam: 'Milan',
        awayTeam: 'Inter',
        kickoffTimestamp: '2026-10-04T19:45:00.000Z',
        market: 'BTTS',
        selection: 'YES',
        line: null,
        provider: 'OddsPapi',
        bookmaker: 'Pinnacle',
        marketOdds: 1.85,
        oddsTimestamp: '2026-10-04T12:00:00.000Z',
        modelProbability: 0.58,
        fairOdds: 1.724,
        expectedValue: 0.073,
        edge: 0.039,
        confidence: 'MEDIUM',
        confidenceScore: 74,
        valueStatus: 'VALUE',
        predictionTimestamp: '2026-10-04T12:00:00.000Z',
        featureTimestamp: '2026-10-04T11:30:00.000Z',
        modelVersion: 'dixon-coles-v1.0',
        pipelineVersion: 'production-v1.0',
        dataVersion: 'silver-v1.0',
      }).record;

      const afterKickoffMs = new Date('2026-10-04T22:00:00.000Z').getTime();
      const res = CanonicalSettlementEngine.settlePrediction(pred, {
        status: 'CANC',
        homeGoals: null,
        awayGoals: null,
      }, { nowMs: afterKickoffMs });

      expect(res.settled).toBe(true);
      expect(res.settlement?.outcome).toBe('VOID');
      expect(res.settlement?.profitUnits).toBe(0.0);
      expect(res.settlement?.returnUnits).toBe(1.0);
    });

    it('calculates CLV correctly and flags UNAVAILABLE if closing line moved', () => {
      const pred = CanonicalBetLedgerService.recordPrediction({
        canonicalFixtureId: 'match_clv_01',
        fixture: 'Man City vs Man United',
        competition: 'Premier League',
        league: 'Premier League',
        homeTeam: 'Man City',
        awayTeam: 'Man United',
        kickoffTimestamp: '2026-10-03T16:30:00.000Z',
        market: 'AH',
        selection: 'HOME',
        line: -1.25,
        provider: 'OddsPapi',
        bookmaker: 'Pinnacle',
        marketOdds: 2.10, // Available prediction odds
        oddsTimestamp: '2026-10-03T09:00:00.000Z',
        modelProbability: 0.54,
        fairOdds: 1.852,
        expectedValue: 0.134,
        edge: 0.064,
        confidence: 'HIGH',
        confidenceScore: 84,
        valueStatus: 'VALUE',
        predictionTimestamp: '2026-10-03T09:00:00.000Z',
        featureTimestamp: '2026-10-03T08:30:00.000Z',
        modelVersion: 'dixon-coles-v1.0',
        pipelineVersion: 'production-v1.0',
        dataVersion: 'silver-v1.0',
      }).record;

      const afterKickoffMs = new Date('2026-10-03T19:00:00.000Z').getTime();

      // Create predB BEFORE settling pred, using distinct fixture ID and fresh identity
      // Omit predictionId from spread so a new deterministic ID is generated from the tuple
      const { predictionId: _ignored, settlement: _s, clvRecord: _c, revisions: _r, status: _st, ...predBase } = pred;
      const predB = CanonicalBetLedgerService.recordPrediction({
        ...predBase,
        canonicalFixtureId: 'match_clv_02',
      }).record;

      // Case A: Matching line closing odds = 1.95 -> Beat line!
      const resA = CanonicalSettlementEngine.settlePrediction(pred, {
        status: 'FT',
        homeGoals: 3,
        awayGoals: 1, // Win by 2 -> Full Win on -1.25
        closingOdds: 1.95,
        closingLine: -1.25,
      }, { nowMs: afterKickoffMs });

      expect(resA.settled).toBe(true);
      expect(resA.settlement?.outcome).toBe('WIN');
      expect(resA.settlement?.profitUnits).toBeCloseTo(1.10, 4);
      expect(pred.clvRecord?.clvStatus).toBe('AVAILABLE');
      expect(pred.clvRecord?.clvAbsolute).toBeCloseTo(0.15, 4); // 2.10 - 1.95
      expect(pred.clvRecord?.clvPercentage).toBeCloseTo(0.0769, 4); // (2.10 / 1.95) - 1

      // Case B: Line moved from -1.25 to -1.50 -> CLV UNAVAILABLE
      const resB = CanonicalSettlementEngine.settlePrediction(predB, {
        status: 'FT',
        homeGoals: 2,
        awayGoals: 0,
        closingOdds: 1.90,
        closingLine: -1.50, // Line moved!
      }, { nowMs: afterKickoffMs });

      expect(resB.settled).toBe(true);
      expect(predB.clvRecord?.clvStatus).toBe('UNAVAILABLE');
      expect(predB.clvRecord?.clvPercentage).toBeNull();
    });
  });

  describe('4. Performance Engine, 1.0U Stake Accounting & Reconciliation Invariants', () => {
    it('accurately reconciles 10 mixed bets against exact ledger accounting and syncs to Salmo', async () => {
      // Create 10 known bets with mixed outcomes:
      // Bet 1: Win (+1.00)
      // Bet 2: Win (+0.95)
      // Bet 3: Half Win (+0.50)
      // Bet 4: Push (0.00)
      // Bet 5: Half Loss (-0.50)
      // Bet 6: Loss (-1.00)
      // Bet 7: Loss (-1.00)
      // Bet 8: Win (+0.85)
      // Bet 9: Void (0.00)
      // Bet 10: Pending (unsettled)

      const betsData = [
        { id: 'b1', m: 'AH' as const, l: -0.5, sel: 'HOME', odds: 2.00, hG: 1, aG: 0, status: 'FT', cOdds: 1.90 },
        { id: 'b2', m: 'OU' as const, l: 2.5, sel: 'OVER', odds: 1.95, hG: 2, aG: 1, status: 'FT', cOdds: 1.85 },
        { id: 'b3', m: 'AH' as const, l: 0.25, sel: 'HOME', odds: 2.00, hG: 1, aG: 1, status: 'FT', cOdds: 2.05 },
        { id: 'b4', m: 'OU' as const, l: 2.0, sel: 'OVER', odds: 1.90, hG: 1, aG: 1, status: 'FT', cOdds: 1.90 },
        { id: 'b5', m: 'AH' as const, l: -0.25, sel: 'HOME', odds: 2.00, hG: 0, aG: 0, status: 'FT', cOdds: 2.00 },
        { id: 'b6', m: 'BTTS' as const, l: null, sel: 'YES', odds: 1.85, hG: 1, aG: 0, status: 'FT', cOdds: 1.80 },
        { id: 'b7', m: 'OU' as const, l: 2.5, sel: 'OVER', odds: 1.90, hG: 0, aG: 1, status: 'FT', cOdds: 1.95 },
        { id: 'b8', m: 'BTTS' as const, l: null, sel: 'YES', odds: 1.85, hG: 1, aG: 1, status: 'FT', cOdds: 1.80 },
        { id: 'b9', m: 'AH' as const, l: 0.0, sel: 'HOME', odds: 2.00, hG: null, aG: null, status: 'CANC', cOdds: null },
        { id: 'b10', m: 'OU' as const, l: 2.5, sel: 'OVER', odds: 2.00, hG: null, aG: null, status: 'NS', cOdds: null },
      ];

      const nowMs = new Date('2026-10-01T20:00:00.000Z').getTime();

      for (const b of betsData) {
        const pred = CanonicalBetLedgerService.recordPrediction({
          canonicalFixtureId: `fx_${b.id}`,
          fixture: `TeamA vs TeamB ${b.id}`,
          competition: 'Premier League',
          league: 'Premier League',
          homeTeam: 'TeamA',
          awayTeam: 'TeamB',
          kickoffTimestamp: '2026-10-01T15:00:00.000Z',
          market: b.m,
          selection: b.sel,
          line: b.l,
          provider: 'OddsPapi',
          bookmaker: 'Pinnacle',
          marketOdds: b.odds,
          oddsTimestamp: '2026-10-01T10:00:00.000Z',
          modelProbability: 0.55,
          fairOdds: 1.818,
          expectedValue: 0.05,
          edge: 0.03,
          confidence: 'HIGH',
          confidenceScore: 78,
          valueStatus: 'VALUE',
          predictionTimestamp: '2026-10-01T10:00:00.000Z',
          featureTimestamp: '2026-10-01T09:30:00.000Z',
          modelVersion: 'dixon-coles-v1.0',
          pipelineVersion: 'production-v1.0',
          dataVersion: 'silver-v1.0',
        }).record;

        if (b.status === 'FT' || b.status === 'CANC') {
          CanonicalSettlementEngine.settlePrediction(pred, {
            status: b.status,
            homeGoals: b.hG,
            awayGoals: b.aG,
            closingOdds: b.cOdds,
            closingLine: b.l,
          }, { nowMs });
        }
      }

      // 1. Reconciliation Audit Check
      const all = CanonicalBetLedgerService.getAllPredictions();
      expect(all.length).toBe(10);

      const audit = ReconciliationEngine.runAudit(all);
      expect(audit.status).toBe('RECONCILIATION_PASS');
      expect(audit.totalPredictions).toBe(10);
      expect(audit.settledCount).toBe(8);
      expect(audit.pendingCount).toBe(1);
      expect(audit.voidCount).toBe(1);
      expect(audit.lifecycleBalanceValid).toBe(true);
      expect(audit.profitSumValid).toBe(true);

      // Expected P/L for settled bets:
      // b1 (WIN): +1.00
      // b2 (WIN): +0.95
      // b3 (HALF_WIN): +0.50
      // b4 (PUSH): 0.00
      // b5 (HALF_LOSS): -0.50
      // b6 (LOSS): -1.00
      // b7 (LOSS): -1.00
      // b8 (WIN): +0.85
      // Total Profit = 1.00 + 0.95 + 0.50 + 0 - 0.50 - 1.00 - 1.00 + 0.85 = +0.80
      // Settled Staked = 8 bets * 1.0 = 8.0 units
      // ROI = 0.80 / 8.0 = +10.0%
      const report = CanonicalPerformanceEngine.generateReport(all);
      expect(report.totalStaked).toBeCloseTo(8.0, 2);
      expect(report.totalProfit).toBeCloseTo(0.80, 4);
      expect(report.roiDecimal).toBeCloseTo(0.10, 4);
      expect(report.roiPct).toBe(10.0);
      expect(report.yieldPct).toBe(10.0);

      // Rates:
      // Wins: 3, Half Wins: 1, Pushes: 1, Half Losses: 1, Losses: 2
      // Effective bets = 3 + 1 + 1 + 1 + 2 = 8
      // Win Rate = (3 + 0.5 * 1) / 8 = 3.5 / 8 = 43.75%
      expect(report.winRatePct).toBe(43.75);

      // Bankroll Curve & Drawdown Check
      expect(report.startingBankroll).toBe(100.0);
      expect(report.currentBankroll).toBeCloseTo(100.80, 2);
      expect(report.drawdown.maxDrawdownUnits).toBeGreaterThan(0);

      // Salmo Sync Check (uses same 10-bet ledger state)
      const syncReport = await SalmoPerformanceSyncService.syncToSalmo();
      expect(syncReport.status).toBe('SUCCESS');
      expect(syncReport.totalPredictions).toBe(10);
      expect(syncReport.settledPredictions).toBe(8);
      expect(syncReport.totalProfit).toBeCloseTo(0.80, 2);
      expect(syncReport.roiPct).toBe(10.0);

      const loaded = SalmoPerformanceSyncService.loadSyncedPerformance();
      expect(loaded).not.toBeNull();
      expect(loaded?.totalPredictions).toBe(10);
      expect(loaded?.roiPct).toBe(10.0);
    });
  });
});
