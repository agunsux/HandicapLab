import { describe, it, expect, beforeEach } from 'vitest';
import { HighConfidenceLedgerService } from '@/lib/ledger/highConfidenceLedgerService';
import { ProductionSettlementService, AuthoritativeMatchResult } from '@/lib/ledger/productionSettlementService';
import { DailyPerformanceService } from '@/lib/ledger/dailyPerformanceService';
import { DurableLedgerStore } from '@/lib/ledger/durableLedgerStore';
import { PublishedSignal } from '@/lib/publishing/types';

describe('High-Confidence Prediction Ledger & Settlement Leakage Invariants', () => {
  beforeEach(() => {
    DurableLedgerStore.clearStoreForTesting();
  });

  const createSignal = (overrides: Partial<PublishedSignal> = {}): PublishedSignal => ({
    signalId: `sig_${Math.random().toString(36).slice(2, 8)}`,
    predictionId: 'pred_123',
    canonicalMatchId: 'can_123',
    fixtureId: 'af_1001',
    providerFixtureId: '1001',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    competition: 'Premier League',
    competitionId: 'ENG-PL',
    kickoffUtc: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours future
    market: 'AH',
    selection: 'Arsenal -0.25',
    line: -0.25,
    currentOdds: 1.95,
    fairOdds: 1.80,
    modelProbability: 0.555,
    edge: 0.083,
    expectedValue: 0.082,
    confidence: 75, // Qualified (> 70)
    recommendation: 'VALUE_CANDIDATE',
    oddsTimestampUtc: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    predictionTimestampUtc: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    modelVersion: 'dixon-coles-v1.0',
    payloadHash: 'hash_abc123',
    bookmaker: 'Pinnacle',
    validationStatus: 'PROVISIONAL_EDGE',
    ...overrides,
  });

  // --------------------------------------------------------------------------
  // T1: Post-kickoff creation rejected (REJECTED_POST_KICKOFF)
  // --------------------------------------------------------------------------
  it('T1: rejects prediction created at or after kickoff (REJECTED_POST_KICKOFF)', async () => {
    const kickoffUtc = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 mins ago
    const predictionTime = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 mins ago (leakage!)

    const signal = createSignal({
      kickoffUtc,
      predictionTimestampUtc: predictionTime,
      confidence: 78,
    });

    const result = await HighConfidenceLedgerService.qualifyAndRecordPrediction(signal);
    expect(result.qualified).toBe(false);
    expect(result.rejectionReason).toContain('REJECTED_POST_KICKOFF');
    expect(result.ledgerEntry).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // T2: Odds change after kickoff doesn't change historical locked odds
  // --------------------------------------------------------------------------
  it('T2: locks odds snapshot at kickoff and prevents post-kickoff odds mutation', async () => {
    const kickoffMs = Date.now() + 60 * 1000; // 1 min in future
    const signal = createSignal({
      kickoffUtc: new Date(kickoffMs).toISOString(),
      currentOdds: 1.95,
      confidence: 76,
    });

    const initial = await HighConfidenceLedgerService.qualifyAndRecordPrediction(signal);
    expect(initial.qualified).toBe(true);
    expect(initial.ledgerEntry.odds).toBe(1.95);
    expect(initial.ledgerEntry.status).toBe('RECORDED');

    // Simulate match starting (nowMs > kickoffMs)
    const lockedCount = await HighConfidenceLedgerService.lockBetsForKickoff(kickoffMs + 5000);
    expect(lockedCount).toBe(1);

    const lockedEntry = DurableLedgerStore.loadLedger()[initial.ledgerEntry.ledgerId];
    expect(lockedEntry.status).toBe('LOCKED');
    expect(lockedEntry.odds).toBe(1.95);

    // Live market odds move drastically to 2.50 post-kickoff
    const mutatedSignal = {
      ...signal,
      currentOdds: 2.50,
      oddsTimestampUtc: new Date(kickoffMs + 10000).toISOString(),
    };

    const reAttempt = await HighConfidenceLedgerService.qualifyAndRecordPrediction(mutatedSignal);
    expect(reAttempt.isNewRecord).toBe(false);
    // Locked odds remain unchanged at 1.95
    expect(reAttempt.ledgerEntry.odds).toBe(1.95);
  });

  // --------------------------------------------------------------------------
  // T3: Repeated reconciliation produces no duplicates
  // --------------------------------------------------------------------------
  it('T3: repeated reconciliation produces no duplicates with deterministic idempotency key', async () => {
    const signal = createSignal({ fixtureId: 'af_3003', confidence: 73 });

    const run1 = await HighConfidenceLedgerService.qualifyAndRecordPrediction(signal);
    const run2 = await HighConfidenceLedgerService.qualifyAndRecordPrediction(signal);
    const run3 = await HighConfidenceLedgerService.qualifyAndRecordPrediction(signal);

    expect(run1.isNewRecord).toBe(true);
    expect(run2.isNewRecord).toBe(false);
    expect(run3.isNewRecord).toBe(false);
    expect(run1.ledgerEntry.ledgerId).toBe(run2.ledgerEntry.ledgerId);
    expect(run2.ledgerEntry.ledgerId).toBe(run3.ledgerEntry.ledgerId);

    const allEntries = HighConfidenceLedgerService.getLedgerEntries();
    expect(allEntries.length).toBe(1);
  });

  // --------------------------------------------------------------------------
  // T4: Confidence change after publish doesn't alter historical confidence
  // --------------------------------------------------------------------------
  it('T4: subsequent confidence re-calculations do not alter historical recorded confidence', async () => {
    const signal = createSignal({ confidence: 76.5 });
    const original = await HighConfidenceLedgerService.qualifyAndRecordPrediction(signal);
    expect(original.ledgerEntry.confidenceScore).toBe(76.5);

    // Model later runs again with 85% confidence on same fixture/market/line
    const updatedSignal = { ...signal, confidence: 85.0 };
    const secondCall = await HighConfidenceLedgerService.qualifyAndRecordPrediction(updatedSignal);

    expect(secondCall.isNewRecord).toBe(false);
    expect(secondCall.ledgerEntry.confidenceScore).toBe(76.5);
  });

  // --------------------------------------------------------------------------
  // T5: Postponed match does not settle
  // --------------------------------------------------------------------------
  it('T5: postponed match does not settle and remains in awaiting state', async () => {
    const signal = createSignal({ confidence: 74 });
    const { ledgerEntry } = await HighConfidenceLedgerService.qualifyAndRecordPrediction(signal);

    const matchResult: AuthoritativeMatchResult = {
      fixtureId: ledgerEntry.fixtureId,
      status: 'PST', // Postponed
      homeGoals: null,
      awayGoals: null,
    };

    const settleRes = await ProductionSettlementService.settleEntry(ledgerEntry, matchResult);
    expect(settleRes.settled).toBe(false);
    expect(settleRes.reason).toContain('MATCH_POSTPONED');

    const loaded = DurableLedgerStore.loadLedger()[ledgerEntry.ledgerId];
    expect(loaded.status).not.toBe('SETTLED');
  });

  // --------------------------------------------------------------------------
  // T6: Cancelled match settles as VOID (0.0 profit)
  // --------------------------------------------------------------------------
  it('T6: cancelled or abandoned match settles as VOID with stake refunded and 0.0 profit', async () => {
    const signal = createSignal({ confidence: 75 });
    const { ledgerEntry } = await HighConfidenceLedgerService.qualifyAndRecordPrediction(signal);

    const matchResult: AuthoritativeMatchResult = {
      fixtureId: ledgerEntry.fixtureId,
      status: 'CANC', // Cancelled
      homeGoals: null,
      awayGoals: null,
    };

    const settleRes = await ProductionSettlementService.settleEntry(ledgerEntry, matchResult);
    expect(settleRes.settled).toBe(true);
    expect(settleRes.outcome).toBe('VOID');

    const settlements = DurableLedgerStore.loadSettlements();
    const settlement = settlements[ledgerEntry.ledgerId];
    expect(settlement.outcome).toBe('VOID');
    expect(settlement.profitUnits).toBe(0.0);
    expect(settlement.returnUnits).toBe(1.0); // 1.0u stake returned
  });

  // --------------------------------------------------------------------------
  // T7: Incomplete provider result flags DATA_ERROR and does not settle
  // --------------------------------------------------------------------------
  it('T7: incomplete provider result with missing goals flags DATA_ERROR and never guesses', async () => {
    const signal = createSignal({ confidence: 77 });
    const { ledgerEntry } = await HighConfidenceLedgerService.qualifyAndRecordPrediction(signal);

    const matchResult: AuthoritativeMatchResult = {
      fixtureId: ledgerEntry.fixtureId,
      status: 'FT',
      homeGoals: null, // Corrupted / missing
      awayGoals: 1,
    };

    const settleRes = await ProductionSettlementService.settleEntry(ledgerEntry, matchResult);
    expect(settleRes.settled).toBe(false);
    expect(settleRes.reason).toContain('DATA_ERROR');

    const loaded = DurableLedgerStore.loadLedger()[ledgerEntry.ledgerId];
    expect(loaded.status).toBe('DATA_ERROR');
    expect(loaded.rejectionReason).toContain('MISSING_RESULT_GOALS');
  });

  // --------------------------------------------------------------------------
  // T8: AH quarter-lines calculate correctly (+0.475, -0.50, 0.0, +0.95, -1.0)
  // --------------------------------------------------------------------------
  it('T8: Asian Handicap quarter-lines decompose and settle exact half-win and half-loss math', async () => {
    // 1. AH -0.25 on Arsenal (Home) @ 1.95 odds. Score: 1-1 (Draw) -> Half Loss (-0.50u)
    const sigHalfLoss = createSignal({
      fixtureId: 'af_801',
      market: 'AH',
      selection: 'Arsenal -0.25',
      line: -0.25,
      currentOdds: 1.95,
      confidence: 72,
    });
    const resHL = await HighConfidenceLedgerService.qualifyAndRecordPrediction(sigHalfLoss);
    const hlSettlement = await ProductionSettlementService.settleEntry(resHL.ledgerEntry, {
      fixtureId: 'af_801',
      status: 'FT',
      homeGoals: 1,
      awayGoals: 1,
    });
    expect(hlSettlement.outcome).toBe('HALF_LOSS');
    const stlHL = DurableLedgerStore.loadSettlements()[resHL.ledgerEntry.ledgerId];
    expect(stlHL.profitUnits).toBe(-0.5);
    expect(stlHL.returnUnits).toBe(0.5);

    // 2. AH +0.25 on Chelsea (Away) @ 1.95 odds. Score: 1-1 (Draw) -> Half Win (odds-1)/2 = +0.475u
    const sigHalfWin = createSignal({
      fixtureId: 'af_802',
      market: 'AH',
      selection: 'Chelsea +0.25',
      line: 0.25,
      currentOdds: 1.95,
      confidence: 72,
    });
    const resHW = await HighConfidenceLedgerService.qualifyAndRecordPrediction(sigHalfWin);
    const hwSettlement = await ProductionSettlementService.settleEntry(resHW.ledgerEntry, {
      fixtureId: 'af_802',
      status: 'FT',
      homeGoals: 1,
      awayGoals: 1,
    });
    expect(hwSettlement.outcome).toBe('HALF_WIN');
    const stlHW = DurableLedgerStore.loadSettlements()[resHW.ledgerEntry.ledgerId];
    expect(stlHW.profitUnits).toBe(0.475);
    expect(stlHW.returnUnits).toBe(1.475);

    // 3. AH -0.75 on Arsenal (Home) @ 1.90 odds. Score: 2-1 (Arsenal wins by 1) -> Half Win (1.90-1)/2 = +0.45u
    const sigAh75 = createSignal({
      fixtureId: 'af_803',
      market: 'AH',
      selection: 'Arsenal -0.75',
      line: -0.75,
      currentOdds: 1.90,
      confidence: 75,
    });
    const res75 = await HighConfidenceLedgerService.qualifyAndRecordPrediction(sigAh75);
    const set75 = await ProductionSettlementService.settleEntry(res75.ledgerEntry, {
      fixtureId: 'af_803',
      status: 'FT',
      homeGoals: 2,
      awayGoals: 1,
    });
    expect(set75.outcome).toBe('HALF_WIN');
    const stl75 = DurableLedgerStore.loadSettlements()[res75.ledgerEntry.ledgerId];
    expect(stl75.profitUnits).toBe(0.45);
    expect(stl75.returnUnits).toBe(1.45);

    // 4. AH +0.75 on Chelsea (Away) @ 1.90 odds. Score: 2-1 (Chelsea loses by 1) -> Half Loss (-0.50u)
    const sigAhPlus75 = createSignal({
      fixtureId: 'af_804',
      market: 'AH',
      selection: 'Chelsea +0.75',
      line: 0.75,
      currentOdds: 1.90,
      confidence: 75,
    });
    const resP75 = await HighConfidenceLedgerService.qualifyAndRecordPrediction(sigAhPlus75);
    const setP75 = await ProductionSettlementService.settleEntry(resP75.ledgerEntry, {
      fixtureId: 'af_804',
      status: 'FT',
      homeGoals: 2,
      awayGoals: 1,
    });
    expect(setP75.outcome).toBe('HALF_LOSS');
    const stlP75 = DurableLedgerStore.loadSettlements()[resP75.ledgerEntry.ledgerId];
    expect(stlP75.profitUnits).toBe(-0.5);
    expect(stlP75.returnUnits).toBe(0.5);
  });

  // --------------------------------------------------------------------------
  // T9: Push produces zero P&L
  // --------------------------------------------------------------------------
  it('T9: whole-line push produces exactly 0.0 profit and returns original stake', async () => {
    // AH 0.0 on Home. Score: 1-1 -> PUSH
    const signal = createSignal({
      fixtureId: 'af_901',
      market: 'AH',
      selection: 'Arsenal 0.0',
      line: 0.0,
      currentOdds: 2.05,
      confidence: 74,
    });
    const { ledgerEntry } = await HighConfidenceLedgerService.qualifyAndRecordPrediction(signal);
    const settleRes = await ProductionSettlementService.settleEntry(ledgerEntry, {
      fixtureId: 'af_901',
      status: 'FT',
      homeGoals: 1,
      awayGoals: 1,
    });

    expect(settleRes.outcome).toBe('PUSH');
    const settlements = DurableLedgerStore.loadSettlements();
    const settlement = settlements[ledgerEntry.ledgerId];
    expect(settlement.profitUnits).toBe(0.0);
    expect(settlement.returnUnits).toBe(1.0);
  });

  // --------------------------------------------------------------------------
  // T10: Yield calculated from units staked, not win rate
  // --------------------------------------------------------------------------
  it('T10: yield is calculated strictly from units staked and profit, NEVER from win rate', async () => {
    const todayStr = '2026-09-20';
    const kickoff = `${todayStr}T14:00:00Z`;

    // Bet 1: 1.0u staked @ 2.00 odds -> WIN (+1.0u profit)
    const sig1 = createSignal({
      fixtureId: 'af_1001',
      kickoffUtc: kickoff,
      currentOdds: 2.00,
      market: 'OU',
      selection: 'Over 2.5',
      line: 2.5,
      confidence: 75,
    });
    const res1 = await HighConfidenceLedgerService.qualifyAndRecordPrediction(sig1);
    await ProductionSettlementService.settleEntry(res1.ledgerEntry, {
      fixtureId: 'af_1001',
      status: 'FT',
      homeGoals: 2,
      awayGoals: 1, // 3 goals -> WIN
    });

    // Bet 2: 1.0u staked @ 2.00 odds -> LOSS (-1.0u profit)
    const sig2 = createSignal({
      fixtureId: 'af_1002',
      kickoffUtc: kickoff,
      currentOdds: 2.00,
      market: 'BTTS',
      selection: 'BTTS Yes',
      line: 0,
      confidence: 72,
    });
    const res2 = await HighConfidenceLedgerService.qualifyAndRecordPrediction(sig2);
    await ProductionSettlementService.settleEntry(res2.ledgerEntry, {
      fixtureId: 'af_1002',
      status: 'FT',
      homeGoals: 2,
      awayGoals: 0, // No away goal -> LOSS
    });

    const summary = await DailyPerformanceService.recalculateDailySummary(todayStr);

    // Total staked: 2.0u. Total profit: +1.0 - 1.0 = 0.0u.
    // Yield: 0.0 / 2.0 * 100 = 0.0%
    // Win Rate: 1 / 2 = 50.0%
    expect(summary.settled).toBe(2);
    expect(summary.wins).toBe(1);
    expect(summary.losses).toBe(1);
    expect(summary.stakeUnits).toBe(2.0);
    expect(summary.profitUnits).toBe(0.0);
    expect(summary.yieldPct).toBe(0.0);
    expect(summary.strikeRatePct).toBe(50.0);

    // Yield != Strike Rate
    expect(summary.yieldPct).not.toBe(summary.strikeRatePct);
  });

  // --------------------------------------------------------------------------
  // T11: Strictly >70 qualifies (70.0 rejected, 70.1 accepted)
  // --------------------------------------------------------------------------
  it('T11: strictly confidence > 70 qualifies (70.0 rejected, 70.1 accepted)', async () => {
    // 70.0 -> REJECTED
    const sig70_0 = createSignal({ fixtureId: 'af_1101', confidence: 70.0 });
    const res70_0 = await HighConfidenceLedgerService.qualifyAndRecordPrediction(sig70_0);
    expect(res70_0.qualified).toBe(false);
    expect(res70_0.rejectionReason).toContain('CONFIDENCE_NOT_QUALIFIED');

    // 70.1 -> QUALIFIED
    const sig70_1 = createSignal({ fixtureId: 'af_1102', confidence: 70.1 });
    const res70_1 = await HighConfidenceLedgerService.qualifyAndRecordPrediction(sig70_1);
    expect(res70_1.qualified).toBe(true);
    expect(res70_1.ledgerEntry.confidenceScore).toBe(70.1);

    // 75.0 -> QUALIFIED
    const sig75 = createSignal({ fixtureId: 'af_1103', confidence: 75.0 });
    const res75 = await HighConfidenceLedgerService.qualifyAndRecordPrediction(sig75);
    expect(res75.qualified).toBe(true);
  });

  // --------------------------------------------------------------------------
  // T12: AH/OU/BTTS accepted into ledger
  // --------------------------------------------------------------------------
  it('T12: accepts AH, OU, and BTTS markets into the ledger', async () => {
    const ahSig = createSignal({ fixtureId: 'af_1201', market: 'AH', line: -0.5, selection: 'Home -0.5', confidence: 73 });
    const ouSig = createSignal({ fixtureId: 'af_1202', market: 'OU', line: 2.5, selection: 'Over 2.5', confidence: 74 });
    const bttsSig = createSignal({ fixtureId: 'af_1203', market: 'BTTS', line: 0, selection: 'BTTS Yes', confidence: 75 });

    const ahRes = await HighConfidenceLedgerService.qualifyAndRecordPrediction(ahSig);
    const ouRes = await HighConfidenceLedgerService.qualifyAndRecordPrediction(ouSig);
    const bttsRes = await HighConfidenceLedgerService.qualifyAndRecordPrediction(bttsSig);

    expect(ahRes.qualified).toBe(true);
    expect(ouRes.qualified).toBe(true);
    expect(bttsRes.qualified).toBe(true);
  });

  // --------------------------------------------------------------------------
  // T13: Moneyline / 1X2 rejected
  // --------------------------------------------------------------------------
  it('T13: rejects 1X2 and Moneyline markets even with high confidence (>70%)', async () => {
    const sig1x2 = createSignal({ fixtureId: 'af_1301', market: '1X2' as any, confidence: 85 });
    const sigMl = createSignal({ fixtureId: 'af_1302', market: 'MONEYLINE' as any, confidence: 85 });

    const res1x2 = await HighConfidenceLedgerService.qualifyAndRecordPrediction(sig1x2);
    const resMl = await HighConfidenceLedgerService.qualifyAndRecordPrediction(sigMl);

    expect(res1x2.qualified).toBe(false);
    expect(res1x2.rejectionReason).toContain('REJECTED_MONEYLINE_UNSUPPORTED');
    expect(resMl.qualified).toBe(false);
    expect(resMl.rejectionReason).toContain('REJECTED_MONEYLINE_UNSUPPORTED');
  });

  // --------------------------------------------------------------------------
  // T14: Idempotency constraint on same signal
  // --------------------------------------------------------------------------
  it('T14: idempotency constraint prevents duplicate record creation for same signal', async () => {
    const signal = createSignal({ fixtureId: 'af_1401', confidence: 76 });
    const firstCall = await HighConfidenceLedgerService.qualifyAndRecordPrediction(signal);
    expect(firstCall.isNewRecord).toBe(true);

    const secondCall = await HighConfidenceLedgerService.qualifyAndRecordPrediction(signal);
    expect(secondCall.isNewRecord).toBe(false);
    expect(secondCall.ledgerEntry.ledgerId).toBe(firstCall.ledgerEntry.ledgerId);
  });

  // --------------------------------------------------------------------------
  // T15: Settled prediction cannot be settled twice
  // --------------------------------------------------------------------------
  it('T15: settled prediction cannot be settled twice (ALREADY_SETTLED idempotency)', async () => {
    const signal = createSignal({
      fixtureId: 'af_1501',
      market: 'OU',
      selection: 'Over 2.5',
      line: 2.5,
      confidence: 72,
    });
    const { ledgerEntry } = await HighConfidenceLedgerService.qualifyAndRecordPrediction(signal);

    const matchResult: AuthoritativeMatchResult = {
      fixtureId: 'af_1501',
      status: 'FT',
      homeGoals: 2,
      awayGoals: 1,
    };

    // First settlement
    const firstSettle = await ProductionSettlementService.settleEntry(ledgerEntry, matchResult);
    expect(firstSettle.settled).toBe(true);

    // Retrieve settled entry from store
    const updatedEntry = DurableLedgerStore.loadLedger()[ledgerEntry.ledgerId];
    expect(updatedEntry.status).toBe('SETTLED');

    // Second settlement attempt on same entry
    const secondSettle = await ProductionSettlementService.settleEntry(updatedEntry, matchResult);
    expect(secondSettle.settled).toBe(false);
    expect(secondSettle.reason).toBe('ALREADY_SETTLED');
  });
});
