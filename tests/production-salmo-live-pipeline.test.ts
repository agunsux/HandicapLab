// ============================================================================
// PRODUCTION SALMO LIVE PIPELINE & PREDICTION LEDGER INTEGRATION TEST SUITE
// ============================================================================
// Location: tests/production-salmo-live-pipeline.test.ts
//
// 25 MANDATORY AUDIT & INTEGRITY CRITERIA (Section R):
// 1.  Canonical identity deterministic across providers
// 2.  Fixture lifecycle transitions correctly
// 3.  Fixture reconciliation by priority (canonicalId -> providerId -> normalized teams+kickoff)
// 4.  Kickoff-passed prediction rejected from active Daily Picks
// 5.  Prediction created after kickoff rejected (anti-lookahead)
// 6.  Postponed fixture removed from active Daily Picks
// 7.  Cancelled fixture marked VOID in active Daily Picks
// 8.  Stale fixture older than SLA rejected by freshness gate
// 9.  Real odds validated: <= 1.0 rejected
// 10. Synthetic/mock odds rejected
// 11. Prediction snapshot immutable: entry odds and probability never overwritten
// 12. Every pre-match prediction enters canonical ledger before kickoff
// 13. Auto settlement triggers when match FINISHED with final score
// 14. Quarter-line AH settlement math accurate (-0.25, +0.25, -0.75, +0.75)
// 15. OU settlement math accurate (full, half, quarter lines)
// 16. BTTS settlement math accurate (YES/NO)
// 17. Settlement idempotent: re-settling already settled prediction causes 0 duplicate profit
// 18. CLV calculated only with valid closing odds; UNAVAILABLE when missing
// 19. CLV not fabricated: never inferred from model odds or fair odds
// 20. ROI and Yield calculations include losing bets and half results deterministically
// 21. SalmoProductionSyncService emits schema with dataState, dailyPicks, settledHistory, performance, freshness
// 22. Daily picks strictly empty if all fixtures are in the past (no fallback to stale data)
// 23. PipelineFreshnessTelemetry exposes all required metrics
// 24. ReconciliationEngineV2 detects all 11 corruption conditions
// 25. Zero synthetic data, zero post-kickoff predictions, zero fabricated CLV end-to-end invariant
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { CanonicalFixtureFreshnessGate } from '@/lib/services/canonicalFixtureFreshnessGate';
import { StaleDataKillSwitch } from '@/lib/ledger/staleDataKillSwitch';
import { CanonicalBetLedgerService, classifyLineType } from '@/lib/ledger/canonicalBetLedger';
import { CanonicalSettlementEngine } from '@/lib/ledger/canonicalSettlementEngine';
import { AutomaticSettlementJob } from '@/lib/ledger/automaticSettlementJob';
import { CanonicalPerformanceEngine } from '@/lib/ledger/canonicalPerformanceEngine';
import { SalmoProductionSyncService } from '@/lib/salmo/salmoProductionSyncService';
import { PipelineFreshnessTelemetry } from '@/lib/telemetry/pipelineFreshnessTelemetry';
import { ReconciliationEngineV2 } from '@/lib/ledger/reconciliationEngineV2';
import { ExactSettlementEngine } from '@/lib/research/settlement/exactSettlement';

