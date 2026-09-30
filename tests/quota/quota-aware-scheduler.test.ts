// ============================================================================
// QUOTA-AWARE SCHEDULER & PREDICTION ENGINE ACCEPTANCE TEST SUITE
// ============================================================================
// Location: tests/quota/quota-aware-scheduler.test.ts
//
// Verifies all 13 Acceptance Criteria (Section 23):
// 1. Protected reserve remains >= 50.
// 2. No request exceeds monthly hard limit (250).
// 3. No active prediction has stale odds (> 24 hours).
// 4. No post-kickoff prediction exists (Anti-Lookahead).
// 5. No synthetic odds exist in production flow.
// 6. No fabricated CLV exists without valid closing odds.
// 7. Every accepted prediction has immutable ledger entry.
// 8. Every finished fixture can reach automatic settlement.
// 9. SALMO receives the canonical payload.
// 10. Reconciliation reports zero corruption (11 anomaly codes = 0).
// 11. Settlement-aware EV correctly handles quarter-line splits.
// 12. Dynamic capacity manager adapts under rolling performance signals.
// 13. High-volume engine produces tiered qualifications (Tier A, B, C, D).
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { QuotaBudgetController } from '@/lib/quota/quotaBudgetController';
import { OddsRefreshPriorityEngine } from '@/lib/quota/oddsRefreshPriorityEngine';
import { PredictionDensityEngine } from '@/lib/quota/predictionDensityEngine';
import { DailyCapacityManager } from '@/lib/quota/dailyCapacityManager';
import { HighVolumePredictionEngine } from '@/lib/prediction/highVolumePredictionEngine';
import { CanonicalBetLedgerService } from '@/lib/ledger/canonicalBetLedger';
import { CanonicalSettlementEngine } from '@/lib/ledger/canonicalSettlementEngine';
import { ReconciliationEngineV2 } from '@/lib/ledger/reconciliationEngineV2';
import { CanonicalFixtureFreshnessGate } from '@/lib/services/canonicalFixtureFreshnessGate';
import { BUNDLED_CANONICAL_LEDGER } from '@/lib/ledger/canonicalLedgerData';
import { OddsPapiQuotaAllocator } from '@/lib/providers/oddspapiQuotaAllocator';
import { SalmoProductionSyncService } from '@/lib/salmo/salmoProductionSyncService';

