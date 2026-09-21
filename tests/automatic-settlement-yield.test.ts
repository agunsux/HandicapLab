import { describe, it, expect, beforeEach } from 'vitest';
import { PredictionArchiveService } from '@/lib/archive/predictionArchiveService';
import { DailyPerformanceService } from '@/lib/ledger/dailyPerformanceService';
import { ExactSettlementEngine } from '@/lib/research/settlement/exactSettlement';

describe('Automatic Settlement, Exact Quarter-Line Math & Multi-Window Yield', () => {
  beforeEach(() => {
    PredictionArchiveService.clearStoreForTesting();
  });

  describe('Exact Quarter-Line Math Verification', () => {
    it('accurately settles Asian Handicap -0.25 line', () => {
      // Team wins by 1 (2-1) -> full win
      const winResult = ExactSettlementEngine.settleAsianHandicap(2, 1, -0.25, 2.00);
      expect(winResult.outcome).toBe('WIN');
      expect(winResult.profit).toBeCloseTo(1.0, 4);

      // Draw (0-0) -> half loss (-0.5 stake)
      const halfLossResult = ExactSettlementEngine.settleAsianHandicap(0, 0, -0.25, 2.00);
      expect(halfLossResult.outcome).toBe('HALF_LOSS');
      expect(halfLossResult.profit).toBeCloseTo(-0.5, 4);

      // Loss (0-1) -> full loss (-1.0 stake)
      const lossResult = ExactSettlementEngine.settleAsianHandicap(0, 1, -0.25, 2.00);
      expect(lossResult.outcome).toBe('LOSS');
      expect(lossResult.profit).toBeCloseTo(-1.0, 4);
    });

    it('accurately settles Asian Handicap +0.25 line', () => {
      // Draw (1-1) -> half win (+0.5 * (odds - 1))
      const halfWinResult = ExactSettlementEngine.settleAsianHandicap(1, 1, 0.25, 2.00);
      expect(halfWinResult.outcome).toBe('HALF_WIN');
      expect(halfWinResult.profit).toBeCloseTo(0.5, 4);

      // Win (2-1) -> full win
      const winResult = ExactSettlementEngine.settleAsianHandicap(2, 1, 0.25, 2.00);
      expect(winResult.outcome).toBe('WIN');
      expect(winResult.profit).toBeCloseTo(1.0, 4);

      // Loss by 1 (0-1) -> full loss
      const lossResult = ExactSettlementEngine.settleAsianHandicap(0, 1, 0.25, 2.00);
      expect(lossResult.outcome).toBe('LOSS');
      expect(lossResult.profit).toBeCloseTo(-1.0, 4);
    });

    it('accurately settles Over/Under 2.5 and BTTS', () => {
      // Over 2.5 with 3 goals -> WIN
      const ouWin = ExactSettlementEngine.settleOverUnder(3, 2.5, 1.90, 'OVER');
      expect(ouWin.outcome).toBe('WIN');
      expect(ouWin.profit).toBeCloseTo(0.90, 4);

      // Over 2.5 with 2 goals -> LOSS
      const ouLoss = ExactSettlementEngine.settleOverUnder(2, 2.5, 1.90, 'OVER');
      expect(ouLoss.outcome).toBe('LOSS');
      expect(ouLoss.profit).toBeCloseTo(-1.0, 4);

      // BTTS YES with 1-1 -> WIN
      const bttsWin = ExactSettlementEngine.settleBtts(1, 1, 1.85, 'YES');
      expect(bttsWin.outcome).toBe('WIN');
      expect(bttsWin.profit).toBeCloseTo(0.85, 4);

      // BTTS YES with 2-0 -> LOSS
      const bttsLoss = ExactSettlementEngine.settleBtts(2, 0, 1.85, 'YES');
      expect(bttsLoss.outcome).toBe('LOSS');
      expect(bttsLoss.profit).toBeCloseTo(-1.0, 4);
    });
  });

  describe('Archive Settlement & CLV Tracking', () => {
    it('settles archive prediction with verified closing line value (CLV)', async () => {
      const { record } = await PredictionArchiveService.recordPrediction({
        fixtureId: '1557411',
        canonicalMatchId: 'EPL_2026_NEWCASTLE_VILLA_2026-09-19',
        homeTeam: 'Newcastle',
        awayTeam: 'Aston Villa',
        competition: 'Premier League',
        leagueKey: 'epl',
        market: 'AH',
        line: -0.25,
        selection: 'Newcastle -0.25',
        modelProbability: 0.52,
        fairOdds: 1.923,
        marketOdds: 2.10, // Entry odds at T-6h
        bookmaker: 'Pinnacle',
        oddsProvider: 'OddsPapi',
        edge: 0.045,
        expectedValue: 0.092,
        decision: 'VALUE_CANDIDATE',
        confidence: 75,
        strengthLevel: 'HIGH',
        signalColor: 'green',
        predictionTimestamp: '2026-09-19T10:00:00.000Z',
        oddsTimestamp: '2026-09-19T09:55:00.000Z',
        kickoffTimestamp: '2026-09-19T14:00:00.000Z',
        modelVersion: 'dixon-coles-v1.0',
        modelParametersVersion: 'params-epl-2026-v1',
        dataVersion: 'canonical-production-v1',
        featureSnapshotId: 'feat_1557411',
        oddsSnapshotId: 'odds_1557411',
        scoreGridSummary: { homeXG: 1.6, awayXG: 1.2, rho: -0.05 },
        status: 'ACTIVE',
        settlement: null,
      });

      // Settle against result 2-1, Pinnacle closing odds 1.95 (market moved in our favor -> positive CLV)
      const settlementResult = await PredictionArchiveService.settleArchivedPrediction(record.predictionId, {
        settledAt: '2026-09-19T16:00:00.000Z',
        homeGoals: 2,
        awayGoals: 1,
        outcome: 'WIN',
        profitUnits: 1.10, // (2.10 - 1.0) * 1 unit
        closingOdds: 1.95,
        clv: Number(((1.95 / 2.10 - 1) * -100).toFixed(2)), // +7.14% CLV (market steamed)
        resultSource: 'API-Football-Verified',
      });

      expect(settlementResult.settled).toBe(true);
      expect(settlementResult.record!.status).toBe('SETTLED');
      expect(settlementResult.record!.settlement?.outcome).toBe('WIN');
      expect(settlementResult.record!.settlement?.profitUnits).toBe(1.10);
      expect(settlementResult.record!.settlement?.closingOdds).toBe(1.95);
      expect(settlementResult.record!.settlement?.clv).toBeGreaterThan(0);
    });
  });

  describe('Multi-Window Performance Reports', () => {
    it('computes segregated windows: today, yesterday, 7d, 30d, all-time', async () => {
      const nowMs = new Date('2026-09-20T12:00:00.000Z').getTime();

      // Seed 2 settled predictions: 1 today (+1.0U), 1 yesterday (-1.0U)
      const pred1 = await PredictionArchiveService.recordPrediction({
        fixtureId: '1557412',
        canonicalMatchId: 'EPL_2026_MATCH_1',
        homeTeam: 'Brighton',
        awayTeam: 'Wolves',
        competition: 'Premier League',
        leagueKey: 'epl',
        market: 'AH',
        line: -0.5,
        selection: 'Brighton -0.5',
        modelProbability: 0.55,
        fairOdds: 1.818,
        marketOdds: 2.00,
        bookmaker: 'Pinnacle',
        oddsProvider: 'OddsPapi',
        edge: 0.05,
        expectedValue: 0.10,
        decision: 'VALUE_CANDIDATE',
        confidence: 76,
        strengthLevel: 'HIGH',
        signalColor: 'green',
        predictionTimestamp: '2026-09-20T08:00:00.000Z',
        oddsTimestamp: '2026-09-20T07:55:00.000Z',
        kickoffTimestamp: '2026-09-20T10:00:00.000Z',
        modelVersion: 'dixon-coles-v1.0',
        modelParametersVersion: 'params-epl-2026-v1',
        dataVersion: 'canonical-production-v1',
        featureSnapshotId: 'feat_1',
        oddsSnapshotId: 'odds_1',
        scoreGridSummary: { homeXG: 1.5, awayXG: 1.0, rho: -0.05 },
        status: 'ACTIVE',
        settlement: null,
      });

      await PredictionArchiveService.settleArchivedPrediction(pred1.record.predictionId, {
        settledAt: '2026-09-20T11:45:00.000Z',
        homeGoals: 1,
        awayGoals: 0,
        outcome: 'WIN',
        profitUnits: 1.0,
        closingOdds: 1.95,
        clv: 2.5,
        resultSource: 'API-Football',
      });

      const pred2 = await PredictionArchiveService.recordPrediction({
        fixtureId: '1557413',
        canonicalMatchId: 'EPL_2026_MATCH_2',
        homeTeam: 'West Ham',
        awayTeam: 'Fulham',
        competition: 'Premier League',
        leagueKey: 'epl',
        market: 'OU',
        line: 2.5,
        selection: 'Over 2.5',
        modelProbability: 0.53,
        fairOdds: 1.88,
        marketOdds: 2.05,
        bookmaker: 'Pinnacle',
        oddsProvider: 'OddsPapi',
        edge: 0.04,
        expectedValue: 0.086,
        decision: 'VALUE_CANDIDATE',
        confidence: 72,
        strengthLevel: 'HIGH',
        signalColor: 'green',
        predictionTimestamp: '2026-09-19T08:00:00.000Z',
        oddsTimestamp: '2026-09-19T07:55:00.000Z',
        kickoffTimestamp: '2026-09-19T14:00:00.000Z',
        modelVersion: 'dixon-coles-v1.0',
        modelParametersVersion: 'params-epl-2026-v1',
        dataVersion: 'canonical-production-v1',
        featureSnapshotId: 'feat_2',
        oddsSnapshotId: 'odds_2',
        scoreGridSummary: { homeXG: 1.2, awayXG: 1.1, rho: -0.05 },
        status: 'ACTIVE',
        settlement: null,
      });

      await PredictionArchiveService.settleArchivedPrediction(pred2.record.predictionId, {
        settledAt: '2026-09-19T16:00:00.000Z',
        homeGoals: 0,
        awayGoals: 1,
        outcome: 'LOSS',
        profitUnits: -1.0,
        closingOdds: 2.10,
        clv: -2.4,
        resultSource: 'API-Football',
      });

      const report = DailyPerformanceService.getArchivePerformanceReport({ nowMs });

      // Check today's window: 1 bet, 1 win, profit +1.0, yield +100%
      expect(report.windows.today.settledBets).toBe(1);
      expect(report.windows.today.profitUnits).toBeCloseTo(1.0, 2);
      expect(report.windows.today.yieldPct).toBeCloseTo(100.0, 1);

      // Check yesterday's window: 1 bet, 0 win, profit -1.0, yield -100%
      expect(report.windows.yesterday.settledBets).toBe(1);
      expect(report.windows.yesterday.profitUnits).toBeCloseTo(-1.0, 2);
      expect(report.windows.yesterday.yieldPct).toBeCloseTo(-100.0, 1);

      // Check last 7 days & all time: 2 bets, 1 win, profit 0.0, yield 0%
      expect(report.windows.last7Days.settledBets).toBe(2);
      expect(report.windows.last7Days.profitUnits).toBeCloseTo(0.0, 2);
      expect(report.windows.last7Days.yieldPct).toBeCloseTo(0.0, 1);

      expect(report.allTimeProfitUnits).toBeCloseTo(0.0, 2);
      expect(report.allTimeYieldPct).toBeCloseTo(0.0, 1);
    });

    it('strictly enforces Gate 6: rejects settlement occurring before result received timestamp', async () => {
      const pred = await PredictionArchiveService.recordPrediction({
        fixtureId: 'gate6_fix_1',
        canonicalMatchId: 'EPL_2026_ARSENAL_CHELSEA_2026-09-20',
        competition: 'Premier League',
        leagueKey: 'epl',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        market: 'AH',
        line: -0.5,
        selection: 'Arsenal -0.5',
        marketOdds: 2.05,
        fairOdds: 1.724,
        modelProbability: 0.58,
        expectedValue: 0.189,
        edge: 0.10,
        bookmaker: 'Pinnacle',
        oddsProvider: 'OddsPapi',
        decision: 'VALUE_CANDIDATE',
        confidence: 78,
        strengthLevel: 'VERY_STRONG',
        signalColor: 'GREEN',
        predictionTimestamp: '2026-09-20T10:00:00.000Z',
        oddsTimestamp: '2026-09-20T09:50:00.000Z',
        kickoffTimestamp: '2026-09-20T14:00:00.000Z',
        modelVersion: 'dixon-coles-v1.0',
        modelParametersVersion: 'params-epl-2026-v1',
        dataVersion: 'canonical-production-v1',
        featureSnapshotId: 'feat_gate6',
        oddsSnapshotId: 'odds_gate6',
        scoreGridSummary: { homeXG: 1.5, awayXG: 1.0, rho: -0.05 },
        status: 'ACTIVE',
        settlement: null,
      });

      // Attempt to settle with settledAt (15:50) earlier than resultReceivedAt (16:00)
      await expect(
        PredictionArchiveService.settleArchivedPrediction(pred.record.predictionId, {
          settledAt: '2026-09-20T15:50:00.000Z',
          resultReceivedAt: '2026-09-20T16:00:00.000Z',
          homeGoals: 2,
          awayGoals: 1,
          outcome: 'WIN',
          profitUnits: 1.05,
          closingOdds: 2.00,
          clv: 0.025,
          resultSource: 'API-Football',
        })
      ).rejects.toThrow(/Temporal settlement violation: settledAt .* < resultReceivedAt/);
    });
  });
});

