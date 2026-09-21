import { describe, it, expect, beforeEach } from 'vitest';
import { PredictionArchiveService } from '@/lib/archive/predictionArchiveService';
import { ReconciliationService } from '@/lib/archive/reconciliationService';

describe('SALMO Canonical Synchronization & Reconciliation', () => {
  beforeEach(() => {
    PredictionArchiveService.clearStoreForTesting();
  });

  describe('Incremental Sync Feed', () => {
    it('returns newly added or updated predictions using since query filter', async () => {
      const t1 = new Date('2026-09-21T10:00:00.000Z').toISOString();
      const t2 = new Date('2026-09-21T12:00:00.000Z').toISOString();

      const pred1 = await PredictionArchiveService.recordPrediction({
        fixtureId: '1001',
        canonicalMatchId: 'MATCH_1001',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        competition: 'Premier League',
        leagueKey: 'epl',
        market: 'AH',
        line: -0.5,
        selection: 'Arsenal -0.5',
        modelProbability: 0.52,
        fairOdds: 1.92,
        marketOdds: 2.05,
        bookmaker: 'Pinnacle',
        oddsProvider: 'OddsPapi',
        edge: 0.045,
        expectedValue: 0.09,
        decision: 'VALUE_CANDIDATE',
        confidence: 78,
        strengthLevel: 'HIGH',
        signalColor: 'green',
        predictionTimestamp: t1,
        oddsTimestamp: t1,
        kickoffTimestamp: '2026-09-22T19:00:00.000Z',
        modelVersion: 'dixon-coles-v1.0',
        modelParametersVersion: 'params-v1',
        dataVersion: 'canonical-v1',
        featureSnapshotId: 'f1001',
        oddsSnapshotId: 'o1001',
        scoreGridSummary: { homeXG: 1.6, awayXG: 1.1, rho: -0.05 },
        status: 'ACTIVE',
        settlement: null,
      });

      // Initial sync (no since filter) -> receives pred1
      const initialSync = PredictionArchiveService.getIncrementalUpdates();
      expect(initialSync.length).toBe(1);
      expect(initialSync[0].predictionId).toBe(pred1.record.predictionId);

      // Now add pred2 at t2
      const pred2 = await PredictionArchiveService.recordPrediction({
        fixtureId: '1002',
        canonicalMatchId: 'MATCH_1002',
        homeTeam: 'Liverpool',
        awayTeam: 'Man City',
        competition: 'Premier League',
        leagueKey: 'epl',
        market: 'OU',
        line: 2.5,
        selection: 'Over 2.5',
        modelProbability: 0.60,
        fairOdds: 1.66,
        marketOdds: 1.85,
        bookmaker: 'Pinnacle',
        oddsProvider: 'OddsPapi',
        edge: 0.055,
        expectedValue: 0.11,
        decision: 'VALUE_CANDIDATE',
        confidence: 82,
        strengthLevel: 'VERY_HIGH',
        signalColor: 'green',
        predictionTimestamp: t2,
        oddsTimestamp: t2,
        kickoffTimestamp: '2026-09-23T15:00:00.000Z',
        modelVersion: 'dixon-coles-v1.0',
        modelParametersVersion: 'params-v1',
        dataVersion: 'canonical-v1',
        featureSnapshotId: 'f1002',
        oddsSnapshotId: 'o1002',
        scoreGridSummary: { homeXG: 1.9, awayXG: 1.5, rho: -0.05 },
        status: 'ACTIVE',
        settlement: null,
      });

      // Incremental sync using pred1's updatedAt -> receives ONLY pred2
      const incrementalSync = PredictionArchiveService.getIncrementalUpdates(pred1.record.updatedAt);
      expect(incrementalSync.length).toBe(1);
      expect(incrementalSync[0].predictionId).toBe(pred2.record.predictionId);
    });
  });

  describe('Automatic Calendar Rollover for Daily Picks', () => {
    it('automatically transitions Tomorrow picks to Today picks when calendar date advances', async () => {
      const baseMs = new Date('2026-09-21T10:00:00.000Z').getTime();
      const matchKickoff = new Date('2026-09-22T15:00:00.000Z').toISOString(); // Tomorrow relative to baseMs

      await PredictionArchiveService.recordPrediction({
        fixtureId: 'rollover_1',
        canonicalMatchId: 'MATCH_ROLLOVER',
        homeTeam: 'Everton',
        awayTeam: 'Fulham',
        competition: 'Premier League',
        leagueKey: 'epl',
        market: 'BTTS',
        line: 0,
        selection: 'BTTS YES',
        modelProbability: 0.58,
        fairOdds: 1.72,
        marketOdds: 1.95,
        bookmaker: 'Pinnacle',
        oddsProvider: 'OddsPapi',
        edge: 0.06,
        expectedValue: 0.13,
        decision: 'VALUE_CANDIDATE',
        confidence: 76,
        strengthLevel: 'HIGH',
        signalColor: 'green',
        predictionTimestamp: new Date(baseMs).toISOString(),
        oddsTimestamp: new Date(baseMs).toISOString(),
        kickoffTimestamp: matchKickoff,
        modelVersion: 'BTTS-jointscore-v1.0.0',
        modelParametersVersion: 'params-btts-v1',
        dataVersion: 'canonical-v1',
        featureSnapshotId: 'f_roll',
        oddsSnapshotId: 'o_roll',
        scoreGridSummary: { homeXG: 1.3, awayXG: 1.2, rho: -0.05 },
        status: 'ACTIVE',
        settlement: null,
      });

      // Day 1 (baseMs): Match is classified as TOMORROW
      const day1Picks = PredictionArchiveService.getDailyPicksProjection({ nowMs: baseMs });
      expect(day1Picks.length).toBe(1);
      expect(day1Picks[0].horizonBucket).toBe('TOMORROW');

      // Day 2 (baseMs + 24 hours): Match automatically rolls to TODAY with zero manual updates!
      const nextDayMs = baseMs + 24 * 60 * 60 * 1000;
      const day2Picks = PredictionArchiveService.getDailyPicksProjection({ nowMs: nextDayMs });
      expect(day2Picks.length).toBe(1);
      expect(day2Picks[0].horizonBucket).toBe('TODAY');
    });
  });

  describe('Cross-System Reconciliation', () => {
    it('detects missing records and settlement discrepancies between HandicapLab and SALMO', async () => {
      const pred = await PredictionArchiveService.recordPrediction({
        fixtureId: 'reconcile_1',
        canonicalMatchId: 'MATCH_RECONCILE',
        homeTeam: 'Aston Villa',
        awayTeam: 'Wolves',
        competition: 'Premier League',
        leagueKey: 'epl',
        market: 'AH',
        line: -0.25,
        selection: 'Aston Villa -0.25',
        modelProbability: 0.54,
        fairOdds: 1.85,
        marketOdds: 2.05,
        bookmaker: 'Pinnacle',
        oddsProvider: 'OddsPapi',
        edge: 0.05,
        expectedValue: 0.10,
        decision: 'VALUE_CANDIDATE',
        confidence: 79,
        strengthLevel: 'HIGH',
        signalColor: 'green',
        predictionTimestamp: '2026-09-21T10:00:00.000Z',
        oddsTimestamp: '2026-09-21T09:55:00.000Z',
        kickoffTimestamp: '2026-09-21T19:00:00.000Z',
        modelVersion: 'dixon-coles-v1.0',
        modelParametersVersion: 'params-v1',
        dataVersion: 'canonical-v1',
        featureSnapshotId: 'f_rec',
        oddsSnapshotId: 'o_rec',
        scoreGridSummary: { homeXG: 1.7, awayXG: 1.0, rho: -0.05 },
        status: 'ACTIVE',
        settlement: null,
      });

      // Settle in HandicapLab
      await PredictionArchiveService.settleArchivedPrediction(pred.record.predictionId, {
        settledAt: '2026-09-21T21:00:00.000Z',
        homeGoals: 2,
        awayGoals: 0,
        outcome: 'WIN',
        profitUnits: 1.05,
        closingOdds: 1.95,
        clv: 5.12,
        resultSource: 'API-Football',
      });

      // Scenario 1: SALMO consumer is completely missing the record
      const reportMissing = ReconciliationService.reconcileWithConsumer([]);
      expect(reportMissing.isConsistent).toBe(false);
      expect(reportMissing.discrepancies.some((d) => d.type === 'MISSING_IN_SALMO')).toBe(true);

      // Scenario 2: SALMO has the record but still marked as ACTIVE (settlement lag)
      const reportSettlementMismatch = ReconciliationService.reconcileWithConsumer([
        {
          predictionId: pred.record.predictionId,
          fixtureId: pred.record.fixtureId,
          status: 'ACTIVE', // Not yet settled in SALMO
          marketOdds: 2.05,
          updatedAt: '2026-09-21T10:00:00.000Z',
        },
      ]);
      expect(reportSettlementMismatch.isConsistent).toBe(false);
      expect(reportSettlementMismatch.discrepancies.some((d) => d.type === 'SETTLEMENT_MISMATCH')).toBe(true);

      // Scenario 3: SALMO consumer is synchronized with correct settlement -> 100% consistent
      const reportConsistent = ReconciliationService.reconcileWithConsumer([
        {
          predictionId: pred.record.predictionId,
          fixtureId: pred.record.fixtureId,
          status: 'SETTLED',
          settlementOutcome: 'WIN',
          marketOdds: 2.05,
          updatedAt: '2026-09-21T21:05:00.000Z',
        },
      ]);
      expect(reportConsistent.isConsistent).toBe(true);
      expect(reportConsistent.discrepancies.length).toBe(0);
    });
  });
});

