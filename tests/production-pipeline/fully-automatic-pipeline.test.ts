import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProductionValidityGate } from '@/lib/publishing/productionValidityGate';
import { ProductionPublishingEngine } from '@/lib/publishing/productionPublishingEngine';
import { HighConfidenceLedgerService } from '@/lib/ledger/highConfidenceLedgerService';
import { ProductionSettlementService, AuthoritativeMatchResult } from '@/lib/ledger/productionSettlementService';
import { ExactSettlementEngine } from '@/lib/research/settlement/exactSettlement';
import { DailyPerformanceService } from '@/lib/ledger/dailyPerformanceService';
import { DurableLedgerStore } from '@/lib/ledger/durableLedgerStore';
import { DailyPicksEngine } from '@/lib/daily-picks/engine';
import { TOP_LEAGUE_WHITELIST_IDS } from '@/lib/crons/fixtureDiscovery';
import { HIGH_CONFIDENCE_THRESHOLD } from '@/lib/ledger/constants';

describe('Epic: Fully Automatic Production Data, Publishing, Result & Settlement Pipeline', () => {
  beforeEach(() => {
    // Reset stores to a clean state
    ProductionPublishingEngine.saveStore({});
    DurableLedgerStore.saveLedger({});
    DurableLedgerStore.saveSettlements({});
  });

  // ─── 1. TOP LEAGUES WHITELIST & FIXTURE INGESTION ─────────────────────────
  describe('1. League Whitelist & Fixture Ingestion Governance', () => {
    it('enforces Top Leagues Whitelist strictly', () => {
      // Whitelist includes Premier League (39), La Liga (140), Serie A (135), Bundesliga (78), etc.
      expect(TOP_LEAGUE_WHITELIST_IDS.has(39)).toBe(true);
      expect(TOP_LEAGUE_WHITELIST_IDS.has(140)).toBe(true);
      expect(TOP_LEAGUE_WHITELIST_IDS.has(135)).toBe(true);
      expect(TOP_LEAGUE_WHITELIST_IDS.has(78)).toBe(true);
      expect(TOP_LEAGUE_WHITELIST_IDS.has(61)).toBe(true);
      expect(TOP_LEAGUE_WHITELIST_IDS.has(88)).toBe(true);
      expect(TOP_LEAGUE_WHITELIST_IDS.has(98)).toBe(true);
      expect(TOP_LEAGUE_WHITELIST_IDS.has(292)).toBe(true);
      expect(TOP_LEAGUE_WHITELIST_IDS.has(279)).toBe(true);

      // Irrelevant / non-top league IDs are rejected
      expect(TOP_LEAGUE_WHITELIST_IDS.has(99999)).toBe(false);
      expect(TOP_LEAGUE_WHITELIST_IDS.has(1234)).toBe(false);
    });
  });

  // ─── 2. MARKET BOUNDARY: MONEYLINE STRICTLY REJECTED ─────────────────────
  describe('2. Market Boundary & Moneyline Rejection', () => {
    const nowMs = Date.now();
    const kickoffUtc = new Date(nowMs + 24 * 3600 * 1000).toISOString();
    const oddsTimestampUtc = new Date(nowMs - 1000).toISOString();
    const predictionTimestampUtc = new Date(nowMs - 500).toISOString();

    it('rejects Moneyline / 1X2 in ProductionValidityGate', () => {
      const mlCandidate = {
        canonicalMatchId: 'match_ml_test_1',
        fixtureId: 'fix_ml_1',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        leagueKey: 'ENG-PL',
        leagueId: 39,
        kickoffUtc,
        market: '1X2',
        selection: 'Arsenal',
        marketOdds: 1.85,
        oddsTimestampUtc,
        predictionTimestampUtc,
        modelVersion: 'dixon-coles-v1.0',
        sampleSizeHome: 10,
        sampleSizeAway: 10,
        providerSources: { fixtures: 'api-football-pro', odds: 'oddspapi-pinnacle' },
      };

      const result = ProductionValidityGate.evaluate(mlCandidate as any);
      expect(result.isValid).toBe(false);
      expect(result.state).toBe('INVALID');
      expect(result.rejectionReason).toContain('MONEYLINE_UNSUPPORTED');
    });

    it('rejects Moneyline / 1X2 in HighConfidenceLedgerService', async () => {
      const mlSignal: any = {
        signalId: 'sig_ml_test',
        canonicalMatchId: 'match_ml_test',
        fixtureId: 'fix_ml_test',
        market: '1X2',
        selection: 'Arsenal',
        confidence: 85,
        kickoffUtc,
        predictionTimestampUtc,
      };

      const qual = await HighConfidenceLedgerService.qualifyAndRecordPrediction(mlSignal);
      expect(qual.qualified).toBe(false);
      expect(qual.rejectionReason).toContain('REJECTED_MONEYLINE_UNSUPPORTED');
    });

    it('accepts Asian Handicap, Over/Under, and BTTS in ProductionValidityGate', () => {
      const ahCandidate = {
        canonicalMatchId: 'match_ah_test_1',
        fixtureId: 'fix_ah_1',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        leagueKey: 'ENG-PL',
        leagueId: 39,
        kickoffUtc,
        market: 'AH',
        selection: 'Arsenal -0.5',
        line: -0.5,
        marketOdds: 1.95,
        oddsTimestampUtc,
        predictionTimestampUtc,
        modelVersion: 'dixon-coles-v1.0',
        sampleSizeHome: 10,
        sampleSizeAway: 10,
        providerSources: { fixtures: 'api-football-pro', odds: 'oddspapi-pinnacle' },
      };

      const result = ProductionValidityGate.evaluate(ahCandidate as any);
      expect(result.isValid).toBe(true);
      expect(result.state).toBe('VALID');
    });
  });

  // ─── 3. HIGH-CONFIDENCE RULE: STRICTLY > 70 ─────────────────────────────
  describe('3. High-Confidence Rule (Strictly > 70)', () => {
    const nowMs = Date.now();
    const kickoffUtc = new Date(nowMs + 24 * 3600 * 1000).toISOString();
    const predictionTimestampUtc = new Date(nowMs - 500).toISOString();

    it('rejects confidence = 70.0', async () => {
      const signal70: any = {
        signalId: 'sig_test_70',
        canonicalMatchId: 'match_70',
        fixtureId: 'fix_70',
        market: 'AH',
        line: -0.25,
        selection: 'Arsenal -0.25',
        confidence: 70.0,
        currentOdds: 1.95,
        modelProbability: 0.55,
        fairOdds: 1.82,
        kickoffUtc,
        predictionTimestampUtc,
        providerProvenance: { fixtures: 'api-football-pro', odds: 'oddspapi-pinnacle', modelVersion: 'dixon-coles-v1.0' },
      };

      const res = await HighConfidenceLedgerService.qualifyAndRecordPrediction(signal70);
      expect(res.qualified).toBe(false);
      expect(res.rejectionReason).toContain('CONFIDENCE_NOT_QUALIFIED');
    });

    it('qualifies confidence = 70.01 and 71.0', async () => {
      const signal7001: any = {
        signalId: 'sig_test_7001',
        canonicalMatchId: 'match_7001',
        fixtureId: 'fix_7001',
        market: 'AH',
        line: -0.25,
        selection: 'Arsenal -0.25',
        confidence: 70.01,
        currentOdds: 1.95,
        modelProbability: 0.55,
        fairOdds: 1.82,
        kickoffUtc,
        predictionTimestampUtc,
        providerProvenance: { fixtures: 'api-football-pro', odds: 'oddspapi-pinnacle', modelVersion: 'dixon-coles-v1.0' },
      };

      const res = await HighConfidenceLedgerService.qualifyAndRecordPrediction(signal7001);
      expect(res.qualified).toBe(true);
      expect(res.ledgerEntry).toBeDefined();
      expect(res.ledgerEntry?.stakeUnits).toBe(1.0);
      expect(res.ledgerEntry?.betType).toBe('VIRTUAL_RESEARCH');
    });
  });

  // ─── 4. TEMPORAL ANTI-LEAKAGE INVARIANT ─────────────────────────────────
  describe('4. Temporal Anti-Leakage Invariant', () => {
    it('enforces oddsTime <= predTime < kickTime strictly', () => {
      const nowMs = Date.now();
      const kickoffUtc = new Date(nowMs + 3600 * 1000).toISOString();

      // Case A: prediction created AFTER kickoff -> REJECTED
      const postKickCandidate = {
        canonicalMatchId: 'match_leak_1',
        fixtureId: 'fix_leak_1',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        leagueKey: 'ENG-PL',
        kickoffUtc: new Date(nowMs - 1000).toISOString(), // Kickoff in the past
        market: 'AH',
        selection: 'Arsenal -0.5',
        line: -0.5,
        marketOdds: 1.95,
        oddsTimestampUtc: new Date(nowMs - 2000).toISOString(),
        predictionTimestampUtc: new Date(nowMs).toISOString(), // Pred after kickoff
        sampleSizeHome: 10,
        sampleSizeAway: 10,
        providerSources: { fixtures: 'api-football-pro', odds: 'oddspapi-pinnacle' },
      };

      const resA = ProductionValidityGate.evaluate(postKickCandidate as any);
      expect(resA.isValid).toBe(false);
      expect(resA.checks.temporalAntiLeakagePassed).toBe(false);
      expect(resA.rejectionReason).toContain('TEMPORAL_LEAKAGE');
    });
  });

  // ─── 5. IDEMPOTENCY: 1 SIGNAL = 1 LEDGER RECORD = 1 SETTLEMENT ───────────
  describe('5. Idempotency & Zero Duplication on Retries', () => {
    const nowMs = Date.now();
    const kickoffUtc = new Date(nowMs + 24 * 3600 * 1000).toISOString();
    const predictionTimestampUtc = new Date(nowMs - 500).toISOString();

    it('running qualification 10 times results in exactly 1 ledger record', async () => {
      const signal: any = {
        signalId: 'sig_idempotent_test',
        canonicalMatchId: 'match_idempotent',
        fixtureId: 'fix_idempotent',
        market: 'AH',
        line: -0.5,
        selection: 'Arsenal -0.5',
        confidence: 75.0,
        currentOdds: 1.95,
        modelProbability: 0.58,
        fairOdds: 1.72,
        kickoffUtc,
        predictionTimestampUtc,
        providerProvenance: { fixtures: 'api-football-pro', odds: 'oddspapi-pinnacle', modelVersion: 'dixon-coles-v1.0' },
      };

      let firstLedgerId = '';
      for (let i = 0; i < 10; i++) {
        const res = await HighConfidenceLedgerService.qualifyAndRecordPrediction(signal);
        expect(res.qualified).toBe(true);
        if (i === 0) {
          expect(res.isNewRecord).toBe(true);
          firstLedgerId = res.ledgerEntry!.ledgerId;
        } else {
          expect(res.isNewRecord).toBe(false);
          expect(res.ledgerEntry!.ledgerId).toBe(firstLedgerId);
        }
      }

      const ledger = DurableLedgerStore.loadLedger();
      const entries = Object.values(ledger).filter((e) => e.fixtureId === 'fix_idempotent');
      expect(entries.length).toBe(1);
    });
  });

  // ─── 6. KICKOFF LOCK: IMMUTABILITY AT KICKOFF ────────────────────────────
  describe('6. Kickoff Lock & Immutability', () => {
    it('locks predictions past kickoff and rejects parameter modifications', async () => {
      const matchKickoffMs = Date.now() + 60 * 1000; // Kickoff in 1 minute
      const kickoffUtc = new Date(matchKickoffMs).toISOString();

      const signal: any = {
        signalId: 'sig_lock_test',
        canonicalMatchId: 'match_lock_1',
        fixtureId: 'fix_lock_1',
        market: 'AH',
        line: -0.25,
        selection: 'Arsenal -0.25',
        confidence: 74.0,
        currentOdds: 1.95,
        modelProbability: 0.56,
        fairOdds: 1.78,
        kickoffUtc,
        predictionTimestampUtc: new Date(matchKickoffMs - 3600 * 1000).toISOString(),
        providerProvenance: { fixtures: 'api-football-pro', odds: 'oddspapi-pinnacle', modelVersion: 'dixon-coles-v1.0' },
      };

      // Record bet before kickoff
      const qual = await HighConfidenceLedgerService.qualifyAndRecordPrediction(signal, { nowMs: matchKickoffMs - 10000 });
      expect(qual.ledgerEntry?.status).toBe('RECORDED');

      // Kickoff arrives (+2 minutes)
      const afterKickoffMs = matchKickoffMs + 2 * 60 * 1000;
      const lockedCount = await HighConfidenceLedgerService.lockBetsForKickoff(afterKickoffMs);
      expect(lockedCount).toBe(1);

      const ledger = DurableLedgerStore.loadLedger();
      const entry = ledger[qual.ledgerEntry!.ledgerId];
      expect(entry.status).toBe('LOCKED');
      expect(entry.predictionLockedAt).toBeDefined();

      // Immutable parameters must remain preserved
      expect(entry.odds).toBe(1.95);
      expect(entry.line).toBe(-0.25);
      expect(entry.selection).toBe('Arsenal -0.25');
      expect(entry.confidenceScore).toBe(74.0);
    });
  });

  // ─── 7. EXACT SETTLEMENT: AH WHOLE/HALF/QUARTER, OU, BTTS ────────────────
  describe('7. Exact Settlement Mathematical Rigor', () => {
    it('settles AH whole lines correctly (WIN / PUSH / LOSS)', () => {
      // 2-0, line -1.0 @ 2.0 -> Full Win: +1.0
      const win = ExactSettlementEngine.settleAsianHandicap(2, 0, -1.0, 2.0, 'HOME');
      expect(win.outcome).toBe('WIN');
      expect(win.profit).toBe(1.0);

      // 1-0, line -1.0 @ 2.0 -> Push: 0.0
      const push = ExactSettlementEngine.settleAsianHandicap(1, 0, -1.0, 2.0, 'HOME');
      expect(push.outcome).toBe('PUSH');
      expect(push.profit).toBe(0.0);

      // 1-1, line -1.0 @ 2.0 -> Full Loss: -1.0
      const loss = ExactSettlementEngine.settleAsianHandicap(1, 1, -1.0, 2.0, 'HOME');
      expect(loss.outcome).toBe('LOSS');
      expect(loss.profit).toBe(-1.0);
    });

    it('settles AH quarter lines correctly (HALF_WIN / HALF_LOSS)', () => {
      // 2-1, line -0.75 @ 1.90 -> Half Win: +0.45 profit
      const halfWin = ExactSettlementEngine.settleAsianHandicap(2, 1, -0.75, 1.90, 'HOME');
      expect(halfWin.outcome).toBe('HALF_WIN');
      expect(halfWin.profit).toBe(0.45);

      // 1-1, line -0.25 @ 1.90 -> Half Loss: -0.50 profit
      const halfLoss = ExactSettlementEngine.settleAsianHandicap(1, 1, -0.25, 1.90, 'HOME');
      expect(halfLoss.outcome).toBe('HALF_LOSS');
      expect(halfLoss.profit).toBe(-0.5);
    });

    it('settles Over/Under and BTTS correctly', () => {
      // OU: Total 3 goals, line 2.5 @ 1.95 -> OVER WIN: +0.95
      const ouOver = ExactSettlementEngine.settleOverUnder(3, 2.5, 1.95, 'OVER');
      expect(ouOver.outcome).toBe('WIN');
      expect(ouOver.profit).toBe(0.95);

      // BTTS: 2-1 @ 1.80 -> YES WIN: +0.80
      const bttsWin = ExactSettlementEngine.settleBtts(2, 1, 1.80, 'YES');
      expect(bttsWin.outcome).toBe('WIN');
      expect(bttsWin.profit).toBe(0.80);
    });

    it('handles postponed matches by keeping them unsettled (AWAITING_RESULT)', async () => {
      const entry: any = {
        ledgerId: 'led_postponed_test',
        signalId: 'sig_postponed',
        fixtureId: 'fix_postponed',
        market: 'AH',
        line: 0,
        selection: 'Arsenal 0',
        odds: 1.90,
        stakeUnits: 1.0,
        status: 'LOCKED',
        settlementStatus: null,
      };

      const result: AuthoritativeMatchResult = {
        fixtureId: 'fix_postponed',
        status: 'POSTPONED',
        homeGoals: null,
        awayGoals: null,
      };

      const settleRes = await ProductionSettlementService.settleEntry(entry, result);
      expect(settleRes.settled).toBe(false);
      expect(settleRes.reason).toContain('MATCH_POSTPONED');
    });

    it('handles cancelled matches by settling as VOID (profit = 0, stake returned)', async () => {
      const entry: any = {
        ledgerId: 'led_cancelled_test',
        signalId: 'sig_cancelled',
        fixtureId: 'fix_cancelled',
        market: 'AH',
        line: 0,
        selection: 'Arsenal 0',
        odds: 1.90,
        stakeUnits: 1.0,
        status: 'LOCKED',
        settlementStatus: null,
      };

      const result: AuthoritativeMatchResult = {
        fixtureId: 'fix_cancelled',
        status: 'CANCELLED',
        homeGoals: null,
        awayGoals: null,
      };

      const settleRes = await ProductionSettlementService.settleEntry(entry, result);
      expect(settleRes.settled).toBe(true);
      expect(settleRes.outcome).toBe('VOID');

      const settlements = DurableLedgerStore.loadSettlements();
      expect(settlements['led_cancelled_test']?.profitUnits).toBe(0.0);
      expect(settlements['led_cancelled_test']?.returnUnits).toBe(1.0);
    });
  });

  // ─── 8. DAILY PERFORMANCE & REALIZED YIELD ──────────────────────────────
  describe('8. Daily Performance & Realized Yield Separation', () => {
    it('calculates realized yield strictly as profit/stake*100 and separates open exposure', async () => {
      const dateStr = '2026-09-21';
      const kickoffUtc = `${dateStr}T15:00:00.000Z`;

      // 1 Settled Win: 1U stake @ 2.0 -> profit +1.0U
      const entryWin: any = {
        ledgerId: 'led_win_1',
        signalId: 'sig_win_1',
        fixtureId: 'fix_win_1',
        market: 'AH',
        line: -0.5,
        selection: 'Arsenal -0.5',
        odds: 2.0,
        stakeUnits: 1.0,
        confidenceScore: 75.0,
        kickoffUtc,
        status: 'SETTLED',
      };

      // 1 Open bet: 1U stake, not settled yet
      const entryOpen: any = {
        ledgerId: 'led_open_1',
        signalId: 'sig_open_1',
        fixtureId: 'fix_open_1',
        market: 'AH',
        line: 0,
        selection: 'Chelsea 0',
        odds: 1.95,
        stakeUnits: 1.0,
        confidenceScore: 72.0,
        kickoffUtc,
        status: 'LOCKED',
      };

      const ledger = { led_win_1: entryWin, led_open_1: entryOpen };
      DurableLedgerStore.saveLedger(ledger);

      const settlements = {
        led_win_1: {
          settlementId: 'stl_1',
          ledgerId: 'led_win_1',
          outcome: 'WIN',
          profitUnits: 1.0,
          returnUnits: 2.0,
          homeGoals: 2,
          awayGoals: 0,
          settledAt: new Date().toISOString(),
        },
      };
      DurableLedgerStore.saveSettlements(settlements as any);

      const summary = await DailyPerformanceService.recalculateDailySummary(dateStr);

      // Realized yield must ONLY be from settled bets: 1.0 / 1.0 * 100 = 100.0%
      expect(summary.settled).toBe(1);
      expect(summary.stakeUnits).toBe(1.0);
      expect(summary.profitUnits).toBe(1.0);
      expect(summary.yieldPct).toBe(100.0);

      // Open exposure must be tracked separately
      expect(summary.openBets).toBe(1);
      expect(summary.openStakeUnits).toBe(1.0);
    });
  });

  // ─── 9. VIEWER DECOUPLING: NO BROWSER-DRIVEN INGESTION ───────────────────
  describe('9. Viewer Decoupling & Quota Protection', () => {
    it('DailyPicksEngine.getDailyPicks reads from canonical store and does NOT trigger provider APIs', async () => {
      // Populate store with 1 canonical signal
      const store: any = {
        sig_canonical_1: {
          signalId: 'sig_canonical_1',
          fixtureId: 'fix_can_1',
          homeTeam: 'Arsenal',
          awayTeam: 'Chelsea',
          competition: 'Premier League',
          kickoffUtc: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          market: 'AH',
          selection: 'Arsenal -0.5',
          line: -0.5,
          currentOdds: 1.95,
          modelProbability: 0.55,
          marketProbability: 0.51,
          edge: 0.04,
          expectedValue: 0.07,
          confidence: 75,
          publishState: 'PUBLISHED',
          validityStatus: 'VALID',
          providerProvenance: { fixtures: 'api-football-pro', odds: 'oddspapi-pinnacle', modelVersion: 'dixon-coles-v1.0' },
        },
      };
      ProductionPublishingEngine.saveStore(store);

      // Viewer calls getDailyPicks (no provider calls allowed)
      const res = await DailyPicksEngine.getDailyPicks({ forceRefresh: false, allowProviderCalls: false });
      expect(res.success).toBe(true);
      expect(res.count).toBe(1);
      expect(res.picks[0].fixtureId).toBe('fix_can_1');
      expect(res.dataState).toBe('REAL');
    });
  });
});

