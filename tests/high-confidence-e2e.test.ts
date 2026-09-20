import { describe, it, expect, beforeEach } from 'vitest';
import { HighConfidenceLedgerService } from '@/lib/ledger/highConfidenceLedgerService';
import { ProductionSettlementService } from '@/lib/ledger/productionSettlementService';
import { DailyPerformanceService } from '@/lib/ledger/dailyPerformanceService';
import { DurableLedgerStore } from '@/lib/ledger/durableLedgerStore';
import { ProductionPublishingEngine } from '@/lib/publishing/productionPublishingEngine';
import { ProductionValidityGate } from '@/lib/publishing/productionValidityGate';
import { MarketSignalInput } from '@/lib/publishing/types';

describe('High-Confidence Prediction Ledger End-to-End Acceptance Pipeline', () => {
  beforeEach(() => {
    DurableLedgerStore.clearStoreForTesting();
    ProductionPublishingEngine.saveStore({});
  });

  it('executes the full lifecycle: Publication -> 1U Ledger Bet -> Kickoff Lock -> FT Result -> Settlement -> Daily Realized Yield', async () => {
    const nowMs = Date.now();
    const kickoffMs = nowMs + 2 * 60 * 60 * 1000; // Kickoff in 2 hours
    const todayStr = new Date(kickoffMs).toISOString().slice(0, 10);

    // ------------------------------------------------------------------------
    // Step 1: Market Signal Input with Confidence > 70%
    // ------------------------------------------------------------------------
    const signalInput: MarketSignalInput = {
      canonicalMatchId: 'cm_arsenal_chelsea_20260920',
      fixtureId: 'af_889900',
      providerFixtureId: '889900',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      competition: 'Premier League',
      leagueKey: 'ENG-PL', // Active Tier 1 Whitelist League
      kickoffUtc: new Date(kickoffMs).toISOString(),
      market: 'AH',
      selection: 'Arsenal -0.5',
      line: -0.5,
      marketOdds: 1.95,
      fairOdds: 1.78,
      modelProbability: 0.562,
      edge: 0.087,
      expectedValue: 0.095,
      confidence: 74.5, // > 70% threshold!
      recommendation: 'VALUE_CANDIDATE',
      oddsTimestampUtc: new Date(nowMs - 20 * 60 * 1000).toISOString(),
      predictionTimestampUtc: new Date(nowMs - 10 * 60 * 1000).toISOString(),
      modelVersion: 'dixon-coles-v1.0',
      providerSources: {
        fixtures: 'api-football-pro',
        odds: 'oddspapi-pinnacle',
        statistics: 'apifootball-baseline',
      },
      sampleSizeHome: 12,
      sampleSizeAway: 12,
      quotaAllowed: true,
      bookmaker: 'Pinnacle',
    };

    // ------------------------------------------------------------------------
    // Step 2: Reconcile and Publish through ProductionPublishingEngine
    // ------------------------------------------------------------------------
    const publishBatch = await ProductionPublishingEngine.reconcileAndPublish({
      customSignals: [signalInput],
      nowMs,
      triggeredBy: 'E2E_TEST_PIPELINE',
    });

    expect(publishBatch.publishedCount).toBe(1);
    const publishedSignals = ProductionPublishingEngine.getPublishedSignals(nowMs);
    expect(publishedSignals.length).toBe(1);

    const publishedSignal = publishedSignals[0];
    expect(publishedSignal.publishState).toBe('PUBLISHED');
    expect(publishedSignal.confidence).toBe(74.5);

    // ------------------------------------------------------------------------
    // Step 3: Verify 1-Unit Virtual Research Bet Recorded in Ledger
    // ------------------------------------------------------------------------
    const ledger = DurableLedgerStore.loadLedger();
    const entries = Object.values(ledger);
    expect(entries.length).toBe(1);

    const bet = entries[0];
    expect(bet.status).toBe('RECORDED');
    expect(bet.stakeUnits).toBe(1.0); // Exactly 1.0 unit virtual research bet
    expect(bet.betType).toBe('VIRTUAL_RESEARCH');
    expect(bet.confidenceScore).toBe(74.5);
    expect(bet.odds).toBe(1.95);
    expect(bet.line).toBe(-0.5);
    expect(bet.homeTeam).toBe('Arsenal');
    expect(bet.awayTeam).toBe('Chelsea');
    expect(bet.predictionLockedAt).toBeNull(); // Not locked yet

    // Verify Open Exposure is segregated from Realized Yield
    const preKickoffSummary = await DailyPerformanceService.recalculateDailySummary(todayStr);
    expect(preKickoffSummary.qualified).toBe(1);
    expect(preKickoffSummary.recorded).toBe(1);
    expect(preKickoffSummary.settled).toBe(0);
    expect(preKickoffSummary.openBets).toBe(1);
    expect(preKickoffSummary.openStakeUnits).toBe(1.0);
    expect(preKickoffSummary.stakeUnits).toBe(0.0); // Settled stake is 0
    expect(preKickoffSummary.profitUnits).toBe(0.0);
    expect(preKickoffSummary.yieldPct).toBe(0.0);

    // ------------------------------------------------------------------------
    // Step 4: Match Kickoff Arrives -> Bet Frozen & Locked
    // ------------------------------------------------------------------------
    const atKickoffMs = kickoffMs + 1000; // 1 second past kickoff
    const lockedCount = await HighConfidenceLedgerService.lockBetsForKickoff(atKickoffMs);
    expect(lockedCount).toBe(1);

    const lockedLedger = DurableLedgerStore.loadLedger();
    const lockedBet = lockedLedger[bet.ledgerId];
    expect(lockedBet.status).toBe('LOCKED');
    expect(lockedBet.predictionLockedAt).toBeTruthy();

    // ------------------------------------------------------------------------
    // Step 5: Final Whistle -> Authoritative Full-Time Result (Arsenal 2 - 1 Chelsea)
    // ------------------------------------------------------------------------
    const matchResults = [
      {
        fixtureId: bet.fixtureId,
        status: 'FT',
        homeGoals: 2,
        awayGoals: 1,
        provider: 'api-football-pro',
        receivedAtUtc: new Date(kickoffMs + 110 * 60 * 1000).toISOString(),
        closingOdds: 1.90, // Closing Pinnacle line
      },
    ];

    const settlementBatch = await ProductionSettlementService.settleBatch(matchResults);
    expect(settlementBatch.settledCount).toBe(1);
    expect(settlementBatch.errorCount).toBe(0);
    expect(settlementBatch.voidCount).toBe(0);

    // ------------------------------------------------------------------------
    // Step 6: Verify Settlement Details & Exact Math
    // ------------------------------------------------------------------------
    const settlements = DurableLedgerStore.loadSettlements();
    const settlement = settlements[bet.ledgerId];
    expect(settlement).toBeDefined();
    expect(settlement.outcome).toBe('WIN'); // Arsenal won 2-1 with line -0.5
    expect(settlement.homeGoals).toBe(2);
    expect(settlement.awayGoals).toBe(1);
    // Profit = 1.0 * (1.95 - 1.0) = 0.95u
    expect(settlement.profitUnits).toBe(0.95);
    expect(settlement.returnUnits).toBe(1.95);
    expect(settlement.clv).toBeCloseTo((1.95 / 1.90) - 1, 3); // Closing line value beaten

    // Verify Bet State transitioned to SETTLED
    const finalLedger = DurableLedgerStore.loadLedger();
    const finalBet = finalLedger[bet.ledgerId];
    expect(finalBet.status).toBe('SETTLED');
    expect(finalBet.settlementStatus).toBe('WIN');

    // ------------------------------------------------------------------------
    // Step 7: Verify Daily Yield & Overall Performance Transparency Report
    // ------------------------------------------------------------------------
    const postSettlementSummary = await DailyPerformanceService.recalculateDailySummary(todayStr);
    expect(postSettlementSummary.settled).toBe(1);
    expect(postSettlementSummary.wins).toBe(1);
    expect(postSettlementSummary.losses).toBe(0);
    expect(postSettlementSummary.pushes).toBe(0);
    expect(postSettlementSummary.stakeUnits).toBe(1.0);
    expect(postSettlementSummary.profitUnits).toBe(0.95);
    expect(postSettlementSummary.yieldPct).toBe(95.0); // +95.0% realized yield
    expect(postSettlementSummary.openBets).toBe(0); // Open exposure closed
    expect(postSettlementSummary.openStakeUnits).toBe(0.0);
    expect(postSettlementSummary.averageOdds).toBe(1.95);
    expect(postSettlementSummary.averageConfidence).toBe(74.5);

    // Verify Overall Report (horizons & dimensions)
    const overallReport = await DailyPerformanceService.getOverallReport({
      nowMs: kickoffMs + 120 * 60 * 1000,
    });
    expect(overallReport.canonicalDomain).toBe('salmo.dev');
    expect(overallReport.threshold).toBe(70);
    expect(overallReport.totalSettled).toBe(1);
    expect(overallReport.totalOpenBets).toBe(0);
    expect(overallReport.totalStakedUnits).toBe(1.0);
    expect(overallReport.totalProfitUnits).toBe(0.95);
    expect(overallReport.realizedYieldPct).toBe(95.0);

    // Dimension breakdown: Market AH
    const ahDimension = overallReport.byMarket.find((m) => m.dimensionKey === 'AH');
    expect(ahDimension).toBeDefined();
    expect(ahDimension?.settledBets).toBe(1);
    expect(ahDimension?.yieldPct).toBe(95.0);

    // Dimension breakdown: Confidence Band ('70_75' = 70.01 - 75.00%)
    const band70_75 = overallReport.byConfidenceBand.find((b) => b.dimensionKey === '70_75');
    expect(band70_75).toBeDefined();
    expect(band70_75?.settledBets).toBe(1);
    expect(band70_75?.yieldPct).toBe(95.0);
  });
});
