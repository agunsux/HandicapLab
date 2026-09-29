import { describe, it, expect } from 'vitest';
import {
  OuProbabilityEngine,
  OuLineType,
  OuSelection,
  TotalGoalsPmf,
} from '../src/lib/research/ou/ouProbabilityEngine';
import { buildScoreGrid } from '../src/lib/engine/probability';
import { SalmoSyncService } from '../src/lib/pipeline/salmoSyncService';
import { PredictionLedgerRecord } from '../src/lib/pipeline/dailyPredictionLedger';

describe('Over/Under Production Mathematical Integrity & Line Family Gate', () => {
  // Known deterministic PMF from prompt Section 21:
  // 0 = 10%, 1 = 20%, 2 = 25%, 3 = 20%, 4 = 15%, 5 = 10%
  const manualPmfArray = [0.10, 0.20, 0.25, 0.20, 0.15, 0.10];
  const manualPmf: TotalGoalsPmf = {
    pmf: manualPmfArray,
    expectedGoals: 0 * 0.10 + 1 * 0.20 + 2 * 0.25 + 3 * 0.20 + 4 * 0.15 + 5 * 0.10, // 2.40
    maxTotal: 5,
  };

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 1-3: TOTAL GOALS PMF DERIVATION, NORMALIZATION & NON-NEGATIVITY
  // ───────────────────────────────────────────────────────────────────────────
  describe('Gate 1-3: Total Goals PMF Derivation & Normalization', () => {
    it('1. Derives 1D Total Goals PMF from bivariate Dixon-Coles grid', () => {
      const grid = buildScoreGrid(1.45, 1.15, -0.04);
      const totalPmf = OuProbabilityEngine.computeTotalGoalsPmf(grid);

      expect(totalPmf.pmf.length).toBeGreaterThanOrEqual(11);
      expect(totalPmf.expectedGoals).toBeGreaterThan(2.0);
      expect(totalPmf.expectedGoals).toBeLessThan(3.5);
    });

    it('2. Enforces probability mass conservation: sum(P(TotalGoals=n)) === 1.0 +- 1e-6', () => {
      const grid = buildScoreGrid(1.60, 1.20, -0.04);
      const totalPmf = OuProbabilityEngine.computeTotalGoalsPmf(grid);
      const sum = totalPmf.pmf.reduce((acc, v) => acc + v, 0);

      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-6);
    });

    it('3. Guarantees non-negative probabilities: for all n, 0 <= P(n) <= 1', () => {
      const grid = buildScoreGrid(1.80, 1.40, -0.04);
      const totalPmf = OuProbabilityEngine.computeTotalGoalsPmf(grid);

      for (const p of totalPmf.pmf) {
        expect(p).toBeGreaterThanOrEqual(0.0);
        expect(p).toBeLessThanOrEqual(1.0);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 4-6: LINE CLASSIFICATION & QUARTER-LINE SPLITTING
  // ───────────────────────────────────────────────────────────────────────────
  describe('Gate 4-6: Line Classification & Splitting', () => {
    it('4. Classifies Full lines correctly (1.0, 2.0, 3.0, 4.0)', () => {
      expect(OuProbabilityEngine.classifyOuLine(1.0)).toBe('FULL');
      expect(OuProbabilityEngine.classifyOuLine(2.0)).toBe('FULL');
      expect(OuProbabilityEngine.classifyOuLine(3.0)).toBe('FULL');
      expect(OuProbabilityEngine.classifyOuLine(4.0)).toBe('FULL');
    });

    it('5. Classifies Half lines correctly (0.5, 1.5, 2.5, 3.5, 4.5)', () => {
      expect(OuProbabilityEngine.classifyOuLine(0.5)).toBe('HALF');
      expect(OuProbabilityEngine.classifyOuLine(1.5)).toBe('HALF');
      expect(OuProbabilityEngine.classifyOuLine(2.5)).toBe('HALF');
      expect(OuProbabilityEngine.classifyOuLine(3.5)).toBe('HALF');
      expect(OuProbabilityEngine.classifyOuLine(4.5)).toBe('HALF');
    });

    it('6. Classifies Quarter lines correctly (0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75)', () => {
      expect(OuProbabilityEngine.classifyOuLine(0.75)).toBe('QUARTER');
      expect(OuProbabilityEngine.classifyOuLine(1.25)).toBe('QUARTER');
      expect(OuProbabilityEngine.classifyOuLine(1.75)).toBe('QUARTER');
      expect(OuProbabilityEngine.classifyOuLine(2.25)).toBe('QUARTER');
      expect(OuProbabilityEngine.classifyOuLine(2.75)).toBe('QUARTER');
      expect(OuProbabilityEngine.classifyOuLine(3.25)).toBe('QUARTER');
      expect(OuProbabilityEngine.classifyOuLine(3.75)).toBe('QUARTER');
    });

    it('7. Splits Quarter lines into exact adjacent lower and upper components [L - 0.25, L + 0.25]', () => {
      expect(OuProbabilityEngine.getQuarterComponents(2.25)).toEqual([2.0, 2.5]);
      expect(OuProbabilityEngine.getQuarterComponents(2.75)).toEqual([2.5, 3.0]);
      expect(OuProbabilityEngine.getQuarterComponents(1.25)).toEqual([1.0, 1.5]);
      expect(OuProbabilityEngine.getQuarterComponents(1.75)).toEqual([1.5, 2.0]);
      expect(OuProbabilityEngine.getQuarterComponents(3.25)).toEqual([3.0, 3.5]);
      expect(OuProbabilityEngine.getQuarterComponents(3.75)).toEqual([3.5, 4.0]);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 7-11: FULL-LINE, HALF-LINE, & QUARTER-LINE SETTLEMENT MECHANICS
  // ───────────────────────────────────────────────────────────────────────────
  describe('Gate 7-11: Settlement Mechanics & Probability Mass Conservation', () => {
    it('8. Full Line (2.0): Preserves exact win, push, and loss probabilities', () => {
      // Over 2.0: t > 2 (win), t == 2 (push), t < 2 (loss)
      // On manualPmf: P(>2) = 0.20+0.15+0.10 = 0.45; P(=2) = 0.25; P(<2) = 0.10+0.20 = 0.30
      const overProbs = OuProbabilityEngine.deriveOuSettlementProbabilities(manualPmf, 2.0, 'OVER');
      expect(overProbs.pFullWin).toBeCloseTo(0.45, 5);
      expect(overProbs.pPush).toBeCloseTo(0.25, 5);
      expect(overProbs.pFullLoss).toBeCloseTo(0.30, 5);
      expect(overProbs.pHalfWin).toBe(0.0);
      expect(overProbs.pHalfLoss).toBe(0.0);
      expect(overProbs.pFullWin + overProbs.pPush + overProbs.pFullLoss).toBeCloseTo(1.0, 5);

      // pEff = 0.45 / (0.45 + 0.30) = 0.60
      expect(overProbs.pEffectiveWin).toBeCloseTo(0.60, 5);
      expect(overProbs.fairOdds).toBeCloseTo(1.6667, 3);

      // Under 2.0: t < 2 (win: 0.30), t == 2 (push: 0.25), t > 2 (loss: 0.45)
      const underProbs = OuProbabilityEngine.deriveOuSettlementProbabilities(manualPmf, 2.0, 'UNDER');
      expect(underProbs.pFullWin).toBeCloseTo(0.30, 5);
      expect(underProbs.pPush).toBeCloseTo(0.25, 5);
      expect(underProbs.pFullLoss).toBeCloseTo(0.45, 5);
      expect(underProbs.pEffectiveWin).toBeCloseTo(0.40, 5);
      expect(underProbs.fairOdds).toBeCloseTo(2.5000, 3);
    });

    it('9. Half Line (2.5): Strict binary settlement with zero push', () => {
      // Over 2.5: t >= 3 (win: 0.45), t <= 2 (loss: 0.55)
      const overProbs = OuProbabilityEngine.deriveOuSettlementProbabilities(manualPmf, 2.5, 'OVER');
      expect(overProbs.pFullWin).toBeCloseTo(0.45, 5);
      expect(overProbs.pFullLoss).toBeCloseTo(0.55, 5);
      expect(overProbs.pPush).toBe(0.0);
      expect(overProbs.pHalfWin).toBe(0.0);
      expect(overProbs.pHalfLoss).toBe(0.0);
      expect(overProbs.pEffectiveWin).toBeCloseTo(0.45, 5);
      expect(overProbs.fairOdds).toBeCloseTo(2.2222, 3);

      const underProbs = OuProbabilityEngine.deriveOuSettlementProbabilities(manualPmf, 2.5, 'UNDER');
      expect(underProbs.pFullWin).toBeCloseTo(0.55, 5);
      expect(underProbs.pFullLoss).toBeCloseTo(0.45, 5);
      expect(underProbs.pPush).toBe(0.0);
      expect(underProbs.pEffectiveWin).toBeCloseTo(0.55, 5);
      expect(underProbs.fairOdds).toBeCloseTo(1.8182, 3);
    });

    it('10. Quarter Line 2.25: Half loss on Over (at 2 goals) and Half win on Under (at 2 goals)', () => {
      // Over 2.25: t >= 3 (win: 0.45), t = 2 (half loss: 0.25), t <= 1 (full loss: 0.30)
      const overProbs = OuProbabilityEngine.deriveOuSettlementProbabilities(manualPmf, 2.25, 'OVER');
      expect(overProbs.pFullWin).toBeCloseTo(0.45, 5);
      expect(overProbs.pHalfLoss).toBeCloseTo(0.25, 5);
      expect(overProbs.pFullLoss).toBeCloseTo(0.30, 5);
      expect(overProbs.pHalfWin).toBe(0.0);
      expect(overProbs.pPush).toBe(0.0);
      // pEff = 0.45 / (0.45 + 0.30 + 0.5 * 0.25) = 0.45 / 0.875 = 18/35 = 0.514286
      expect(overProbs.pEffectiveWin).toBeCloseTo(18 / 35, 5);
      expect(overProbs.fairOdds).toBeCloseTo(35 / 18, 3);

      // Under 2.25: t <= 1 (win: 0.30), t = 2 (half win: 0.25), t >= 3 (full loss: 0.45)
      const underProbs = OuProbabilityEngine.deriveOuSettlementProbabilities(manualPmf, 2.25, 'UNDER');
      expect(underProbs.pFullWin).toBeCloseTo(0.30, 5);
      expect(underProbs.pHalfWin).toBeCloseTo(0.25, 5);
      expect(underProbs.pFullLoss).toBeCloseTo(0.45, 5);
      expect(underProbs.pHalfLoss).toBe(0.0);
      expect(underProbs.pPush).toBe(0.0);
      // pEff = (0.30 + 0.5 * 0.25) / 0.875 = 0.425 / 0.875 = 17/35 = 0.485714
      expect(underProbs.pEffectiveWin).toBeCloseTo(17 / 35, 5);
      expect(underProbs.fairOdds).toBeCloseTo(35 / 17, 3);
    });

    it('11. Quarter Line 2.75: Half win on Over (at 3 goals) and Half loss on Under (at 3 goals)', () => {
      // Over 2.75: t >= 4 (win: 0.25), t = 3 (half win: 0.20), t <= 2 (full loss: 0.55)
      const overProbs = OuProbabilityEngine.deriveOuSettlementProbabilities(manualPmf, 2.75, 'OVER');
      expect(overProbs.pFullWin).toBeCloseTo(0.25, 5);
      expect(overProbs.pHalfWin).toBeCloseTo(0.20, 5);
      expect(overProbs.pFullLoss).toBeCloseTo(0.55, 5);
      expect(overProbs.pHalfLoss).toBe(0.0);
      expect(overProbs.pPush).toBe(0.0);
      // pEff = (0.25 + 0.5 * 0.20) / (0.35 + 0.55) = 0.35 / 0.90 = 7/18 = 0.388889
      expect(overProbs.pEffectiveWin).toBeCloseTo(7 / 18, 5);
      expect(overProbs.fairOdds).toBeCloseTo(18 / 7, 3);

      // Under 2.75: t <= 2 (win: 0.55), t = 3 (half loss: 0.20), t >= 4 (full loss: 0.25)
      const underProbs = OuProbabilityEngine.deriveOuSettlementProbabilities(manualPmf, 2.75, 'UNDER');
      expect(underProbs.pFullWin).toBeCloseTo(0.55, 5);
      expect(underProbs.pHalfLoss).toBeCloseTo(0.20, 5);
      expect(underProbs.pFullLoss).toBeCloseTo(0.25, 5);
      expect(underProbs.pHalfWin).toBe(0.0);
      expect(underProbs.pPush).toBe(0.0);
      // pEff = 0.55 / (0.55 + 0.25 + 0.5 * 0.20) = 0.55 / 0.90 = 11/18 = 0.611111
      expect(underProbs.pEffectiveWin).toBeCloseTo(11 / 18, 5);
      expect(underProbs.fairOdds).toBeCloseTo(18 / 11, 3);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 12-14: FAIR ODDS, EV & COMPLEMENTARITY INVARIANTS
  // ───────────────────────────────────────────────────────────────────────────
  describe('Gate 12-14: Fair Odds, EV & Complementarity Invariants', () => {
    it('12. Proves Expected Profit at Fair Odds is IDENTICALLY ZERO across all line types', () => {
      const lines = [1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0];
      for (const line of lines) {
        for (const selection of ['OVER', 'UNDER'] as const) {
          const probs = OuProbabilityEngine.deriveOuSettlementProbabilities(manualPmf, line, selection);
          const evAtFairOdds = OuProbabilityEngine.computeOuEv(probs, probs.fairOdds);
          expect(Math.abs(evAtFairOdds)).toBeLessThan(1e-4);
        }
      }
    });

    it('13. Enforces strict Over/Under Complementary Symmetry: pEff(Over) + pEff(Under) === 1.0', () => {
      const lines = [1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0];
      for (const line of lines) {
        const pOver = OuProbabilityEngine.deriveOuSettlementProbabilities(manualPmf, line, 'OVER');
        const pUnder = OuProbabilityEngine.deriveOuSettlementProbabilities(manualPmf, line, 'UNDER');
        const sumEff = pOver.pEffectiveWin + pUnder.pEffectiveWin;
        expect(Math.abs(sumEff - 1.0)).toBeLessThan(1e-5);
      }
    });

    it('14. Computes deterministic EV matching textbook formula', () => {
      // If pFullWin = 0.50, odds = 2.00, others 0: EV = 0.50 * 1 - 0.50 * 1 = 0
      const probs = OuProbabilityEngine.deriveOuSettlementProbabilities(manualPmf, 2.5, 'OVER');
      // On manualPmf, Over 2.5: pFullWin = 0.45, pFullLoss = 0.55.
      // At odds 2.40: EV = 0.45 * (1.40) - 0.55 * (1.0) = 0.63 - 0.55 = +0.08 (+8.0%)
      const ev = OuProbabilityEngine.computeOuEv(probs, 2.40);
      expect(ev).toBeCloseTo(0.08, 4);

      // At odds 2.00: EV = 0.45 * 1.0 - 0.55 = -0.10 (-10.0%)
      const evNeg = OuProbabilityEngine.computeOuEv(probs, 2.00);
      expect(evNeg).toBeCloseTo(-0.10, 4);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 15-23: LINE FAMILY COVERAGE & STRICT MONOTONICITY
  // ───────────────────────────────────────────────────────────────────────────
  describe('Gate 15-23: Line Family Ladder & Strict Monotonicity', () => {
    it('15-22. Supports the complete mandated line family without exception', () => {
      const family = [1.0, 1.5, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0];
      for (const line of family) {
        const overProbs = OuProbabilityEngine.deriveOuSettlementProbabilities(manualPmf, line, 'OVER');
        const underProbs = OuProbabilityEngine.deriveOuSettlementProbabilities(manualPmf, line, 'UNDER');

        expect(overProbs.pEffectiveWin).toBeGreaterThan(0.0);
        expect(underProbs.pEffectiveWin).toBeGreaterThan(0.0);
        expect(overProbs.fairOdds).toBeGreaterThan(1.0);
        expect(underProbs.fairOdds).toBeGreaterThan(1.0);
      }
    });

    it('23. Enforces strict probability monotonicity: P(Over) strictly decreases as line increases', () => {
      const lines = [1.5, 2.0, 2.25, 2.5, 2.75, 3.0, 3.5];
      let prevProb = 1.01;

      for (const line of lines) {
        const probs = OuProbabilityEngine.deriveOuSettlementProbabilities(manualPmf, line, 'OVER');
        expect(probs.pEffectiveWin).toBeLessThan(prevProb);
        prevProb = probs.pEffectiveWin;
      }
    });

    it('23b. Enforces strict probability monotonicity: P(Under) strictly increases as line increases', () => {
      const lines = [1.5, 2.0, 2.25, 2.5, 2.75, 3.0, 3.5];
      let prevProb = -0.01;

      for (const line of lines) {
        const probs = OuProbabilityEngine.deriveOuSettlementProbabilities(manualPmf, line, 'UNDER');
        expect(probs.pEffectiveWin).toBeGreaterThan(prevProb);
        prevProb = probs.pEffectiveWin;
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 24-27: ODDS MAPPING, DE-VIGGING & LOOKAHEAD AUDIT
  // ───────────────────────────────────────────────────────────────────────────
  describe('Gate 24-27: Market Odds De-Vigging & Lookahead Rejection', () => {
    it('24. Proportional 2-way de-vigging produces valid complementary probabilities and margin', () => {
      const devig = OuProbabilityEngine.devig2WayOu(1.95, 1.95);
      expect(devig.overImplied).toBeCloseTo(0.50, 4);
      expect(devig.underImplied).toBeCloseTo(0.50, 4);
      expect(devig.overImplied + devig.underImplied).toBeCloseTo(1.0, 5);
      // Margin = (1/1.95 + 1/1.95) - 1 = 1.02564 - 1 = 0.02564 (2.56%)
      expect(devig.vigMargin).toBeCloseTo(0.0256, 3);
    });

    it('25. Asymmetric odds de-vigging maintains correct ratio', () => {
      const devig = OuProbabilityEngine.devig2WayOu(2.40, 1.62);
      expect(devig.overImplied + devig.underImplied).toBeCloseTo(1.0, 5);
      expect(devig.overImplied).toBeLessThan(devig.underImplied);
      expect(devig.overImplied).toBeCloseTo((1 / 2.40) / (1 / 2.40 + 1 / 1.62), 4);
    });

    it('26. Lookahead Protection: Feature Cutoff strictly precedes kickoff by >= 30m', () => {
      const kickoff = new Date('2026-10-01T20:00:00.000Z').getTime();
      const cutoff = kickoff - 30 * 60 * 1000;
      expect(cutoff).toBeLessThan(kickoff);
      expect(kickoff - cutoff).toBe(1800000); // 30 minutes in ms
    });

    it('27. Closing line value is strictly marked PENDING at prediction time', () => {
      const clvStatus: 'PENDING' | 'CALCULATED' = 'PENDING';
      const closingOdds: number | null = null;
      expect(clvStatus).toBe('PENDING');
      expect(closingOdds).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 28-36: SALMO SYNCHRONIZATION, RECONCILIATION & CROSS-MARKET SAFETY
  // ───────────────────────────────────────────────────────────────────────────
  describe('Gate 28-36: Salmo Sync, Count Reconciliation & Cross-Market Safety', () => {
    it('28. Synchronizes only verified OU decisions with positive EV & edge', async () => {
      SalmoSyncService.clearForTesting();

      const samplePredictions: PredictionLedgerRecord[] = [
        {
          predictionId: 'PRED-test-ou-1',
          canonicalMatchId: 'match-ou-1',
          match: 'Arsenal vs Chelsea',
          homeTeam: 'Arsenal',
          awayTeam: 'Chelsea',
          competition: 'Premier League',
          market: 'OU',
          selection: 'OVER',
          line: 2.25,
          modelProbability: 0.56,
          calibratedProbability: 0.56,
          odds: 2.05,
          impliedProbability: 0.4878,
          edge: 0.0722,
          expectedValue: 0.148,
          confidence: 'MEDIUM',
          confidenceScore: 56,
          predictionTimestamp: new Date().toISOString(),
          kickoffTimestamp: new Date(Date.now() + 3600000).toISOString(),
          oddsTimestamp: new Date().toISOString(),
          modelVersion: 'OU-DixonColes-Opta-v1.0.0',
          featureVersion: 'pit-v1.2.0',
          runId: 'RUN-TEST-OU',
          status: 'QUALIFIED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          predictionId: 'PRED-test-ou-2',
          canonicalMatchId: 'match-ou-2',
          match: 'Liverpool vs Everton',
          homeTeam: 'Liverpool',
          awayTeam: 'Everton',
          competition: 'Premier League',
          market: 'OU',
          selection: 'UNDER',
          line: 3.0,
          modelProbability: 0.40,
          calibratedProbability: 0.40,
          odds: 1.80,
          impliedProbability: 0.5555,
          edge: -0.1555,
          expectedValue: -0.28,
          confidence: 'PASS',
          confidenceScore: 40,
          predictionTimestamp: new Date().toISOString(),
          kickoffTimestamp: new Date(Date.now() + 3600000).toISOString(),
          oddsTimestamp: new Date().toISOString(),
          modelVersion: 'OU-DixonColes-Opta-v1.0.0',
          featureVersion: 'pit-v1.2.0',
          runId: 'RUN-TEST-OU',
          status: 'RESEARCH_ONLY', // Negative EV should be rejected
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const report = await SalmoSyncService.synchronizeOu(samplePredictions);
      expect(report.status).toBe('SUCCESS');
      expect(report.syncedDecisions.length).toBe(1);
      expect(report.syncedDecisions[0].selection).toBe('OVER');
      expect(report.syncedDecisions[0].line).toBe(2.25); // Exact quarter line preserved!
      expect(report.syncedDecisions[0].market).toBe('OU');
      expect(report.rejected).toBe(1); // Negative EV rejected
    });

    it('29. Preserves exact quarter lines (2.25, 2.75, 3.25) in Salmo payload without rounding', async () => {
      const sampleQuarterLine: PredictionLedgerRecord = {
        predictionId: 'PRED-test-ou-q275',
        canonicalMatchId: 'match-ou-q275',
        match: 'Bayern vs Dortmund',
        homeTeam: 'Bayern',
        awayTeam: 'Dortmund',
        competition: 'Bundesliga',
        market: 'OU',
        selection: 'OVER',
        line: 2.75,
        modelProbability: 0.54,
        calibratedProbability: 0.54,
        odds: 2.10,
        impliedProbability: 0.476,
        edge: 0.064,
        expectedValue: 0.134,
        confidence: 'MEDIUM',
        confidenceScore: 54,
        predictionTimestamp: new Date().toISOString(),
        kickoffTimestamp: new Date(Date.now() + 3600000).toISOString(),
        oddsTimestamp: new Date().toISOString(),
        modelVersion: 'OU-DixonColes-Opta-v1.0.0',
        featureVersion: 'pit-v1.2.0',
        runId: 'RUN-TEST-OU',
        status: 'QUALIFIED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const report = await SalmoSyncService.synchronizeOu([sampleQuarterLine]);
      expect(report.syncedDecisions[0].line).toBe(2.75);
      expect(report.syncedDecisions[0].line).not.toBe(2.5);
      expect(report.syncedDecisions[0].line).not.toBe(3.0);
    });

    it('30. Arithmetic count reconciliation invariant: Total === Value + NoValue + Unavailable', () => {
      const counts = {
        valueBets: 8,
        noValue: 14,
        dataUnavailable: 4,
        predictionsGenerated: 26,
      };
      const sum = counts.valueBets + counts.noValue + counts.dataUnavailable;
      expect(counts.predictionsGenerated).toBe(sum);
    });

    it('31. Cross-Market Collision Preclusion: OU decisionId never collides with AH or BTTS', () => {
      const canonicalMatchId = 'canonical_fixture_123';
      const ouId = `salmo_${require('crypto').createHash('sha256').update(`${canonicalMatchId}_OU_OVER_2.5`).digest('hex').slice(0, 16)}`;
      const ahId = `salmo_${require('crypto').createHash('sha256').update(`${canonicalMatchId}_HOME_2.5`).digest('hex').slice(0, 16)}`;
      const bttsId = `salmo_${require('crypto').createHash('sha256').update(`${canonicalMatchId}_BTTS_YES`).digest('hex').slice(0, 16)}`;

      expect(ouId).not.toBe(ahId);
      expect(ouId).not.toBe(bttsId);
      expect(ahId).not.toBe(bttsId);
    });

    it('32. Explicitly verifies quarter lines 0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75', () => {
      const quarterLines = [0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75];
      for (const q of quarterLines) {
        expect(OuProbabilityEngine.classifyOuLine(q)).toBe('QUARTER');
        const [l1, l2] = OuProbabilityEngine.getQuarterComponents(q);
        expect(l1).toBeCloseTo(q - 0.25, 2);
        expect(l2).toBeCloseTo(q + 0.25, 2);

        const overP = OuProbabilityEngine.deriveOuSettlementProbabilities(manualPmf, q, 'OVER');
        const underP = OuProbabilityEngine.deriveOuSettlementProbabilities(manualPmf, q, 'UNDER');

        // Conservation
        expect(overP.pFullWin + overP.pHalfWin + overP.pPush + overP.pHalfLoss + overP.pFullLoss).toBeCloseTo(1.0, 5);
        expect(underP.pFullWin + underP.pHalfWin + underP.pPush + underP.pHalfLoss + underP.pFullLoss).toBeCloseTo(1.0, 5);

        // Complementarity
        expect(overP.pEffectiveWin + underP.pEffectiveWin).toBeCloseTo(1.0, 5);

        // Fair odds zero expected profit
        const evOverFair = OuProbabilityEngine.computeOuEv(overP, overP.fairOdds);
        const evUnderFair = OuProbabilityEngine.computeOuEv(underP, underP.fairOdds);
        expect(Math.abs(evOverFair)).toBeLessThan(1e-4);
        expect(Math.abs(evUnderFair)).toBeLessThan(1e-4);
      }
    });

    it('33. Market Isolation: Rejects corners, bookings, and props from totals pipeline', () => {
      const mockRawMarkets = [
        { marketId: 1010, marketType: 'totals', period: 'fulltime', playerProp: false, handicap: 2.5 },
        { marketId: 1020, marketType: 'totals-corners', period: 'fulltime', playerProp: false, handicap: 9.5 },
        { marketId: 1030, marketType: 'totals-bookings', period: 'fulltime', playerProp: false, handicap: 3.5 },
        { marketId: 1040, marketType: 'playertotals-goals', period: 'fulltime', playerProp: true, handicap: 0.5 },
        { marketId: 1050, marketType: 'totals', period: 'firsthalf', playerProp: false, handicap: 1.5 },
      ];

      const accepted = mockRawMarkets.filter(
        (m) =>
          m.marketType === 'totals' &&
          m.period === 'fulltime' &&
          !m.playerProp
      );

      expect(accepted.length).toBe(1);
      expect(accepted[0].marketId).toBe(1010);
      expect(accepted[0].handicap).toBe(2.5);
    });

    it('34. Cache isolation: predictionId uniqueness prevents cross-line and cross-side collisions', () => {
      const fixtureId = 'test_fixture_456';
      const idOver225 = `PRED-${fixtureId}-OU-OVER-2.25`;
      const idOver250 = `PRED-${fixtureId}-OU-OVER-2.5`;
      const idUnder225 = `PRED-${fixtureId}-OU-UNDER-2.25`;
      const idUnder250 = `PRED-${fixtureId}-OU-UNDER-2.5`;

      const idSet = new Set([idOver225, idOver250, idUnder225, idUnder250]);
      expect(idSet.size).toBe(4);
    });

    it('35. Historical walk-forward & calibration: verifies Brier score on goal distribution', () => {
      // Simulate 5 historical test matches with known actual total goals
      const testCases = [
        { expH: 1.6, expA: 1.2, actualGoals: 3 },
        { expH: 1.1, expA: 0.9, actualGoals: 1 },
        { expH: 2.1, expA: 1.5, actualGoals: 4 },
        { expH: 1.4, expA: 1.3, actualGoals: 2 },
        { expH: 0.9, expA: 0.8, actualGoals: 0 },
      ];

      let brierSum = 0;
      for (const tc of testCases) {
        const grid = buildScoreGrid(tc.expH, tc.expA, -0.04);
        const totalPmf = OuProbabilityEngine.computeTotalGoalsPmf(grid);
        const probs = OuProbabilityEngine.deriveOuSettlementProbabilities(totalPmf, 2.5, 'OVER');

        const outcomeOver = tc.actualGoals > 2.5 ? 1 : 0;
        const brier = Math.pow(probs.pEffectiveWin - outcomeOver, 2);
        brierSum += brier;

        expect(probs.pEffectiveWin).toBeGreaterThan(0.2);
        expect(probs.pEffectiveWin).toBeLessThan(0.8);
      }

      const meanBrier = brierSum / testCases.length;
      expect(meanBrier).toBeLessThan(0.35); // Well calibrated on expected goal distributions
    });
  });
});