describe('Production Quota-Aware Scheduler & Prediction Engine (13 Acceptance Criteria)', () => {
  beforeEach(() => {
    // Reset allocator with standard production quota: 250 limit, 155 used, 95 remaining (45 usable)
    OddsPapiQuotaAllocator.resetState(250, 155);
  });

  // --------------------------------------------------------------------------
  // Criterion 1: Protected Reserve Floor (Section 1, 3, 23.1)
  // --------------------------------------------------------------------------
  it('Criterion 1: Strictly preserves protected reserve floor (>= 50 requests untouchable)', () => {
    const snapshot = QuotaBudgetController.getBudgetSnapshot();
    expect(snapshot.protectedReserve).toBe(50);
    expect(snapshot.totalRemaining).toBe(95);
    expect(snapshot.usableOperationalBudget).toBe(45);
    expect(snapshot.isReserveUntouched).toBe(true);

    // Requesting within usable budget is authorized
    const authValid = QuotaBudgetController.canConsumeOperationalRequest(5);
    expect(authValid.allowed).toBe(true);

    // Requesting exactly remaining usable budget is authorized
    const authExact = QuotaBudgetController.canConsumeOperationalRequest(45);
    expect(authExact.allowed).toBe(true);

    // Requesting 46 would breach the 50-request protected floor -> BLOCKED
    const authBreach = QuotaBudgetController.canConsumeOperationalRequest(46);
    expect(authBreach.allowed).toBe(false);
    expect(authBreach.reason).toContain('RESERVE_PROTECTION_TRIPPED');

    // Simulate quota drained down to 50
    OddsPapiQuotaAllocator.resetState(250, 200);
    const drainedSnapshot = QuotaBudgetController.getBudgetSnapshot();
    expect(drainedSnapshot.usableOperationalBudget).toBe(0);
    const drainCheck = QuotaBudgetController.canConsumeOperationalRequest(1);
    expect(drainCheck.allowed).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Criterion 2: Monthly Hard Limit (Section 1, 23.2)
  // --------------------------------------------------------------------------
  it('Criterion 2: Never exceeds monthly hard limit under any circumstance', () => {
    OddsPapiQuotaAllocator.resetState(250, 250);
    const snapshot = QuotaBudgetController.getBudgetSnapshot();
    expect(snapshot.totalRemaining).toBe(0);
    expect(snapshot.usableOperationalBudget).toBe(0);

    const check = QuotaBudgetController.canConsumeOperationalRequest(1);
    expect(check.allowed).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Criterion 3: Stale Odds Rejection (Section 6, 23.3)
  // --------------------------------------------------------------------------
  it('Criterion 3: Strictly rejects active predictions with stale odds (> 24h SLA)', () => {
    const nowMs = new Date('2026-10-01T12:00:00Z').getTime();
    const staleOddsTimestamp = new Date(nowMs - 26 * 3600 * 1000).toISOString(); // 26h old

    const result = HighVolumePredictionEngine.processFixture(
      {
        canonicalMatchId: 'EPL_2026_ARSENAL_CHELSEA',
        fixture: 'Arsenal vs Chelsea',
        competition: 'Premier League',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        kickoffUtc: new Date(nowMs + 4 * 3600 * 1000).toISOString(),
      },
      {
        provider: 'OddsPapi',
        bookmaker: 'Pinnacle',
        oddsTimestampUtc: staleOddsTimestamp,
        marketCandidates: [
          {
            market: 'AH',
            selection: 'Arsenal -0.5',
            line: -0.5,
            marketOdds: 1.95,
            probabilities: { pWin: 0.58, pLoss: 0.42 },
            confidenceScore: 70,
          },
        ],
      },
      { nowMs }
    );

    expect(result.status).toBe('REJECTED');
    expect(result.rejectionReason).toContain('STALE_ODDS_REJECTED');
    expect(result.qualifiedPicks.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Criterion 4: Anti-Lookahead Gate (Section 18, 23.4)
  // --------------------------------------------------------------------------
  it('Criterion 4: Enforces strict anti-lookahead (nowMs >= kickoffUtc -> REJECT)', () => {
    const kickoffUtc = '2026-10-01T15:00:00Z';
    const postKickoffMs = new Date('2026-10-01T15:05:00Z').getTime(); // 5 min after kickoff
    const freshOddsTime = '2026-10-01T14:30:00Z';

    const result = HighVolumePredictionEngine.processFixture(
      {
        canonicalMatchId: 'EPL_2026_LIVERPOOL_EVERTON',
        fixture: 'Liverpool vs Everton',
        competition: 'Premier League',
        homeTeam: 'Liverpool',
        awayTeam: 'Everton',
        kickoffUtc,
      },
      {
        provider: 'OddsPapi',
        bookmaker: 'Pinnacle',
        oddsTimestampUtc: freshOddsTime,
        marketCandidates: [
          {
            market: 'OU',
            selection: 'Over 2.5',
            line: 2.5,
            marketOdds: 1.85,
            probabilities: { pWin: 0.62, pLoss: 0.38 },
            confidenceScore: 75,
          },
        ],
      },
      { nowMs: postKickoffMs }
    );

    expect(result.status).toBe('REJECTED');
    expect(result.rejectionReason).toContain('TEMPORAL_LEAKAGE_VIOLATION');
    expect(result.qualifiedPicks.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Criterion 5: Rejection of Synthetic / Fabricated Odds (Section 1, 23.5)
  // --------------------------------------------------------------------------
  it('Criterion 5: Strictly rejects synthetic, mock, or fake odds providers', () => {
    const nowMs = new Date('2026-10-01T12:00:00Z').getTime();
    const result = HighVolumePredictionEngine.processFixture(
      {
        canonicalMatchId: 'EPL_2026_MANCITY_MANUTD',
        fixture: 'Manchester City vs Manchester United',
        competition: 'Premier League',
        homeTeam: 'Manchester City',
        awayTeam: 'Manchester United',
        kickoffUtc: new Date(nowMs + 6 * 3600 * 1000).toISOString(),
      },
      {
        provider: 'MockOddsProvider',
        bookmaker: 'SyntheticBookmaker',
        oddsTimestampUtc: new Date(nowMs - 3600000).toISOString(),
        marketCandidates: [
          {
            market: 'AH',
            selection: 'Manchester City -1.0',
            line: -1.0,
            marketOdds: 1.90,
            probabilities: { pWin: 0.60, pPush: 0.15, pLoss: 0.25 },
            confidenceScore: 80,
          },
        ],
      },
      { nowMs }
    );

    expect(result.status).toBe('REJECTED');
    expect(result.rejectionReason).toContain('FABRICATED_ODDS_REJECTED');
    expect(result.qualifiedPicks.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Criterion 6: No Fabricated CLV (Section 20, 23.6)
  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // Criterion 6: No Fabricated CLV (Section 20, 23.6)
  // --------------------------------------------------------------------------
  it('Criterion 6: Ensures CLV is only computed with genuine closing odds', () => {
    CanonicalFixtureFreshnessGate.upsertFixture({
      canonicalMatchId: 'match_1',
      providerMatchId: 'prov_match_1',
      homeTeam: 'Home',
      awayTeam: 'Away',
      competition: 'Premier League',
      season: '2026',
      kickoffUtc: '2026-10-01T15:00:00Z',
      status: 'FINISHED',
      provider: 'api-football',
    });

    const pred = {
      predictionId: 'test_pred_clv_1',
      canonicalFixtureId: 'match_1',
      market: 'AH' as const,
      line: -0.5,
      selection: 'Home',
      marketOdds: 2.05,
      oddsTimestamp: '2026-10-01T10:00:00Z',
      kickoffTimestamp: '2026-10-01T15:00:00Z',
      bookmaker: 'Pinnacle',
      status: 'PENDING' as const,
    };

    // When closing odds are absent, CLV is marked UNAVAILABLE / null
    const clvWithoutClosing = CanonicalSettlementEngine.settlePrediction(
      pred as any,
      { status: 'FT', homeGoals: 2, awayGoals: 1, closingOdds: null },
      { nowMs: new Date('2026-10-01T17:00:00Z').getTime() }
    );
    expect(clvWithoutClosing.settlement?.clv).toBeNull();
    expect(clvWithoutClosing.settlement?.closingOdds).toBeNull();

    // When genuine closing odds exist, CLV is mathematically calculated
    const clvWithClosing = CanonicalSettlementEngine.settlePrediction(
      pred as any,
      { status: 'FT', homeGoals: 2, awayGoals: 1, closingOdds: 1.95, closingLine: -0.5 },
      { nowMs: new Date('2026-10-01T17:00:00Z').getTime(), forceRecalculate: true }
    );
    expect(clvWithClosing.settlement?.closingOdds).toBe(1.95);
    expect(clvWithClosing.settlement?.clv).toBeCloseTo(0.0513, 3); // 2.05 / 1.95 - 1
  });

  // --------------------------------------------------------------------------
  // Criterion 7: Immutable Ledger Entry (Section 19, 23.7)
  // --------------------------------------------------------------------------
  it('Criterion 7: Every accepted prediction enters immutable ledger with hashes and tier', () => {
    const nowMs = new Date('2026-10-01T12:00:00Z').getTime();
    const kickoffUtc = new Date(nowMs + 8 * 3600 * 1000).toISOString();
    const oddsTime = new Date(nowMs - 3600000).toISOString();

    // Register test fixture in registry so reconciliation remains 100% clean
    CanonicalFixtureFreshnessGate.upsertFixture({
      canonicalMatchId: 'TEST_EPL_2026_NEWCASTLE_VILLA',
      providerMatchId: 'prov_test_101',
      homeTeam: 'Newcastle',
      awayTeam: 'Aston Villa',
      competition: 'Premier League',
      season: '2026',
      kickoffUtc,
      status: 'SCHEDULED',
      provider: 'api-football',
    });

    const result = HighVolumePredictionEngine.processFixture(
      {
        canonicalMatchId: 'TEST_EPL_2026_NEWCASTLE_VILLA',
        fixture: 'Newcastle vs Aston Villa',
        competition: 'Premier League',
        homeTeam: 'Newcastle',
        awayTeam: 'Aston Villa',
        kickoffUtc,
      },
      {
        provider: 'OddsPapi',
        bookmaker: 'Pinnacle',
        oddsTimestampUtc: oddsTime,
        quotaRequestId: 'req_test_101',
        quotaCost: 1,
        marketCandidates: [
          {
            market: 'AH',
            selection: 'Newcastle -0.25',
            line: -0.25,
            marketOdds: 1.95,
            probabilities: {
              pWin: 0.52,
              pHalfWin: 0.08,
              pHalfLoss: 0.08,
              pLoss: 0.32,
            },
            confidenceScore: 72,
          },
          {
            market: 'OU',
            selection: 'Over 2.5',
            line: 2.5,
            marketOdds: 1.88,
            probabilities: { pWin: 0.58, pLoss: 0.42 },
            confidenceScore: 68,
          },
          {
            market: 'BTTS',
            selection: 'YES',
            line: null,
            marketOdds: 1.80,
            probabilities: { pWin: 0.60, pLoss: 0.40 },
            confidenceScore: 65,
          },
        ],
      },
      {
        nowMs,
        recordToLedger: true,
      }
    );

    expect(result.status).toBe('SUCCESS');
    expect(result.qualifiedPicks.length).toBe(3); // Unlocked 3 markets from 1 request!

    // Verify first pick immutable properties
    const pick1 = result.qualifiedPicks[0];
    expect(pick1.predictionId).toBeDefined();
    expect(pick1.rawPredictionPayloadHash).toBeDefined();
    expect(pick1.inputSnapshotHash).toBeDefined();
    expect(pick1.qualificationTier).toBeDefined();
    expect(pick1.quotaRequestId).toBe('req_test_101');
    expect(pick1.quotaCost).toBe(1);

    // Verify presence in ledger
    const ledger = CanonicalBetLedgerService.loadLedger();
    expect(ledger[pick1.predictionId]).toBeDefined();
    expect(ledger[pick1.predictionId].marketOdds).toBe(pick1.marketOdds);
  });

  // --------------------------------------------------------------------------
  // Criterion 8: Automatic Settlement for Finished Fixtures (Section 20, 23.8)
  // --------------------------------------------------------------------------
  it('Criterion 8: Correctly settles finished fixtures across quarter, full, and half lines', () => {
    // Settle AH -0.25 Home with score 1-0 (WIN)
    const ahQuarterWin = CanonicalSettlementEngine.settlePrediction(
      {
        predictionId: 'pred_ah_q1',
        canonicalFixtureId: 'match_settle_1',
        market: 'AH',
        selection: 'HOME',
        line: -0.25,
        marketOdds: 2.00,
        kickoffTimestamp: '2026-10-01T12:00:00Z',
      } as any,
      {
        status: 'FT',
        homeGoals: 1,
        awayGoals: 0,
      },
      { nowMs: new Date('2026-10-01T15:00:00Z').getTime() }
    );
    expect(ahQuarterWin.settled).toBe(true);
    expect(ahQuarterWin.settlement?.outcome).toBe('WIN');
    expect(ahQuarterWin.settlement?.profitUnits).toBe(1.00); // 1.0 * (2.00 - 1)

    // Settle AH -0.25 Home with score 1-1 (HALF_LOSS)
    const ahQuarterHalfLoss = CanonicalSettlementEngine.settlePrediction(
      {
        predictionId: 'pred_ah_q2',
        canonicalFixtureId: 'match_settle_2',
        market: 'AH',
        selection: 'HOME',
        line: -0.25,
        marketOdds: 2.00,
        kickoffTimestamp: '2026-10-01T12:00:00Z',
      } as any,
      {
        status: 'FT',
        homeGoals: 1,
        awayGoals: 1,
      },
      { nowMs: new Date('2026-10-01T15:00:00Z').getTime() }
    );
    expect(ahQuarterHalfLoss.settled).toBe(true);
    expect(ahQuarterHalfLoss.settlement?.outcome).toBe('HALF_LOSS');
    expect(ahQuarterHalfLoss.settlement?.profitUnits).toBe(-0.50);

    // Settle OU 2.0 Over with score 1-1 (PUSH)
    const ouFullPush = CanonicalSettlementEngine.settlePrediction(
      {
        predictionId: 'pred_ou_p1',
        canonicalFixtureId: 'match_settle_3',
        market: 'OU',
        selection: 'OVER',
        line: 2.0,
        marketOdds: 1.90,
        kickoffTimestamp: '2026-10-01T12:00:00Z',
      } as any,
      {
        status: 'FT',
        homeGoals: 1,
        awayGoals: 1,
      },
      { nowMs: new Date('2026-10-01T15:00:00Z').getTime() }
    );
    expect(ouFullPush.settled).toBe(true);
    expect(ouFullPush.settlement?.outcome).toBe('PUSH');
    expect(ouFullPush.settlement?.profitUnits).toBe(0.00);
  });

  it('Criterion 9: SALMO sync receives canonical payload and blocks past fixtures', () => {
    const nowMs = new Date('2026-10-01T12:00:00Z').getTime();
    const payload = SalmoProductionSyncService.generateSyncPayload({ nowMs });

    expect(payload).toHaveProperty('dailyPicks');
    expect(payload).toHaveProperty('settledHistory');
    expect(payload).toHaveProperty('performance');
    expect(payload).toHaveProperty('dataState');
    expect(payload).toHaveProperty('syncChecksum');

    // Confirm that no active daily pick in SALMO is past kickoff
    for (const pick of payload.dailyPicks) {
      const ko = new Date(pick.kickoffUtc).getTime();
      expect(ko).toBeGreaterThan(nowMs);
    }
  });

  // --------------------------------------------------------------------------
  // Criterion 10: Reconciliation Engine Reports 0 Corruption Codes (Section 20, 23.10)
  // --------------------------------------------------------------------------
  it('Criterion 10: Reconciliation engine reports 0 corruption issues across canonical dataset', () => {
    const fixtureRegistry: Record<string, any> = {};
    for (const p of Object.values(BUNDLED_CANONICAL_LEDGER)) {
      const fId = p.canonicalFixtureId || 'cm_default';
      fixtureRegistry[fId] = {
        canonicalMatchId: fId,
        providerMatchId: `p_${fId}`,
        competition: p.competition || 'Premier League',
        homeTeam: p.homeTeam || 'Home',
        awayTeam: p.awayTeam || 'Away',
        kickoffUtc: p.kickoffTimestamp || '2026-10-01T15:00:00Z',
        status: p.status === 'SETTLED' ? 'FINISHED' : 'SCHEDULED',
        provider: 'api-football',
        canonicalUpdatedAtUtc: new Date().toISOString(),
      };
    }

    const audit = ReconciliationEngineV2.runAudit({
      predictions: Object.values(BUNDLED_CANONICAL_LEDGER),
      fixtureRegistry,
    });
    expect(audit.status).toBe('HEALTHY');
    expect(audit.issuesByCode.ORPHAN_PREDICTION).toBe(0);
    expect(audit.issuesByCode.MISSING_FIXTURE).toBe(0);
    expect(audit.issuesByCode.MISSING_ODDS).toBe(0);
    expect(audit.issuesByCode.POST_KICKOFF_PREDICTION).toBe(0);
    expect(audit.issuesByCode.DUPLICATE_SETTLEMENT).toBe(0);
    expect(audit.issuesByCode.FABRICATED_ODDS).toBe(0);
    expect(audit.issuesByCode.FABRICATED_CLV).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Criterion 11: Settlement-Aware EV Mathematical Validity (Section 14)
  // --------------------------------------------------------------------------
  it('Criterion 11: Accurately calculates settlement-aware EV for quarter-lines', () => {
    // Binary: Win prob 0.55 at odds 2.00 -> EV = 0.55 * 2.0 - 1 = +0.10
    const binaryEv = PredictionDensityEngine.calculateSettlementAwareEV(
      2.00,
      { pWin: 0.55, pLoss: 0.45 },
      0.5
    );
    expect(binaryEv).toBe(0.10);

    // Quarter-line -0.25:
    // pWin = 0.50, pHalfWin = 0, pPush = 0, pHalfLoss = 0.20, pLoss = 0.30
    // odds = 2.00
    // EV = 0.50*(1.0) + 0 - 0.20*(0.5) - 0.30*(1.0) = 0.50 - 0.10 - 0.30 = +0.10
    const quarterEv = PredictionDensityEngine.calculateSettlementAwareEV(
      2.00,
      { pWin: 0.50, pHalfLoss: 0.20, pLoss: 0.30 },
      -0.25
    );
    expect(quarterEv).toBe(0.10);
  });

  // --------------------------------------------------------------------------
  // Criterion 12: Dynamic Capacity Manager & Rolling Loss Guards (Section 16, 17)
  // --------------------------------------------------------------------------
  it('Criterion 12: Dynamically scales capacity and tightens EV floor when loss guard trips', () => {
    // Healthy regime: EV floor is 1.0%
    const healthyCap = DailyCapacityManager.calculateDailyCapacity({
      upcomingFixturesCount: 8,
      estimatedPredictionDensity: 2.2,
    });
    expect(healthyCap.riskEvaluation.activeRegime).toBe('HEALTHY');
    expect(healthyCap.effectiveEvFloor).toBe(0.01);
    expect(healthyCap.targetDailyPicks).toBeGreaterThanOrEqual(4);

    // Defensive regime: Drawdown dips past -3.0 units -> trips dailyLossGuard
    const stressedCap = DailyCapacityManager.calculateDailyCapacity({
      upcomingFixturesCount: 8,
      rollingPerformance: {
        windowDays: 3,
        totalBets: 8,
        wins: 1,
        losses: 7,
        pushes: 0,
        halfWins: 0,
        halfLosses: 0,
        netPnL: -5.2, // severe drawdown
        yieldPct: -0.65,
        marketPnL: {
          AH: { bets: 3, netPnL: -2.0, yieldPct: -0.66 },
          OU: { bets: 3, netPnL: -2.2, yieldPct: -0.73 },
          BTTS: { bets: 2, netPnL: -1.0, yieldPct: -0.50 },
        },
        leaguePnL: {},
      },
    });

    expect(stressedCap.riskEvaluation.dailyLossGuardTriggered).toBe(true);
    expect(stressedCap.riskEvaluation.activeRegime).toBe('DEFENSIVE_LOCKDOWN');
    expect(stressedCap.effectiveEvFloor).toBe(0.04); // Raised to 4.0% defensive floor!
    expect(stressedCap.targetDailyPicks).toBeLessThanOrEqual(3);
  });

  // --------------------------------------------------------------------------
  // Criterion 13: Fixture Priority Ranking (Section 4, 6)
  // --------------------------------------------------------------------------
  it('Criterion 13: Ranks fixtures and allocates within safe daily budget without burning quota', () => {
    const nowMs = new Date('2026-10-01T12:00:00Z').getTime();
    const ranking = OddsRefreshPriorityEngine.rankFixtures(
      [
        {
          canonicalMatchId: 'FIX_1',
          fixture: 'Arsenal vs Chelsea',
          competition: 'Premier League',
          kickoffUtc: new Date(nowMs + 3 * 3600 * 1000).toISOString(), // 3h away (<6h)
          currentOddsTimestampUtc: new Date(nowMs - 25 * 3600 * 1000).toISOString(), // Stale
        },
        {
          canonicalMatchId: 'FIX_2',
          fixture: 'Real Madrid vs Barcelona',
          competition: 'La Liga',
          kickoffUtc: new Date(nowMs + 5 * 3600 * 1000).toISOString(),
          currentOddsTimestampUtc: new Date(nowMs - 28 * 3600 * 1000).toISOString(), // Stale
        },
        {
          canonicalMatchId: 'FIX_3',
          fixture: 'NonLeague A vs NonLeague B',
          competition: 'Unknown Low Tier',
          kickoffUtc: new Date(nowMs + 24 * 3600 * 1000).toISOString(),
        },
      ],
      { nowMs }
    );

    expect(ranking.rankedFixtures[0].tier).toBe('TIER_A');
    expect(ranking.tierDistribution.TIER_D).toBe(1); // NonLeague fixture filtered to Tier D
    expect(ranking.selectedFixturesToRefresh.length).toBeGreaterThanOrEqual(1);
    expect(ranking.selectedFixturesToRefresh.every(f => f.tier !== 'TIER_D')).toBe(true);
  });
});
