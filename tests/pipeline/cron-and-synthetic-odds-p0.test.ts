import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ConfidenceGateSystem, ConfidenceGateInput } from '@/lib/pipeline/confidenceGate';
import { DailyPipelineOrchestrator } from '@/lib/pipeline/dailyOrchestrator';
import { DailyPredictionLedgerService } from '@/lib/pipeline/dailyPredictionLedger';
import { RunIdentityService } from '@/lib/pipeline/runIdentity';
import { SalmoSyncService } from '@/lib/pipeline/salmoSyncService';
import { CanonicalFixture } from '@/lib/services/canonicalFixtureRegistry';
import { GET as getCronPipeline } from '@/app/api/cron/pipeline/route';

describe('P0 Production Fixes: Cron Activation & Zero Synthetic Odds Verification', () => {
  beforeEach(() => {
    RunIdentityService.clearForTesting();
    DailyPredictionLedgerService.clearForTesting();
    SalmoSyncService.clearForTesting();
  });

  const baseKickoff = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const basePredictionTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const baseOddsTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const baseInput: ConfidenceGateInput = {
    canonicalMatchId: 'CANONICAL_TEST_MATCH_001',
    fixtureId: 'fix_test_001',
    match: 'Arsenal vs Chelsea',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    competition: 'Premier League',
    kickoffUtc: baseKickoff,
    market: 'OU',
    selection: 'Over 2.5',
    line: 2.5,
    modelProbability: 0.74,
    calibratedProbability: 0.74,
    predictionTimestampUtc: basePredictionTime,
    oddsTimestampUtc: baseOddsTime,
    modelVersion: 'dixon-coles-v1.0',
    sampleSizeHome: 10,
    sampleSizeAway: 10,
    modelValidated: true,
  };

  // ─── BLOCKER #2: ZERO SYNTHETIC ODDS TESTS ─────────────────────────────

  it('1. ConfidenceGateSystem.evaluate returns status AWAITING_ODDS when odds is null', () => {
    const result = ConfidenceGateSystem.evaluate({
      ...baseInput,
      odds: null,
    });

    expect(result.status).toBe('AWAITING_ODDS');
    expect(result.qualified).toBe(false);
    expect(result.isHighConfidence).toBe(false);
  });

  it('2. ConfidenceGateSystem.evaluate returns status AWAITING_ODDS when odds is undefined', () => {
    const result = ConfidenceGateSystem.evaluate({
      ...baseInput,
      odds: undefined,
    });

    expect(result.status).toBe('AWAITING_ODDS');
    expect(result.qualified).toBe(false);
    expect(result.isHighConfidence).toBe(false);
  });

  it('3. ConfidenceGateSystem.evaluate returns status AWAITING_ODDS when odds <= 1.0', () => {
    const resultSubOne = ConfidenceGateSystem.evaluate({
      ...baseInput,
      odds: 0.95,
    });
    expect(resultSubOne.status).toBe('AWAITING_ODDS');
    expect(resultSubOne.qualified).toBe(false);

    const resultOne = ConfidenceGateSystem.evaluate({
      ...baseInput,
      odds: 1.00,
    });
    expect(resultOne.status).toBe('AWAITING_ODDS');
    expect(resultOne.qualified).toBe(false);
  });

  it('4. unquoted evaluation enforces edge=0, EV=0, confidenceScore=0, confidenceTier=PASS, and verdict=LEWATI', () => {
    const result = ConfidenceGateSystem.evaluate({
      ...baseInput,
      odds: null,
    });

    expect(result.edge).toBe(0);
    expect(result.expectedValue).toBe(0);
    expect(result.marketImpliedProbability).toBe(0);
    expect(result.confidenceScore).toBe(0);
    expect(result.confidenceTier).toBe('PASS');
    expect(result.verdict).toBe('LEWATI');
    expect(result.passes.oddsThreshold).toBe(false);
    expect(result.passes.positiveEdge).toBe(false);
    expect(result.passes.positiveEv).toBe(false);
    expect(result.rejectionReasons.some((r) => r.includes('AWAITING_ODDS'))).toBe(true);
  });

  const mockFixtureSingleQuote: CanonicalFixture = {
    fixtureId: 'fix_p0_seattle_sporting',
    homeTeam: 'Seattle Sounders',
    awayTeam: 'Sporting Kansas City',
    competitionName: 'Major League Soccer',
    competitionId: 253,
    season: '2026',
    kickoffUtc: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    status: 'SCHEDULED',
    providerFixtureId: 'mls_2026_01',
    source: 'api-football',
    firstSeenAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
    markets: {
      asianHandicap: {
        available: false,
      },
      overUnder: {
        available: true,
        line: 2.5,
        overOdds: 1.88,
        underOdds: 1.98,
      },
      btts: {
        available: true,
        line: 0.5,
        yesOdds: 1.62,
        noOdds: 2.25,
      },
    },
  };

  it('5. DailyPipelineOrchestrator generates AWAITING_ODDS with odds:null for OU lines not quoted by OddsPAPI', async () => {
    const report = await DailyPipelineOrchestrator.executeDailyRun({
      trigger: 'MANUAL',
      forceNew: true,
      customFixtures: [mockFixtureSingleQuote],
    });

    expect(report.status).toBe('SUCCESS');

    const ledger = DailyPredictionLedgerService.loadLedger();
    const records = Object.values(ledger).filter((r) => r.runId === report.runId);

    const ouRecords = records.filter((r) => r.market === 'OU');
    expect(ouRecords.length).toBe(5); // lines 1.5, 2.0, 2.5, 3.0, 3.5

    // Line 2.5 is quoted
    const quoted25 = ouRecords.find((r) => r.line === 2.5);
    expect(quoted25).toBeDefined();
    expect(quoted25?.odds).toBe(1.88);

    // Lines 1.5, 2.0, 3.0, 3.5 must be AWAITING_ODDS with null odds
    const unquotedLines = ouRecords.filter((r) => r.line !== 2.5);
    expect(unquotedLines.length).toBe(4);

    for (const rec of unquotedLines) {
      expect(rec.status).toBe('AWAITING_ODDS');
      expect(rec.odds).toBeNull();
      expect(rec.edge).toBe(0);
      expect(rec.expectedValue).toBe(0);
    }
  });

  it('6. DailyPipelineOrchestrator strictly eliminates the 1.85 synthetic fallback (zero manufactured odds)', async () => {
    const report = await DailyPipelineOrchestrator.executeDailyRun({
      trigger: 'MANUAL',
      forceNew: true,
      customFixtures: [mockFixtureSingleQuote],
    });

    const ledger = DailyPredictionLedgerService.loadLedger();
    const records = Object.values(ledger).filter((r) => r.runId === report.runId);

    // Assert that NO record has synthetic odds 1.85 when not quoted
    const synthetic185 = records.filter(
      (r) => r.market === 'OU' && r.line !== 2.5 && r.odds === 1.85
    );
    expect(synthetic185.length).toBe(0);
  });

  it('7. DailyPipelineOrchestrator never pushes AWAITING_ODDS records into highConfidenceRecords or qualifiedLedgerRecords', async () => {
    const report = await DailyPipelineOrchestrator.executeDailyRun({
      trigger: 'MANUAL',
      forceNew: true,
      customFixtures: [mockFixtureSingleQuote],
    });

    // High confidence must only contain items with real odds
    const ledger = DailyPredictionLedgerService.loadLedger();
    const highConfLedger = Object.values(ledger).filter(
      (r) => r.runId === report.runId && r.status === 'HIGH_CONFIDENCE'
    );

    for (const rec of highConfLedger) {
      expect(rec.status).toBe('HIGH_CONFIDENCE');
      expect(typeof rec.odds).toBe('number');
      expect(rec.odds).toBeGreaterThan(1.0);
      expect(rec.market).not.toBe('BTTS');
    }

    const awaitingOddsRecords = Object.values(ledger).filter(
      (r) => r.runId === report.runId && r.status === 'AWAITING_ODDS'
    );
    expect(awaitingOddsRecords.length).toBeGreaterThan(0);
    for (const awaiting of awaitingOddsRecords) {
      expect(highConfLedger.some((h) => h.predictionId === awaiting.predictionId)).toBe(false);
    }
  });

  it('8. SalmoSyncService strictly rejects predictions with status AWAITING_ODDS or odds null', async () => {
    const dummyRecord: any = {
      predictionId: 'pred_unquoted_ou_1',
      canonicalMatchId: 'match_mls_01',
      match: 'Seattle Sounders vs Sporting KC',
      homeTeam: 'Seattle Sounders',
      awayTeam: 'Sporting KC',
      competition: 'Major League Soccer',
      market: 'OU',
      selection: 'Over 1.5',
      line: 1.5,
      modelProbability: 0.85,
      calibratedProbability: 0.85,
      odds: null,
      impliedProbability: 0,
      edge: 0,
      expectedValue: 0,
      confidence: 'PASS',
      confidenceScore: 0,
      predictionTimestamp: new Date().toISOString(),
      kickoffTimestamp: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      oddsTimestamp: new Date().toISOString(),
      modelVersion: 'dixon-coles-v1.0',
      featureVersion: 'prematch-features-v1.0',
      runId: 'daily-p0-test',
      status: 'AWAITING_ODDS',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const syncReport = await SalmoSyncService.synchronize([dummyRecord]);

    expect(syncReport.status).toBe('NO_PICKS');
    expect(syncReport.created).toBe(0);
    expect(syncReport.syncedDecisions.length).toBe(0);
    expect(syncReport.rejected).toBe(1);
  });

  // ─── BLOCKER #1: PRODUCTION CRON ROUTE TESTS ───────────────────────────

  it('9. /api/cron/pipeline GET endpoint invokes DailyPipelineOrchestrator.executeDailyRun with trigger SCHEDULER_CRON', async () => {
    const spy = vi.spyOn(DailyPipelineOrchestrator, 'executeDailyRun');

    const req = new NextRequest('http://localhost:3000/api/cron/pipeline');
    const res = await getCronPipeline(req);

    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalled();
    const callArg = spy.mock.calls[0]?.[0];
    expect(callArg?.trigger).toBe('SCHEDULER_CRON');

    spy.mockRestore();
  });

  it('10. /api/cron/pipeline GET endpoint supports mode=daily and returns structured DailyPipelineReport', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/pipeline?mode=daily');
    const res = await getCronPipeline(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.result).toBeDefined();
    expect(data.result.runId).toContain('daily-');
    expect(data.result.status).toBe('SUCCESS');
    expect(data.result.reportPaths).toBeDefined();
    expect(data.result.salmoSync).toBeDefined();
    expect(data.result.predictionsCount).toBeDefined();
  });
});
