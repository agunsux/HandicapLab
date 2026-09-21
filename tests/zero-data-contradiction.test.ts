import { describe, it, expect, beforeEach } from 'vitest';
import { PredictionArchiveService } from '@/lib/archive/predictionArchiveService';
import { DailyPerformanceService } from '@/lib/ledger/dailyPerformanceService';

describe('Zero-Data Contradiction Guards & Fail-Closed Integrity', () => {
  beforeEach(() => {
    PredictionArchiveService.clearStoreForTesting();
  });

  it('fails with ZERO_PREDICTIONS_PUBLIC_PICKS if daily picks exist when archive is empty', () => {
    const archive = PredictionArchiveService.loadArchive();
    const records = Object.values(archive);
    const dailyPicks = PredictionArchiveService.getDailyPicksProjection();

    expect(records.length).toBe(0);
    expect(dailyPicks.length).toBe(0); // must fail-closed to zero picks
  });

  it('fails with ZERO_SETTLED_POSITIVE_YIELD if positive yield is claimed with 0 settled bets', () => {
    const report = DailyPerformanceService.getArchivePerformanceReport();
    expect(report.totalSettled).toBe(0);
    expect(report.allTimeProfitUnits).toBe(0);
    expect(report.allTimeYieldPct).toBe(0);

    // Contradiction detection assertion:
    const hasContradiction = report.totalSettled === 0 && report.allTimeYieldPct > 0;
    expect(hasContradiction).toBe(false);
  });

  it('fails with ZERO_FIXTURES_ACTIVE_SIGNALS if 0 upcoming fixtures exist but daily picks are generated', async () => {
    const nowMs = Date.now();

    // Create a past match only
    await PredictionArchiveService.recordPrediction({
      fixtureId: 'past_1001',
      canonicalMatchId: 'EPL_PAST_MATCH',
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      competition: 'Premier League',
      leagueKey: 'epl',
      market: 'AH',
      line: -0.25,
      selection: 'Team A -0.25',
      modelProbability: 0.52,
      fairOdds: 1.92,
      marketOdds: 2.10,
      bookmaker: 'Pinnacle',
      oddsProvider: 'OddsPapi',
      edge: 0.05,
      expectedValue: 0.10,
      decision: 'VALUE_CANDIDATE',
      confidence: 75,
      strengthLevel: 'HIGH',
      signalColor: 'green',
      predictionTimestamp: new Date(nowMs - 48 * 3600 * 1000).toISOString(),
      oddsTimestamp: new Date(nowMs - 48 * 3600 * 1000).toISOString(),
      kickoffTimestamp: new Date(nowMs - 24 * 3600 * 1000).toISOString(), // 24 hours in past
      modelVersion: 'dixon-coles-v1.0',
      modelParametersVersion: 'params-v1',
      dataVersion: 'canonical-v1',
      featureSnapshotId: 'f1',
      oddsSnapshotId: 'o1',
      scoreGridSummary: { homeXG: 1.5, awayXG: 1.0, rho: -0.05 },
      status: 'ACTIVE',
      settlement: null,
    });

    const archive = PredictionArchiveService.loadArchive();
    const upcomingRecords = Object.values(archive).filter(
      (r) => new Date(r.kickoffTimestamp).getTime() > nowMs
    );
    const dailyPicks = PredictionArchiveService.getDailyPicksProjection({ nowMs });

    expect(upcomingRecords.length).toBe(0);
    expect(dailyPicks.length).toBe(0); // Fail-closed: cannot emit daily picks for past matches

    const hasContradiction = upcomingRecords.length === 0 && dailyPicks.length > 0;
    expect(hasContradiction).toBe(false);
  });

  it('fails with ZERO_CLOSING_ODDS_VERIFIED_CLV if CLV is reported without Pinnacle closing odds snapshots', async () => {
    const { record } = await PredictionArchiveService.recordPrediction({
      fixtureId: 'clv_test_1',
      canonicalMatchId: 'EPL_CLV_MATCH',
      homeTeam: 'Team C',
      awayTeam: 'Team D',
      competition: 'Premier League',
      leagueKey: 'epl',
      market: 'OU',
      line: 2.5,
      selection: 'Over 2.5',
      modelProbability: 0.55,
      fairOdds: 1.82,
      marketOdds: 2.00,
      bookmaker: 'Pinnacle',
      oddsProvider: 'OddsPapi',
      edge: 0.05,
      expectedValue: 0.10,
      decision: 'VALUE_CANDIDATE',
      confidence: 80,
      strengthLevel: 'HIGH',
      signalColor: 'green',
      predictionTimestamp: '2026-09-18T10:00:00.000Z',
      oddsTimestamp: '2026-09-18T09:55:00.000Z',
      kickoffTimestamp: '2026-09-18T15:00:00.000Z',
      modelVersion: 'dixon-coles-v1.0',
      modelParametersVersion: 'params-v1',
      dataVersion: 'canonical-v1',
      featureSnapshotId: 'f2',
      oddsSnapshotId: 'o2',
      scoreGridSummary: { homeXG: 1.8, awayXG: 1.2, rho: -0.05 },
      status: 'ACTIVE',
      settlement: null,
    });

    // Valid settlement has closing odds recorded
    await PredictionArchiveService.settleArchivedPrediction(record.predictionId, {
      settledAt: '2026-09-18T17:00:00.000Z',
      homeGoals: 2,
      awayGoals: 1,
      outcome: 'WIN',
      profitUnits: 1.0,
      closingOdds: 1.90, // Valid closing odds snapshot
      clv: 5.26,
      resultSource: 'API-Football',
    });

    const archive = PredictionArchiveService.loadArchive();
    const settled = Object.values(archive).filter((r) => r.status === 'SETTLED');
    const clvRecords = settled.filter((r) => r.settlement?.clv !== undefined && r.settlement.clv !== 0);

    const hasContradiction = clvRecords.length > 0 && settled.every((r) => !r.settlement?.closingOdds);
    expect(hasContradiction).toBe(false);
  });
});