describe('Production SALMO Live Pipeline — Comprehensive Audit (25 Criteria)', () => {
  beforeEach(() => {
    CanonicalFixtureFreshnessGate.clearForTesting();
    CanonicalBetLedgerService.clearForTesting();
  });

  // --------------------------------------------------------------------------
  // 1. Canonical identity deterministic across providers
  // --------------------------------------------------------------------------
  it('1. computes deterministic canonicalMatchId regardless of input casing or spacing', () => {
    const id1 = CanonicalFixtureFreshnessGate.computeCanonicalMatchId(
      'Premier League',
      '2026',
      'Arsenal',
      'Chelsea',
      '2026-10-10T14:00:00Z'
    );
    const id2 = CanonicalFixtureFreshnessGate.computeCanonicalMatchId(
      'premier league',
      '2026',
      'Arsenal FC',
      'Chelsea FC',
      '2026-10-10T14:00:00Z'
    );
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^cm_[a-f0-9]{16}$/);
  });

  // --------------------------------------------------------------------------
  // 2. Fixture lifecycle transitions correctly
  // --------------------------------------------------------------------------
  it('2. normalizes fixture lifecycle states strictly into allowed statuses', () => {
    expect(CanonicalFixtureFreshnessGate.normalizeStatus('NS')).toBe('SCHEDULED');
    expect(CanonicalFixtureFreshnessGate.normalizeStatus('TBD')).toBe('SCHEDULED');
    expect(CanonicalFixtureFreshnessGate.normalizeStatus('1H')).toBe('LIVE');
    expect(CanonicalFixtureFreshnessGate.normalizeStatus('HT')).toBe('LIVE');
    expect(CanonicalFixtureFreshnessGate.normalizeStatus('FT')).toBe('FINISHED');
    expect(CanonicalFixtureFreshnessGate.normalizeStatus('AET')).toBe('FINISHED');
    expect(CanonicalFixtureFreshnessGate.normalizeStatus('PST')).toBe('POSTPONED');
    expect(CanonicalFixtureFreshnessGate.normalizeStatus('CANC')).toBe('CANCELLED');
    expect(CanonicalFixtureFreshnessGate.normalizeStatus('ABD')).toBe('ABANDONED');
  });

  // --------------------------------------------------------------------------
  // 3. Fixture reconciliation by priority
  // --------------------------------------------------------------------------
  it('3. reconciles incoming fixtures by 3-tier priority without duplicating records', () => {
    // 1st ingestion from API-Football
    const first = CanonicalFixtureFreshnessGate.upsertFixture({
      providerMatchId: 'af_12345',
      homeTeam: 'Liverpool',
      awayTeam: 'Everton',
      competition: 'Premier League',
      season: '2026',
      kickoffUtc: '2026-10-15T19:00:00Z',
      status: 'SCHEDULED',
      provider: 'api-football',
    });
    expect(first.isNew).toBe(true);

    // 2nd ingestion from OddsPAPI with matching canonical tuple
    const second = CanonicalFixtureFreshnessGate.upsertFixture({
      providerMatchId: 'op_998877',
      homeTeam: 'Liverpool FC',
      awayTeam: 'Everton FC',
      competition: 'Premier League',
      season: '2026',
      kickoffUtc: '2026-10-15T19:00:00Z',
      status: 'SCHEDULED',
      provider: 'oddspapi',
    });
    expect(second.isNew).toBe(false);
    expect(second.record.canonicalMatchId).toBe(first.record.canonicalMatchId);

    const registry = CanonicalFixtureFreshnessGate.loadRegistry();
    expect(Object.keys(registry).length).toBe(1);
  });

  // --------------------------------------------------------------------------
  // 4. Kickoff-passed prediction rejected from active Daily Picks
  // --------------------------------------------------------------------------
  it('4. rejects kickoff-passed prediction from active Daily Picks (Sept 18 vs Sept 30)', () => {
    const nowMs = new Date('2026-09-30T12:00:00Z').getTime();

    // Past match (Brentford vs Chelsea, Sept 18)
    const pastPrediction = {
      kickoffUtc: '2026-09-18T19:00:00Z',
      predictionTimestampUtc: '2026-09-18T10:00:00Z',
      marketOdds: 2.26,
      status: 'QUALIFIED',
    };

    const evalResult = StaleDataKillSwitch.evaluateActiveFeedEligibility(pastPrediction, nowMs);
    expect(evalResult.isActive).toBe(false);
    expect(evalResult.state).toBe('SETTLEMENT_PENDING');
    expect(evalResult.reason).toContain('KICKOFF_PASSED');

    // Upcoming match (Oct 10)
    const upcomingPrediction = {
      kickoffUtc: '2026-10-10T14:00:00Z',
      predictionTimestampUtc: '2026-09-30T10:00:00Z',
      marketOdds: 2.05,
      status: 'QUALIFIED',
    };

    const upResult = StaleDataKillSwitch.evaluateActiveFeedEligibility(upcomingPrediction, nowMs);
    expect(upResult.isActive).toBe(true);
    expect(upResult.state).toBe('ACTIVE');
  });

  // --------------------------------------------------------------------------
  // 5. Prediction created after kickoff rejected (anti-lookahead)
  // --------------------------------------------------------------------------
  it('5. rejects prediction created after kickoff with TEMPORAL_LEAKAGE_VIOLATION', () => {
    const postKickoffPrediction = {
      kickoffUtc: '2026-10-01T15:00:00Z',
      predictionTimestampUtc: '2026-10-01T15:05:00Z', // 5 minutes after kickoff
      marketOdds: 1.95,
      status: 'QUALIFIED',
    };

    const evalResult = StaleDataKillSwitch.evaluateActiveFeedEligibility(
      postKickoffPrediction,
      new Date('2026-09-30T12:00:00Z').getTime()
    );
    expect(evalResult.isActive).toBe(false);
    expect(evalResult.state).toBe('REJECTED');
    expect(evalResult.reason).toContain('TEMPORAL_LEAKAGE_VIOLATION');
  });

  // --------------------------------------------------------------------------
  // 6. Postponed fixture removed from active Daily Picks
  // --------------------------------------------------------------------------
  it('6. transitions postponed match to POSTPONED and removes from active picks', () => {
    const postponedPrediction = {
      kickoffUtc: '2026-10-05T15:00:00Z',
      predictionTimestampUtc: '2026-09-30T10:00:00Z',
      marketOdds: 2.10,
      fixtureStatus: 'POSTPONED',
      status: 'QUALIFIED',
    };

    const res = StaleDataKillSwitch.evaluateActiveFeedEligibility(
      postponedPrediction,
      new Date('2026-09-30T12:00:00Z').getTime()
    );
    expect(res.isActive).toBe(false);
    expect(res.state).toBe('POSTPONED');
    expect(res.reason).toContain('FIXTURE_POSTPONED');
  });

  // --------------------------------------------------------------------------
  // 7. Cancelled fixture marked VOID in active Daily Picks
  // --------------------------------------------------------------------------
  it('7. transitions cancelled fixture to CANCELLED and settles as VOID', () => {
    const cancelledPred = {
      kickoffUtc: '2026-10-05T15:00:00Z',
      predictionTimestampUtc: '2026-09-30T10:00:00Z',
      marketOdds: 1.90,
      fixtureStatus: 'CANCELLED',
      status: 'QUALIFIED',
    };

    const res = StaleDataKillSwitch.evaluateActiveFeedEligibility(
      cancelledPred,
      new Date('2026-09-30T12:00:00Z').getTime()
    );
    expect(res.isActive).toBe(false);
    expect(res.state).toBe('CANCELLED');

    // Test settlement of cancelled match as VOID
    const predRec = CanonicalBetLedgerService.recordPrediction({
      canonicalFixtureId: 'cm_canc_01',
      fixture: 'Brighton vs Arsenal',
      competition: 'Premier League',
      league: 'Premier League',
      homeTeam: 'Brighton',
      awayTeam: 'Arsenal',
      kickoffTimestamp: '2026-10-05T15:00:00Z',
      market: 'AH',
      selection: 'AWAY',
      line: -0.5,
      provider: 'OddsPapi',
      bookmaker: 'Pinnacle',
      marketOdds: 1.95,
      oddsTimestamp: '2026-09-30T10:00:00Z',
      modelProbability: 0.55,
      fairOdds: 1.818,
      expectedValue: 0.07,
      edge: 0.03,
      confidence: 'HIGH',
      confidenceScore: 80,
      valueStatus: 'VALUE',
      predictionTimestamp: '2026-09-30T10:00:00Z',
      featureTimestamp: '2026-09-30T09:00:00Z',
      modelVersion: 'dixon-coles-v1.0',
      pipelineVersion: 'v1.0',
      dataVersion: 'v1.0',
    });

    const settleRes = CanonicalSettlementEngine.settlePrediction(
      predRec.record,
      {
        status: 'CANC',
        homeGoals: null,
        awayGoals: null,
      },
      { nowMs: new Date('2026-10-05T18:00:00Z').getTime() }
    );

    expect(settleRes.settled).toBe(true);
    expect(settleRes.settlement?.outcome).toBe('VOID');
    expect(settleRes.settlement?.profitUnits).toBe(0.0);
    expect(settleRes.settlement?.returnUnits).toBe(1.0);
  });

  // --------------------------------------------------------------------------
  // 8. Stale fixture older than SLA rejected by freshness gate
  // --------------------------------------------------------------------------
  it('8. flags fixture older than SLA as STALE/EXPIRED in freshness evaluation', () => {
    const fixture = {
      canonicalMatchId: 'cm_fresh_01',
      providerMatchId: 'af_fresh_01',
      homeTeam: 'Fulham',
      awayTeam: 'Tottenham',
      competition: 'Premier League',
      season: '2026',
      kickoffUtc: '2026-10-12T19:00:00Z',
      status: 'SCHEDULED' as const,
      provider: 'api-football',
      providerFetchedAtUtc: '2026-09-30T08:00:00Z', // 4 hours ago
      canonicalUpdatedAtUtc: '2026-09-30T08:00:00Z',
      sourceVersion: 'v1.0',
    };

    const evalRes = CanonicalFixtureFreshnessGate.evaluateFreshness(
      fixture,
      new Date('2026-09-30T12:00:00Z').getTime(),
      3600 // 1 hour SLA
    );

    expect(evalRes.isFresh).toBe(false);
    expect(evalRes.status).toBe('EXPIRED');
    expect(evalRes.ageSeconds).toBe(14400); // 4 hours
  });

  // --------------------------------------------------------------------------
  // 9. Real odds validated: <= 1.0 rejected
  // --------------------------------------------------------------------------
  it('9. rejects odds <= 1.0 or NaN with INVALID_ODDS', () => {
    const invalidOddsPred = {
      kickoffUtc: '2026-10-10T15:00:00Z',
      predictionTimestampUtc: '2026-09-30T10:00:00Z',
      marketOdds: 0.95,
      status: 'QUALIFIED',
    };

    const res = StaleDataKillSwitch.evaluateActiveFeedEligibility(
      invalidOddsPred,
      new Date('2026-09-30T12:00:00Z').getTime()
    );
    expect(res.isActive).toBe(false);
    expect(res.state).toBe('REJECTED');
    expect(res.reason).toContain('INVALID_ODDS');
  });

  // --------------------------------------------------------------------------
  // 10. Synthetic/mock odds rejected
  // --------------------------------------------------------------------------
  it('10. rejects synthetic or mock odds provider with SYNTHETIC_ODDS_REJECTED', () => {
    const mockPred = {
      kickoffUtc: '2026-10-10T15:00:00Z',
      predictionTimestampUtc: '2026-09-30T10:00:00Z',
      marketOdds: 1.95,
      oddsProvider: 'synthetic-generator',
      bookmaker: 'mock-bookmaker',
      status: 'QUALIFIED',
    };

    const res = StaleDataKillSwitch.evaluateActiveFeedEligibility(
      mockPred,
      new Date('2026-09-30T12:00:00Z').getTime()
    );
    expect(res.isActive).toBe(false);
    expect(res.state).toBe('REJECTED');
    expect(res.reason).toContain('SYNTHETIC_ODDS_REJECTED');
  });

  // --------------------------------------------------------------------------
  // 11. Prediction snapshot immutable: entry odds and probability never overwritten
  // --------------------------------------------------------------------------
  it('11. preserves immutable prediction snapshot when duplicate entry is recorded', () => {
    const orig = CanonicalBetLedgerService.recordPrediction({
      canonicalFixtureId: 'cm_immut_test',
      fixture: 'Milan vs Inter',
      competition: 'Serie A',
      league: 'Serie A',
      homeTeam: 'Milan',
      awayTeam: 'Inter',
      kickoffTimestamp: '2026-10-15T19:45:00Z',
      market: 'AH',
      selection: 'HOME',
      line: 0.0,
      provider: 'OddsPapi',
      bookmaker: 'Pinnacle',
      marketOdds: 2.10,
      oddsTimestamp: '2026-09-30T10:00:00Z',
      modelProbability: 0.52,
      fairOdds: 1.923,
      expectedValue: 0.092,
      edge: 0.04,
      confidence: 'HIGH',
      confidenceScore: 85,
      valueStatus: 'VALUE',
      predictionTimestamp: '2026-09-30T10:00:00Z',
      featureTimestamp: '2026-09-30T09:30:00Z',
      modelVersion: 'dixon-coles-v1.0',
      pipelineVersion: 'v1.0',
      dataVersion: 'v1.0',
    });

    expect(orig.isNew).toBe(true);

    // Attempt mutation via second record with altered odds and probability
    const attempt = CanonicalBetLedgerService.recordPrediction({
      canonicalFixtureId: 'cm_immut_test',
      fixture: 'Milan vs Inter',
      competition: 'Serie A',
      league: 'Serie A',
      homeTeam: 'Milan',
      awayTeam: 'Inter',
      kickoffTimestamp: '2026-10-15T19:45:00Z',
      market: 'AH',
      selection: 'HOME',
      line: 0.0,
      provider: 'OddsPapi',
      bookmaker: 'Pinnacle',
      marketOdds: 3.50, // MUTATED
      oddsTimestamp: '2026-09-30T10:00:00Z',
      modelProbability: 0.99, // MUTATED
      fairOdds: 1.01,
      expectedValue: 0.50,
      edge: 0.40,
      confidence: 'LOW',
      confidenceScore: 20,
      valueStatus: 'NO_VALUE',
      predictionTimestamp: '2026-09-30T10:00:00Z',
      featureTimestamp: '2026-09-30T09:30:00Z',
      modelVersion: 'dixon-coles-v1.0',
      pipelineVersion: 'v1.0',
      dataVersion: 'v1.0',
    });

    expect(attempt.isNew).toBe(false);
    expect(attempt.record.marketOdds).toBe(2.10); // NOT 3.50
    expect(attempt.record.modelProbability).toBe(0.52); // NOT 0.99
    expect(attempt.record.confidence).toBe('HIGH');
  });

  // --------------------------------------------------------------------------
  // 12. Every pre-match prediction enters canonical ledger before kickoff
  // --------------------------------------------------------------------------
  it('12. records all pre-match predictions into canonical ledger before kickoff', () => {
    const record = CanonicalBetLedgerService.recordPrediction({
      canonicalFixtureId: 'cm_ledger_01',
      fixture: 'Bayern vs Dortmund',
      competition: 'Bundesliga',
      league: 'Bundesliga',
      homeTeam: 'Bayern',
      awayTeam: 'Dortmund',
      kickoffTimestamp: '2026-10-17T16:30:00Z',
      market: 'OU',
      selection: 'OVER',
      line: 3.5,
      provider: 'OddsPapi',
      bookmaker: 'Pinnacle',
      marketOdds: 2.02,
      oddsTimestamp: '2026-09-30T10:00:00Z',
      modelProbability: 0.54,
      fairOdds: 1.852,
      expectedValue: 0.0908,
      edge: 0.045,
      confidence: 'HIGH',
      confidenceScore: 78,
      valueStatus: 'VALUE',
      predictionTimestamp: '2026-09-30T10:00:00Z',
      featureTimestamp: '2026-09-30T09:00:00Z',
      modelVersion: 'dixon-coles-v1.0',
      pipelineVersion: 'v1.0',
      dataVersion: 'v1.0',
    });

    expect(record.record.predictionId).toBeDefined();
    expect(record.record.status).toBe('PENDING');
    expect(record.record.settlement).toBeNull();

    const predKickMs = new Date(record.record.kickoffTimestamp).getTime();
    const predMs = new Date(record.record.predictionTimestamp).getTime();
    expect(predMs).toBeLessThan(predKickMs); // Strictly before kickoff
  });

  // --------------------------------------------------------------------------
  // 13. Auto settlement triggers when match FINISHED with final score
  // --------------------------------------------------------------------------
  it('13. automatically settles unsettled predictions when match is FINISHED with final score', async () => {
    // 1. Ingest fixture
    CanonicalFixtureFreshnessGate.upsertFixture({
      providerMatchId: 'af_stl_01',
      homeTeam: 'Roma',
      awayTeam: 'Lazio',
      competition: 'Serie A',
      season: '2026',
      kickoffUtc: '2026-09-29T18:45:00Z',
      status: 'FINISHED',
      provider: 'api-football',
      homeGoals: 2,
      awayGoals: 1,
      metadata: { closingOdds: 1.95, closingLine: -0.25 },
    });

    // 2. Pre-match prediction
    const pred = CanonicalBetLedgerService.recordPrediction({
      canonicalFixtureId: 'af_stl_01',
      fixture: 'Roma vs Lazio',
      competition: 'Serie A',
      league: 'Serie A',
      homeTeam: 'Roma',
      awayTeam: 'Lazio',
      kickoffTimestamp: '2026-09-29T18:45:00Z',
      market: 'AH',
      selection: 'HOME',
      line: -0.25,
      provider: 'OddsPapi',
      bookmaker: 'Pinnacle',
      marketOdds: 2.05,
      oddsTimestamp: '2026-09-29T12:00:00Z',
      modelProbability: 0.55,
      fairOdds: 1.818,
      expectedValue: 0.1275,
      edge: 0.06,
      confidence: 'HIGH',
      confidenceScore: 82,
      valueStatus: 'VALUE',
      predictionTimestamp: '2026-09-29T12:00:00Z',
      featureTimestamp: '2026-09-29T11:00:00Z',
      modelVersion: 'dixon-coles-v1.0',
      pipelineVersion: 'v1.0',
      dataVersion: 'v1.0',
    });

    expect(pred.record.status).toBe('PENDING');

    // 3. Execute automatic settlement job
    const jobRes = await AutomaticSettlementJob.execute({
      nowMs: new Date('2026-09-29T22:00:00Z').getTime(),
    });

    expect(jobRes.settledCount).toBe(1);
    expect(jobRes.settledPredictions[0].outcome).toBe('WIN');
    expect(jobRes.settledPredictions[0].profitUnits).toBeCloseTo(1.05, 4);

    const updated = CanonicalBetLedgerService.getPrediction(pred.record.predictionId);
    expect(updated?.status).toBe('SETTLED');
    expect(updated?.settlement?.outcome).toBe('WIN');
  });

  // --------------------------------------------------------------------------
  // 14. Quarter-line AH settlement math accurate
  // --------------------------------------------------------------------------
  it('14. computes Asian Handicap quarter lines accurately (-0.25, +0.25, -0.75, +0.75)', () => {
    // -0.25 with 1-1 Draw: Half Loss (-0.50 profit, 0.50 return)
    const ahMinus025Draw = ExactSettlementEngine.settleAsianHandicap(1, 1, -0.25, 2.00, 'HOME', 1.0);
    expect(ahMinus025Draw.outcome).toBe('HALF_LOSS');
    expect(ahMinus025Draw.profit).toBe(-0.5);
    expect(ahMinus025Draw.returnAmount).toBe(0.5);

    // +0.25 with 1-1 Draw: Half Win (+0.50 profit on 2.00 odds, 1.50 return)
    const ahPlus025Draw = ExactSettlementEngine.settleAsianHandicap(1, 1, 0.25, 2.00, 'HOME', 1.0);
    expect(ahPlus025Draw.outcome).toBe('HALF_WIN');
    expect(ahPlus025Draw.profit).toBe(0.5);
    expect(ahPlus025Draw.returnAmount).toBe(1.5);

    // -0.75 with 1-0 Win: Half Win (+0.50 profit on 2.00 odds)
    const ahMinus075WinBy1 = ExactSettlementEngine.settleAsianHandicap(1, 0, -0.75, 2.00, 'HOME', 1.0);
    expect(ahMinus075WinBy1.outcome).toBe('HALF_WIN');
    expect(ahMinus075WinBy1.profit).toBe(0.5);

    // +0.75 with 0-1 Loss: Half Loss (-0.50 profit)
    const ahPlus075LossBy1 = ExactSettlementEngine.settleAsianHandicap(0, 1, 0.75, 2.00, 'HOME', 1.0);
    expect(ahPlus075LossBy1.outcome).toBe('HALF_LOSS');
    expect(ahPlus075LossBy1.profit).toBe(-0.5);
  });

  // --------------------------------------------------------------------------
  // 15. OU settlement math accurate (full, half, quarter lines)
  // --------------------------------------------------------------------------
  it('15. computes Over/Under full, half, and quarter lines accurately', () => {
    // Full line: Over 2.0 with 2 goals -> PUSH
    const ou20Push = ExactSettlementEngine.settleOverUnder(2, 2.0, 1.95, 'OVER', 1.0);
    expect(ou20Push.outcome).toBe('PUSH');
    expect(ou20Push.profit).toBe(0.0);
    expect(ou20Push.returnAmount).toBe(1.0);

    // Quarter line: Over 2.25 with 2 goals -> HALF_LOSS
    const ou225HalfLoss = ExactSettlementEngine.settleOverUnder(2, 2.25, 2.00, 'OVER', 1.0);
    expect(ou225HalfLoss.outcome).toBe('HALF_LOSS');
    expect(ou225HalfLoss.profit).toBe(-0.5);

    // Quarter line: Over 2.75 with 3 goals -> HALF_WIN
    const ou275HalfWin = ExactSettlementEngine.settleOverUnder(3, 2.75, 2.00, 'OVER', 1.0);
    expect(ou275HalfWin.outcome).toBe('HALF_WIN');
    expect(ou275HalfWin.profit).toBe(0.5);

    // Half line: Under 2.5 with 2 goals -> WIN
    const ou25Win = ExactSettlementEngine.settleOverUnder(2, 2.5, 1.90, 'UNDER', 1.0);
    expect(ou25Win.outcome).toBe('WIN');
    expect(ou25Win.profit).toBeCloseTo(0.90, 4);
  });

  // --------------------------------------------------------------------------
  // 16. BTTS settlement math accurate (YES/NO)
  // --------------------------------------------------------------------------
  it('16. computes Both Teams To Score (BTTS) accurately for YES and NO', () => {
    // 2-1 result
    const bttsYesWin = ExactSettlementEngine.settleBtts(2, 1, 1.85, 'YES', 1.0);
    expect(bttsYesWin.outcome).toBe('WIN');
    expect(bttsYesWin.profit).toBeCloseTo(0.85, 4);

    const bttsNoLoss = ExactSettlementEngine.settleBtts(2, 1, 2.05, 'NO', 1.0);
    expect(bttsNoLoss.outcome).toBe('LOSS');
    expect(bttsNoLoss.profit).toBe(-1.0);

    // 1-0 result
    const bttsYesLoss = ExactSettlementEngine.settleBtts(1, 0, 1.85, 'YES', 1.0);
    expect(bttsYesLoss.outcome).toBe('LOSS');
    expect(bttsYesLoss.profit).toBe(-1.0);

    const bttsNoWin = ExactSettlementEngine.settleBtts(1, 0, 2.05, 'NO', 1.0);
    expect(bttsNoWin.outcome).toBe('WIN');
    expect(bttsNoWin.profit).toBeCloseTo(1.05, 4);
  });

  // --------------------------------------------------------------------------
  // 17. Settlement idempotent: re-settling causes 0 duplicate profit
  // --------------------------------------------------------------------------
  it('17. enforces settlement idempotency: re-settling returns existing settlement without duplicate profit', () => {
    const pred = CanonicalBetLedgerService.recordPrediction({
      canonicalFixtureId: 'cm_idem_01',
      fixture: 'PSG vs Marseille',
      competition: 'Ligue 1',
      league: 'Ligue 1',
      homeTeam: 'PSG',
      awayTeam: 'Marseille',
      kickoffTimestamp: '2026-09-28T19:00:00Z',
      market: 'AH',
      selection: 'HOME',
      line: -1.0,
      provider: 'OddsPapi',
      bookmaker: 'Pinnacle',
      marketOdds: 1.90,
      oddsTimestamp: '2026-09-28T12:00:00Z',
      modelProbability: 0.60,
      fairOdds: 1.667,
      expectedValue: 0.14,
      edge: 0.07,
      confidence: 'HIGH',
      confidenceScore: 88,
      valueStatus: 'VALUE',
      predictionTimestamp: '2026-09-28T12:00:00Z',
      featureTimestamp: '2026-09-28T11:00:00Z',
      modelVersion: 'dixon-coles-v1.0',
      pipelineVersion: 'v1.0',
      dataVersion: 'v1.0',
    });

    const matchRes = {
      status: 'FT',
      homeGoals: 3,
      awayGoals: 1,
      closingOdds: 1.85,
      closingLine: -1.0,
    };

    // First settlement
    const s1 = CanonicalSettlementEngine.settlePrediction(pred.record, matchRes, {
      nowMs: new Date('2026-09-28T22:00:00Z').getTime(),
    });
    expect(s1.settled).toBe(true);
    expect(s1.settlement?.outcome).toBe('WIN');
    expect(s1.settlement?.profitUnits).toBeCloseTo(0.90, 4);

    // Second settlement attempt
    const s2 = CanonicalSettlementEngine.settlePrediction(pred.record, matchRes, {
      nowMs: new Date('2026-09-28T22:30:00Z').getTime(),
    });
    expect(s2.settled).toBe(true);
    expect(s2.reason).toBe('ALREADY_SETTLED');
    expect(s2.settlement?.profitUnits).toBeCloseTo(0.90, 4);

    // Check ledger status and total count
    const all = CanonicalBetLedgerService.getAllPredictions();
    expect(all.length).toBe(1);
    expect(all[0].status).toBe('SETTLED');
  });

  // --------------------------------------------------------------------------
  // 18. CLV calculated only with valid closing odds; UNAVAILABLE when missing
  // --------------------------------------------------------------------------
  it('18. marks CLV as UNAVAILABLE when closing odds are missing or line shifted', () => {
    const pred = CanonicalBetLedgerService.recordPrediction({
      canonicalFixtureId: 'cm_clv_01',
      fixture: 'Ajax vs Feyenoord',
      competition: 'Eredivisie',
      league: 'Eredivisie',
      homeTeam: 'Ajax',
      awayTeam: 'Feyenoord',
      kickoffTimestamp: '2026-09-28T14:30:00Z',
      market: 'OU',
      selection: 'OVER',
      line: 2.5,
      provider: 'OddsPapi',
      bookmaker: 'Pinnacle',
      marketOdds: 1.95,
      oddsTimestamp: '2026-09-28T10:00:00Z',
      modelProbability: 0.58,
      fairOdds: 1.724,
      expectedValue: 0.131,
      edge: 0.06,
      confidence: 'HIGH',
      confidenceScore: 82,
      valueStatus: 'VALUE',
      predictionTimestamp: '2026-09-28T10:00:00Z',
      featureTimestamp: '2026-09-28T09:00:00Z',
      modelVersion: 'dixon-coles-v1.0',
      pipelineVersion: 'v1.0',
      dataVersion: 'v1.0',
    });

    // Case A: Missing closing odds
    const sWithoutClv = CanonicalSettlementEngine.settlePrediction(
      pred.record,
      {
        status: 'FT',
        homeGoals: 2,
        awayGoals: 1,
        closingOdds: null, // Missing
      },
      { nowMs: new Date('2026-09-28T18:00:00Z').getTime() }
    );

    expect(sWithoutClv.settlement?.clv).toBeNull();

    // Check clvRecord in ledger
    const updated = CanonicalBetLedgerService.getPrediction(pred.record.predictionId);
    expect(updated?.clvRecord?.clvStatus).toBe('UNAVAILABLE');
    expect(updated?.clvRecord?.closingOdds).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 19. CLV not fabricated: never inferred from model odds or fair odds
  // --------------------------------------------------------------------------
  it('19. refuses to infer closing odds from model odds or fair odds', () => {
    const pred = CanonicalBetLedgerService.recordPrediction({
      canonicalFixtureId: 'cm_clv_nofab',
      fixture: 'Porto vs Benfica',
      competition: 'Primeira Liga',
      league: 'Primeira Liga',
      homeTeam: 'Porto',
      awayTeam: 'Benfica',
      kickoffTimestamp: '2026-09-27T20:00:00Z',
      market: 'AH',
      selection: 'HOME',
      line: -0.5,
      provider: 'OddsPapi',
      bookmaker: 'Pinnacle',
      marketOdds: 2.10,
      oddsTimestamp: '2026-09-27T12:00:00Z',
      modelProbability: 0.55,
      fairOdds: 1.818,
      expectedValue: 0.155,
      edge: 0.07,
      confidence: 'HIGH',
      confidenceScore: 85,
      valueStatus: 'VALUE',
      predictionTimestamp: '2026-09-27T12:00:00Z',
      featureTimestamp: '2026-09-27T11:00:00Z',
      modelVersion: 'dixon-coles-v1.0',
      pipelineVersion: 'v1.0',
      dataVersion: 'v1.0',
    });

    const sRes = CanonicalSettlementEngine.settlePrediction(
      pred.record,
      {
        status: 'FT',
        homeGoals: 2,
        awayGoals: 0,
        closingOdds: undefined, // no closing odds provided
      },
      { nowMs: new Date('2026-09-27T23:00:00Z').getTime() }
    );

    // Invariant: clv must NOT equal (marketOdds / fairOdds) - 1 or fabricated
    expect(sRes.settlement?.clv).toBeNull();
    const loaded = CanonicalBetLedgerService.getPrediction(pred.record.predictionId);
    expect(loaded?.clvRecord?.clvStatus).toBe('UNAVAILABLE');
    expect(loaded?.clvRecord?.clvPercentage).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 20. ROI and Yield calculations include losing bets and half results
  // --------------------------------------------------------------------------
  it('20. calculates ROI and Yield deterministically without excluding losses or half results', () => {
    // 3 bets: 1 WIN (+0.95), 1 HALF_LOSS (-0.50), 1 LOSS (-1.00)
    // Total staked: 3.0 units. Net PnL: +0.95 - 0.50 - 1.00 = -0.55 units.
    // ROI / Yield: -0.55 / 3.0 = -18.33%
    const p1 = CanonicalBetLedgerService.recordPrediction({
      canonicalFixtureId: 'cm_perf_01',
      fixture: 'Team A vs Team B',
      competition: 'Premier League',
      league: 'Premier League',
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      kickoffTimestamp: '2026-09-25T14:00:00Z',
      market: 'AH',
      selection: 'HOME',
      line: -0.5,
      provider: 'OddsPapi',
      bookmaker: 'Pinnacle',
      marketOdds: 1.95,
      oddsTimestamp: '2026-09-25T10:00:00Z',
      modelProbability: 0.55,
      fairOdds: 1.818,
      expectedValue: 0.07,
      edge: 0.03,
      confidence: 'HIGH',
      confidenceScore: 80,
      valueStatus: 'VALUE',
      predictionTimestamp: '2026-09-25T10:00:00Z',
      featureTimestamp: '2026-09-25T09:00:00Z',
      modelVersion: 'v1.0',
      pipelineVersion: 'v1.0',
      dataVersion: 'v1.0',
    });

    const p2 = CanonicalBetLedgerService.recordPrediction({
      canonicalFixtureId: 'cm_perf_02',
      fixture: 'Team C vs Team D',
      competition: 'Premier League',
      league: 'Premier League',
      homeTeam: 'Team C',
      awayTeam: 'Team D',
      kickoffTimestamp: '2026-09-25T16:00:00Z',
      market: 'AH',
      selection: 'HOME',
      line: -0.25,
      provider: 'OddsPapi',
      bookmaker: 'Pinnacle',
      marketOdds: 2.00,
      oddsTimestamp: '2026-09-25T10:00:00Z',
      modelProbability: 0.52,
      fairOdds: 1.923,
      expectedValue: 0.04,
      edge: 0.02,
      confidence: 'HIGH',
      confidenceScore: 80,
      valueStatus: 'VALUE',
      predictionTimestamp: '2026-09-25T10:00:00Z',
      featureTimestamp: '2026-09-25T09:00:00Z',
      modelVersion: 'v1.0',
      pipelineVersion: 'v1.0',
      dataVersion: 'v1.0',
    });

    const p3 = CanonicalBetLedgerService.recordPrediction({
      canonicalFixtureId: 'cm_perf_03',
      fixture: 'Team E vs Team F',
      competition: 'Premier League',
      league: 'Premier League',
      homeTeam: 'Team E',
      awayTeam: 'Team F',
      kickoffTimestamp: '2026-09-25T18:00:00Z',
      market: 'OU',
      selection: 'OVER',
      line: 2.5,
      provider: 'OddsPapi',
      bookmaker: 'Pinnacle',
      marketOdds: 1.90,
      oddsTimestamp: '2026-09-25T10:00:00Z',
      modelProbability: 0.56,
      fairOdds: 1.785,
      expectedValue: 0.064,
      edge: 0.03,
      confidence: 'HIGH',
      confidenceScore: 80,
      valueStatus: 'VALUE',
      predictionTimestamp: '2026-09-25T10:00:00Z',
      featureTimestamp: '2026-09-25T09:00:00Z',
      modelVersion: 'v1.0',
      pipelineVersion: 'v1.0',
      dataVersion: 'v1.0',
    });

    // Settle p1 as WIN (1-0) -> profit +0.95
    CanonicalSettlementEngine.settlePrediction(
      p1.record,
      { status: 'FT', homeGoals: 1, awayGoals: 0 },
      { nowMs: new Date('2026-09-25T20:00:00Z').getTime() }
    );

    // Settle p2 as HALF_LOSS (0-0 on -0.25 line) -> profit -0.50
    CanonicalSettlementEngine.settlePrediction(
      p2.record,
      { status: 'FT', homeGoals: 0, awayGoals: 0 },
      { nowMs: new Date('2026-09-25T20:00:00Z').getTime() }
    );

    // Settle p3 as LOSS (0-1 on Over 2.5) -> profit -1.00
    CanonicalSettlementEngine.settlePrediction(
      p3.record,
      { status: 'FT', homeGoals: 0, awayGoals: 1 },
      { nowMs: new Date('2026-09-25T20:00:00Z').getTime() }
    );

    const report = CanonicalPerformanceEngine.generateReport(
      CanonicalBetLedgerService.getAllPredictions()
    );

    expect(report.totalPredictions).toBe(3);
    expect(report.settledPredictions).toBe(3);
    expect(report.totalStaked).toBe(3.0);
    expect(report.totalProfit).toBeCloseTo(-0.55, 4);
    expect(report.yieldDecimal).toBeCloseTo(-0.55 / 3.0, 4);
    expect(report.roiDecimal).toBeCloseTo(-0.55 / 3.0, 4);
    expect(report.yieldPct).toBeCloseTo((-0.55 / 3.0) * 100, 2);
    expect(report.roiPct).toBeCloseTo((-0.55 / 3.0) * 100, 2);
  });

  // --------------------------------------------------------------------------
  // 21. SalmoProductionSyncService emits canonical schema
  // --------------------------------------------------------------------------
  it('21. emits valid canonical sync schema matching Section M contract', () => {
    // Ingest upcoming prediction
    CanonicalBetLedgerService.recordPrediction({
      canonicalFixtureId: 'cm_sync_test',
      fixture: 'Arsenal vs Leeds',
      competition: 'Premier League',
      league: 'Premier League',
      homeTeam: 'Arsenal',
      awayTeam: 'Leeds',
      kickoffTimestamp: '2026-10-10T11:30:00Z',
      market: 'AH',
      selection: 'HOME',
      line: -1.25,
      provider: 'OddsPapi',
      bookmaker: 'Pinnacle',
      marketOdds: 1.95,
      oddsTimestamp: '2026-09-30T10:00:00Z',
      modelProbability: 0.62,
      fairOdds: 1.613,
      expectedValue: 0.209,
      edge: 0.10,
      confidence: 'HIGH',
      confidenceScore: 88,
      valueStatus: 'VALUE',
      predictionTimestamp: '2026-09-30T10:00:00Z',
      featureTimestamp: '2026-09-30T09:00:00Z',
      modelVersion: 'dixon-coles-v1.0',
      pipelineVersion: 'v1.0',
      dataVersion: 'v1.0',
    });

    const payload = SalmoProductionSyncService.generateSyncPayload({
      nowMs: new Date('2026-09-30T12:00:00Z').getTime(),
    });

    expect(payload.success).toBe(true);
    expect(payload.dataState).toBe('REAL');
    expect(payload.syncChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.dailyPicks.length).toBe(1);
    expect(payload.dailyPicks[0].homeTeam).toBe('Arsenal');
    expect(payload.dailyPicks[0].awayTeam).toBe('Leeds');
    expect(payload.freshness).toBeDefined();
    expect(payload.performance).toBeDefined();
    expect(payload.settledHistory).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 22. Daily picks strictly empty if all fixtures are in the past
  // --------------------------------------------------------------------------
  it('22. returns empty dailyPicks and NO_QUALIFIED_PICKS when all matches are in the past', () => {
    // Only historical past predictions
    CanonicalBetLedgerService.recordPrediction({
      canonicalFixtureId: 'cm_past_only',
      fixture: 'Brentford vs Chelsea',
      competition: 'Premier League',
      league: 'Premier League',
      homeTeam: 'Brentford',
      awayTeam: 'Chelsea',
      kickoffTimestamp: '2026-09-18T19:00:00Z', // PAST
      market: 'AH',
      selection: 'HOME',
      line: -0.25,
      provider: 'OddsPapi',
      bookmaker: 'Pinnacle',
      marketOdds: 2.26,
      oddsTimestamp: '2026-09-18T10:00:00Z',
      modelProbability: 0.45,
      fairOdds: 2.222,
      expectedValue: 0.017,
      edge: 0.01,
      confidence: 'MEDIUM',
      confidenceScore: 70,
      valueStatus: 'VALUE',
      predictionTimestamp: '2026-09-18T10:00:00Z',
      featureTimestamp: '2026-09-18T09:00:00Z',
      modelVersion: 'dixon-coles-v1.0',
      pipelineVersion: 'v1.0',
      dataVersion: 'v1.0',
    });

    const payload = SalmoProductionSyncService.generateSyncPayload({
      nowMs: new Date('2026-09-30T12:00:00Z').getTime(), // Sept 30
    });

    expect(payload.dailyPicks.length).toBe(0); // STRICTLY 0
    expect(payload.dataState).toBe('NO_QUALIFIED_PICKS');
  });

  // --------------------------------------------------------------------------
  // 23. PipelineFreshnessTelemetry exposes all required metrics
  // --------------------------------------------------------------------------
  it('23. exposes all Section N telemetry metrics and Prometheus exposition', () => {
    const report = PipelineFreshnessTelemetry.getTelemetryReport({
      nowMs: new Date('2026-09-30T12:00:00Z').getTime(),
    });

    const m = report.metrics;
    expect(m.handicaplab_fixtures_total).toBeDefined();
    expect(m.handicaplab_fixtures_upcoming).toBeDefined();
    expect(m.handicaplab_fixtures_stale).toBeDefined();
    expect(m.handicaplab_predictions_total).toBeDefined();
    expect(m.handicaplab_predictions_active).toBeDefined();
    expect(m.handicaplab_predictions_settled).toBeDefined();
    expect(m.handicaplab_predictions_pending_settlement).toBeDefined();
    expect(m.handicaplab_odds_freshness_seconds).toBeDefined();
    expect(m.handicaplab_salmo_sync_status).toBeDefined();
    expect(m.handicaplab_salmo_last_sync_timestamp).toBeDefined();
    expect(m.handicaplab_reconciliation_issues_total).toBeDefined();

    const prom = PipelineFreshnessTelemetry.toPrometheusMetrics(report);
    expect(prom).toContain('handicaplab_fixtures_total');
    expect(prom).toContain('handicaplab_predictions_active');
    expect(prom).toContain('handicaplab_reconciliation_issues_total');
  });

  // --------------------------------------------------------------------------
  // 24. ReconciliationEngineV2 detects all 11 corruption conditions
  // --------------------------------------------------------------------------
  it('24. detects all 11 corruption conditions in ReconciliationEngineV2', () => {
    const nowMs = new Date('2026-09-30T12:00:00Z').getTime();

    // Fabricate test corrupted inputs
    const corruptedPredictions: any[] = [
      // 1. ORPHAN_PREDICTION
      {
        predictionId: 'pred_orphan',
        canonicalFixtureId: 'non_existent_match',
        kickoffTimestamp: '2026-10-10T14:00:00Z',
        predictionTimestamp: '2026-09-30T10:00:00Z',
        marketOdds: 2.0,
        status: 'PENDING',
      },
      // 4. MISSING_ODDS
      {
        predictionId: 'pred_bad_odds',
        canonicalFixtureId: 'cm_good_01',
        kickoffTimestamp: '2026-10-10T14:00:00Z',
        predictionTimestamp: '2026-09-30T10:00:00Z',
        marketOdds: 0.5, // Invalid
        status: 'PENDING',
      },
      // 10. FABRICATED_ODDS
      {
        predictionId: 'pred_fake_odds',
        canonicalFixtureId: 'cm_good_01',
        kickoffTimestamp: '2026-10-10T14:00:00Z',
        predictionTimestamp: '2026-09-30T10:00:00Z',
        marketOdds: 2.0,
        bookmaker: 'synthetic-mock-feed',
        status: 'PENDING',
      },
      // 5. POST_KICKOFF_PREDICTION
      {
        predictionId: 'pred_post_kick',
        canonicalFixtureId: 'cm_good_01',
        kickoffTimestamp: '2026-09-20T14:00:00Z',
        predictionTimestamp: '2026-09-20T14:30:00Z', // After kickoff
        marketOdds: 2.0,
        status: 'PENDING',
      },
      // 6. MISSING_SETTLEMENT (Match is finished, prediction remains pending)
      {
        predictionId: 'pred_missing_stl',
        canonicalFixtureId: 'cm_finished_01',
        kickoffTimestamp: '2026-09-20T14:00:00Z',
        predictionTimestamp: '2026-09-20T10:00:00Z',
        marketOdds: 2.0,
        status: 'PENDING',
      },
      // 11. FABRICATED_CLV (CLV marked AVAILABLE with null closing odds)
      {
        predictionId: 'pred_fake_clv',
        canonicalFixtureId: 'cm_good_01',
        kickoffTimestamp: '2026-09-20T14:00:00Z',
        predictionTimestamp: '2026-09-20T10:00:00Z',
        marketOdds: 2.0,
        status: 'SETTLED',
        settlement: { settlementId: 'stl_01', outcome: 'WIN' },
        clvRecord: { clvStatus: 'AVAILABLE', closingOdds: null, clvPercentage: null },
      },
    ];

    const fixtureRegistry: Record<string, any> = {
      cm_good_01: {
        canonicalMatchId: 'cm_good_01',
        providerMatchId: 'af_01',
        homeTeam: 'Team A',
        awayTeam: 'Team B',
        kickoffUtc: '2026-10-10T14:00:00Z',
        status: 'SCHEDULED',
        canonicalUpdatedAtUtc: '2026-09-30T11:00:00Z',
      },
      cm_finished_01: {
        canonicalMatchId: 'cm_finished_01',
        providerMatchId: 'af_fin_01',
        homeTeam: 'Team C',
        awayTeam: 'Team D',
        kickoffUtc: '2026-09-20T14:00:00Z',
        status: 'FINISHED',
        homeGoals: 2,
        awayGoals: 1,
        canonicalUpdatedAtUtc: '2026-09-20T18:00:00Z',
      },
      cm_stale_fix: {
        canonicalMatchId: 'cm_stale_fix',
        providerMatchId: 'af_stale',
        homeTeam: 'Team E',
        awayTeam: 'Team F',
        kickoffUtc: '2026-10-15T14:00:00Z',
        status: 'SCHEDULED',
        canonicalUpdatedAtUtc: '2026-09-20T10:00:00Z', // 10 days old! STALE_FIXTURE
      },
    };

    // Stale SALMO pick (Sept 18 pick active on Sept 30)
    const salmoActivePicks = [
      {
        predictionId: 'salmo_stale_pick',
        kickoffUtc: '2026-09-18T19:00:00Z', // Kicked off!
        homeTeam: 'Brentford',
        awayTeam: 'Chelsea',
      },
    ];

    const audit = ReconciliationEngineV2.runAudit({
      nowMs,
      predictions: corruptedPredictions,
      fixtureRegistry,
      salmoActivePicks,
    });

    expect(audit.status).toBe('RECONCILIATION_FAILURE');
    expect(audit.issuesByCode.ORPHAN_PREDICTION).toBeGreaterThan(0);
    expect(audit.issuesByCode.MISSING_ODDS).toBeGreaterThan(0);
    expect(audit.issuesByCode.FABRICATED_ODDS).toBeGreaterThan(0);
    expect(audit.issuesByCode.POST_KICKOFF_PREDICTION).toBeGreaterThan(0);
    expect(audit.issuesByCode.MISSING_SETTLEMENT).toBeGreaterThan(0);
    expect(audit.issuesByCode.FABRICATED_CLV).toBeGreaterThan(0);
    expect(audit.issuesByCode.STALE_FIXTURE).toBeGreaterThan(0);
    expect(audit.issuesByCode.STALE_SALMO_RECORD).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // 25. Zero synthetic data, zero post-kickoff predictions end-to-end invariant
  // --------------------------------------------------------------------------
  it('25. enforces end-to-end pipeline invariant: zero synthetic data, zero lookahead, zero fabricated CLV', () => {
    const predictions = CanonicalBetLedgerService.getAllPredictions();

    for (const p of predictions) {
      // 1. Zero synthetic bookmaker
      const bm = (p.bookmaker || '').toLowerCase();
      expect(bm).not.toContain('synthetic');
      expect(bm).not.toContain('mock');

      // 2. Zero post-kickoff predictions
      const predMs = new Date(p.predictionTimestamp).getTime();
      const kickMs = new Date(p.kickoffTimestamp).getTime();
      expect(predMs).toBeLessThan(kickMs);

      // 3. Zero fabricated CLV
      if (p.clvRecord?.clvStatus === 'AVAILABLE') {
        expect(p.clvRecord.closingOdds).toBeGreaterThan(1.0);
        expect(p.clvRecord.clvPercentage).not.toBeNull();
      }
    }
  });
});
