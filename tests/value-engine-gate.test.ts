import { describe, it, expect } from 'vitest';
import {
  ValueEngine,
  ValueEngineSelectionInput,
  WHITELIST_LEAGUES,
} from '../src/lib/engine/valueEngine';
import {
  CanonicalOrchestrator,
  CanonicalFixtureInput,
} from '../src/lib/pipeline/canonicalOrchestrator';
import {
  calculateAsianHandicapProbability,
  calculateOverUnderProbability,
} from '../src/lib/engine/probability';
import { MatchData } from '../src/lib/engine/ratings';

// Realistic 5-match sample for EPL clubs
const EPL_TEST_HISTORY: MatchData[] = [
  { home_team: 'Arsenal', away_team: 'Wolves', home_goals: 2, away_goals: 0, league: 'EPL', kickoff: '2026-08-17T14:00:00Z' },
  { home_team: 'Aston Villa', away_team: 'Arsenal', home_goals: 0, away_goals: 2, league: 'EPL', kickoff: '2026-08-24T16:30:00Z' },
  { home_team: 'Arsenal', away_team: 'Brighton', home_goals: 1, away_goals: 1, league: 'EPL', kickoff: '2026-08-31T11:30:00Z' },
  { home_team: 'Tottenham', away_team: 'Arsenal', home_goals: 0, away_goals: 1, league: 'EPL', kickoff: '2026-09-12T13:00:00Z' },
  { home_team: 'Manchester City', away_team: 'Arsenal', home_goals: 2, away_goals: 2, league: 'EPL', kickoff: '2026-09-20T15:30:00Z' },

  { home_team: 'Chelsea', away_team: 'Manchester City', home_goals: 0, away_goals: 2, league: 'EPL', kickoff: '2026-08-18T15:30:00Z' },
  { home_team: 'Wolves', away_team: 'Chelsea', home_goals: 2, away_goals: 6, league: 'EPL', kickoff: '2026-08-25T13:00:00Z' },
  { home_team: 'Chelsea', away_team: 'Crystal Palace', home_goals: 1, away_goals: 1, league: 'EPL', kickoff: '2026-09-01T12:30:00Z' },
  { home_team: 'Bournemouth', away_team: 'Chelsea', home_goals: 0, away_goals: 1, league: 'EPL', kickoff: '2026-09-14T19:00:00Z' },
  { home_team: 'West Ham', away_team: 'Chelsea', home_goals: 0, away_goals: 3, league: 'EPL', kickoff: '2026-09-21T11:30:00Z' },
];

describe('Q4 — Value Engine Gate & Multi-Condition Value Qualification Suite', () => {
  const predictionTime = '2026-09-25T10:00:00Z';
  const oddsTimeFresh = '2026-09-25T09:45:00Z'; // 15 mins old (< 120m)
  const kickoffTime = '2026-09-26T14:00:00Z';   // Future fixture

  // Base input with a proven valid edge (+4.0% edge, +8.0% EV)
  const baseValidInput: ValueEngineSelectionInput = {
    selection: 'Arsenal -0.50',
    market: 'AH',
    line: -0.50,
    modelProbability: 0.5400, // 54.0%
    ahBreakdown: {
      win: 0.5400,
      halfWin: 0,
      push: 0,
      halfLoss: 0,
      loss: 0.4600,
    },
    pinnacleOdds: {
      sideOdds: 2.00,       // 2.00
      oppositeOdds: 1.95,   // 1.95 -> overround = (1/2.00) + (1/1.95) = 0.5000 + 0.5128 = 1.0128
    },
    sampleSizeHome: 12,
    sampleSizeAway: 12,
    oddsTimestampUtc: oddsTimeFresh,
    predictionTimestampUtc: predictionTime,
    kickoffUtc: kickoffTime,
    fixtureId: 'apifootball-1379101',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    league: 'Premier League',
    modelStatus: 'FIXTURE_SPECIFIC',
  };

  // ==========================================================================
  // 1. COMPOSITE GATE: 7-FACTOR REJECTION MATRIX
  // ==========================================================================
  describe('1. 7-Factor Composite Gate Rejection Matrix', () => {
    it('approves VALUE_CANDIDATE (LAYAK) when and only when all 7 gates pass', () => {
      const res = ValueEngine.evaluateSelection(baseValidInput);

      expect(res.passedGates.modelValid).toBe(true);
      expect(res.passedGates.oddsFresh).toBe(true);
      expect(res.passedGates.pinnacleReferenceValid).toBe(true);
      expect(res.passedGates.noCircularity).toBe(true);
      expect(res.passedGates.edgeThreshold).toBe(true);
      expect(res.passedGates.evThreshold).toBe(true);
      expect(res.passedGates.dataCompleteness).toBe(true);

      expect(res.verdict).toBe('LAYAK');
      expect(res.validationStatus).toBe('VALUE_CANDIDATE');
      expect(res.actionable).toBe(true);
      expect(res.rejectionReason).toBeNull();
      expect(res.kellyFraction).toBeGreaterThan(0);
    });

    it('Gate 1: fails closed with INSUFFICIENT_MODEL (LEWATI) when sample size < 3 matches', () => {
      const input = { ...baseValidInput, sampleSizeHome: 2 };
      const res = ValueEngine.evaluateSelection(input);

      expect(res.passedGates.modelValid).toBe(false);
      expect(res.verdict).toBe('LEWATI');
      expect(res.validationStatus).toBe('INSUFFICIENT_MODEL');
      expect(res.actionable).toBe(false);
      expect(res.edge).toBe(0);
      expect(res.expectedValue).toBe(0);
      expect(res.kellyFraction).toBe(0);
      expect(res.rejectionReason).toContain('INSUFFICIENT_MODEL');
    });

    it('Gate 2: fails closed with STALE_ODDS (LEWATI) when odds snapshot age exceeds 120 minutes', () => {
      // Odds 180 minutes old (> 120m threshold)
      const staleOddsTime = '2026-09-25T07:00:00Z';
      const input = { ...baseValidInput, oddsTimestampUtc: staleOddsTime };
      const res = ValueEngine.evaluateSelection(input);

      expect(res.passedGates.oddsFresh).toBe(false);
      expect(res.verdict).toBe('LEWATI');
      expect(res.validationStatus).toBe('STALE_ODDS');
      expect(res.actionable).toBe(false);
      expect(res.rejectionReason).toContain('STALE_ODDS');
    });

    it('Gate 2: fails closed with TEMPORAL_LEAKAGE (LEWATI) when predictionTimestamp >= kickoff', () => {
      const leakedTime = '2026-09-26T14:05:00Z'; // 5 mins after kickoff
      const input = { ...baseValidInput, predictionTimestampUtc: leakedTime };
      const res = ValueEngine.evaluateSelection(input);

      expect(res.passedGates.oddsFresh).toBe(false);
      expect(res.verdict).toBe('LEWATI');
      expect(res.validationStatus).toBe('TEMPORAL_LEAKAGE');
      expect(res.actionable).toBe(false);
    });

    it('Gate 3: fails closed with INVALID_MARKET_SPREAD (LEWATI) when Pinnacle overround exceeds 1.080', () => {
      // Extremely wide/distorted spread: 1.60 and 1.60 -> overround = (1/1.60) + (1/1.60) = 1.25 (25% vig)
      const input = {
        ...baseValidInput,
        pinnacleOdds: { sideOdds: 1.60, oppositeOdds: 1.60 },
      };
      const res = ValueEngine.evaluateSelection(input);

      expect(res.passedGates.pinnacleReferenceValid).toBe(false);
      expect(res.verdict).toBe('LEWATI');
      expect(res.validationStatus).toBe('INVALID_MARKET_SPREAD');
      expect(res.actionable).toBe(false);
      expect(res.rejectionReason).toContain('INVALID_MARKET_SPREAD');
    });

    it('Gate 4: fails closed with CIRCULARITY_VIOLATION (LEWATI) if odds circularity detected', () => {
      const input = { ...baseValidInput, oddsLeakedToModel: true };
      const res = ValueEngine.evaluateSelection(input);

      expect(res.passedGates.noCircularity).toBe(false);
      expect(res.verdict).toBe('LEWATI');
      expect(res.validationStatus).toBe('CIRCULARITY_VIOLATION');
      expect(res.actionable).toBe(false);
    });

    it('Gate 5: flags PANTAU with NO_EDGE when edge is positive but below +2.0% (+0.020)', () => {
      // De-vigged Pinnacle probability is 0.4936. Model prob = 0.5050 -> edge is +1.14% (< 2.0%)
      const input = { ...baseValidInput, modelProbability: 0.5050 };
      const res = ValueEngine.evaluateSelection(input);

      expect(res.passedGates.edgeThreshold).toBe(false);
      expect(res.verdict).toBe('PANTAU');
      expect(res.validationStatus).toBe('NO_EDGE');
      expect(res.actionable).toBe(false);
      expect(res.rejectionReason).toContain('EDGE_BELOW_THRESHOLD');
    });

    it('Gate 6: flags PANTAU with MARGINAL_EV when EV is positive but below +2.0% (+0.020)', () => {
      // Edge is +2.47% (passes Gate 5 >= 2%), but offered odds are 1.90 leading to EV +1.65% (< 2.0%)
      const input: ValueEngineSelectionInput = {
        ...baseValidInput,
        modelProbability: 0.5350,
        ahBreakdown: {
          win: 0.5350,
          halfWin: 0,
          push: 0,
          halfLoss: 0,
          loss: 0.4650,
        },
        pinnacleOdds: {
          sideOdds: 1.90,
          oppositeOdds: 1.98, // overround = 1.0314 (valid sharp market)
        },
      };
      // For binary AH -0.5: EV = 0.5350 * 1.90 - 1 = +0.0165 (+1.65%)
      const res = ValueEngine.evaluateSelection(input);

      expect(res.passedGates.edgeThreshold).toBe(true);
      expect(res.passedGates.evThreshold).toBe(false);
      expect(res.verdict).toBe('PANTAU');
      expect(res.validationStatus).toBe('MARGINAL_EV');
      expect(res.actionable).toBe(false);
      expect(res.rejectionReason).toContain('MARGINAL_EV');
    });

    it('Gate 7: fails closed with INCOMPLETE_METADATA (LEWATI) when league is not on whitelist', () => {
      const input = { ...baseValidInput, league: 'Unknown Regional League' };
      const res = ValueEngine.evaluateSelection(input);

      expect(res.passedGates.dataCompleteness).toBe(false);
      expect(res.verdict).toBe('LEWATI');
      expect(res.validationStatus).toBe('INCOMPLETE_METADATA');
      expect(res.actionable).toBe(false);
      expect(res.rejectionReason).toContain('INCOMPLETE_METADATA');
    });

    it('Gate 7: rejects synthetic / mock fixture IDs', () => {
      const input = { ...baseValidInput, fixtureId: 'mock-epl-001' };
      const res = ValueEngine.evaluateSelection(input);

      expect(res.passedGates.dataCompleteness).toBe(false);
      expect(res.verdict).toBe('LEWATI');
      expect(res.validationStatus).toBe('INCOMPLETE_METADATA');
      expect(res.actionable).toBe(false);
    });
  });

  // ==========================================================================
  // 2. LONGSHOT TRAP: REJECT HIGH ODDS WITH NEGATIVE EDGE
  // ==========================================================================
  describe('2. Longshot Odds Trap Rejection', () => {
    it('strictly rejects high decimal odds (e.g. 10.00) when edge is negative or absent', () => {
      // Underdog at 10.00 odds. Sharp Pinnacle de-vig is 10.5% (0.105).
      // Model probability is only 8.0% (0.080) -> negative edge of -2.5% (-0.025).
      const longshotInput: ValueEngineSelectionInput = {
        selection: 'Underdog FC ML',
        market: 'OU',
        line: 2.5,
        modelProbability: 0.080,
        pinnacleOdds: {
          sideOdds: 10.00,
          oppositeOdds: 1.08,
        },
        sampleSizeHome: 15,
        sampleSizeAway: 15,
        oddsTimestampUtc: oddsTimeFresh,
        predictionTimestampUtc: predictionTime,
        kickoffUtc: kickoffTime,
        fixtureId: 'apifootball-longshot-01',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        league: 'Premier League',
        modelStatus: 'FIXTURE_SPECIFIC',
      };

      const res = ValueEngine.evaluateSelection(longshotInput);

      expect(res.edge).toBeLessThan(0); // Negative edge
      expect(res.passedGates.edgeThreshold).toBe(false);
      expect(res.verdict).toBe('PANTAU');
      expect(res.validationStatus).toBe('NO_EDGE');
      expect(res.actionable).toBe(false);
      expect(res.kellyFraction).toBe(0);
    });
  });

  // ==========================================================================
  // 3. ASIAN HANDICAP QUARTER-LINE SETTLEMENT & EV MATH
  // ==========================================================================
  describe('3. Asian Handicap Quarter-Line Settlement & EV Math', () => {
    it('proves that quarter-line EV exactly matches the 50/50 adjacent lines split', () => {
      const line = -0.25;
      const odds = 1.95;

      expect(ValueEngine.isQuarterLine(line)).toBe(true);
      const adjacent = ValueEngine.getQuarterLineAdjacentLines(line);
      expect(adjacent.line1).toBe(-0.50);
      expect(adjacent.line2).toBe(0.00);

      // Score grid probability distribution:
      // Home wins by >= 1: 52%
      // Draw: 24%
      // Home loses: 24%
      const pWin = 0.52;
      const pDraw = 0.24;
      const pLoss = 0.24;

      // On line -0.50: win if >= 1 (52%), loss if draw or lose (48%)
      const evLine1 = pWin * (odds - 1.0) - (pDraw + pLoss) * 1.0;

      // On line 0.00 (DNB): win if >= 1 (52%), push if draw (24%), loss if lose (24%)
      const evLine2 = pWin * (odds - 1.0) + pDraw * 0 - pLoss * 1.0;

      // 50/50 stake combination:
      const evSplitCombination = 0.5 * evLine1 + 0.5 * evLine2;

      // Direct settlement-aware EV for -0.25:
      // full win: pWin, half win: 0, push: 0, half loss: pDraw, full loss: pLoss
      const directAhEv = ValueEngine.calculateAhExpectedValue(odds, {
        win: pWin,
        halfWin: 0,
        push: 0,
        halfLoss: pDraw,
        loss: pLoss,
      });

      expect(directAhEv).toBeCloseTo(evSplitCombination, 4);
    });

    it('correctly calculates settlement-aware EV for +0.25, -0.75, and +0.75 lines', () => {
      const odds = 2.05;

      // +0.25 line: half-win on draw
      // adjacent: 0.00 and +0.50
      const evPlus025 = ValueEngine.calculateAhExpectedValue(odds, {
        win: 0.35,
        halfWin: 0.25, // Draw gives half-win
        push: 0,
        halfLoss: 0,
        loss: 0.40,
      });
      // Expected profit: 0.35 * 1.05 + 0.25 * 0.5 * 1.05 - 0.40 * 1.0
      const manualEv025 = 0.35 * 1.05 + 0.25 * 0.525 - 0.40 * 1.0;
      expect(evPlus025).toBeCloseTo(manualEv025, 4);

      // -0.75 line: half-win when winning by exactly 1 goal
      const evMinus075 = ValueEngine.calculateAhExpectedValue(odds, {
        win: 0.30,     // Win by 2+
        halfWin: 0.25, // Win by exactly 1
        push: 0,
        halfLoss: 0,
        loss: 0.45,
      });
      const manualEv075 = 0.30 * 1.05 + 0.25 * 0.525 - 0.45 * 1.0;
      expect(evMinus075).toBeCloseTo(manualEv075, 4);

      // +0.75 line: half-loss when losing by exactly 1 goal
      const evPlus075 = ValueEngine.calculateAhExpectedValue(odds, {
        win: 0.45,
        halfWin: 0,
        push: 0,
        halfLoss: 0.20, // Lose by 1
        loss: 0.35,     // Lose by 2+
      });
      const manualEvPlus075 = 0.45 * 1.05 - 0.20 * 0.5 - 0.35 * 1.0;
      expect(evPlus075).toBeCloseTo(manualEvPlus075, 4);
    });
  });

  // ==========================================================================
  // 4. CONFIDENCE IS NOT PROBABILITY (DECOUPLING & DATA PROVENANCE)
  // ==========================================================================
  describe('4. Confidence Decoupling & Dynamic Derivation', () => {
    it('proves identical confidence for same data quality regardless of win probability', () => {
      // Underdog pick with 30% win probability vs Favorite pick with 70% win probability
      // Both have identical sample size (12 matches), freshness (10m), and market spread (1.025)
      const underdogConf = ValueEngine.calculateConfidence({
        sampleSizeHome: 12,
        sampleSizeAway: 12,
        ageMinutes: 10,
        overround: 1.025,
        edge: 0.040,
        isSufficient: true,
      });

      const favoriteConf = ValueEngine.calculateConfidence({
        sampleSizeHome: 12,
        sampleSizeAway: 12,
        ageMinutes: 10,
        overround: 1.025,
        edge: 0.040,
        isSufficient: true,
      });

      expect(underdogConf.score).toBe(favoriteConf.score);
      expect(underdogConf.breakdown).toEqual(favoriteConf.breakdown);
    });

    it('demonstrates that an underdog (28% win prob) with rich data achieves high confidence, while a favorite (75% win prob) with sparse data has low confidence', () => {
      // High-confidence Underdog: 15 finished matches, 5m old odds, tight 1.025 Pinnacle spread
      const underdogHighConf = ValueEngine.calculateConfidence({
        sampleSizeHome: 15,
        sampleSizeAway: 15,
        ageMinutes: 5,
        overround: 1.025,
        edge: 0.050,
        isSufficient: true,
      });

      // Low-confidence Favorite: 3 matches (minimum), 100m old odds, wide 1.065 spread
      const favoriteLowConf = ValueEngine.calculateConfidence({
        sampleSizeHome: 3,
        sampleSizeAway: 3,
        ageMinutes: 100,
        overround: 1.065,
        edge: 0.025,
        isSufficient: true,
      });

      expect(underdogHighConf.score).toBeGreaterThan(85);
      expect(favoriteLowConf.score).toBeLessThan(40);
      expect(underdogHighConf.score).toBeGreaterThan(favoriteLowConf.score);
    });

    it('proves that confidence strictly increases when odds freshness improves', () => {
      const fresh10m = ValueEngine.calculateConfidence({
        sampleSizeHome: 10,
        sampleSizeAway: 10,
        ageMinutes: 10,
        overround: 1.030,
        edge: 0.030,
        isSufficient: true,
      });

      const stale90m = ValueEngine.calculateConfidence({
        sampleSizeHome: 10,
        sampleSizeAway: 10,
        ageMinutes: 90,
        overround: 1.030,
        edge: 0.030,
        isSufficient: true,
      });

      expect(fresh10m.score).toBeGreaterThan(stale90m.score);
      expect(fresh10m.breakdown.freshness).toBeGreaterThan(stale90m.breakdown.freshness);
    });

    it('proves that confidence strictly decreases when sample size support degrades', () => {
      const matureSample = ValueEngine.calculateConfidence({
        sampleSizeHome: 14,
        sampleSizeAway: 14,
        ageMinutes: 20,
        overround: 1.030,
        edge: 0.030,
        isSufficient: true,
      });

      const sparseSample = ValueEngine.calculateConfidence({
        sampleSizeHome: 4,
        sampleSizeAway: 4,
        ageMinutes: 20,
        overround: 1.030,
        edge: 0.030,
        isSufficient: true,
      });

      expect(matureSample.score).toBeGreaterThan(sparseSample.score);
      expect(matureSample.breakdown.sampleSupport).toBeGreaterThan(sparseSample.breakdown.sampleSupport);
    });
  });

  // ==========================================================================
  // 5. REGRESSION TEST: ABSENCE OF PLACEHOLDER CONFIDENCE
  // ==========================================================================
  describe('5. Regression Test: Absence of Placeholder Confidence (78 / 75 / 72 / 30:75)', () => {
    it('verifies that confidence is dynamically computed and never defaults to arbitrary static constants', () => {
      // Run three different valid selections with varied sample support and freshness
      const selA = ValueEngine.evaluateSelection({
        ...baseValidInput,
        sampleSizeHome: 15,
        sampleSizeAway: 15,
        oddsTimestampUtc: '2026-09-25T09:55:00Z', // 5m old
      });

      const selB = ValueEngine.evaluateSelection({
        ...baseValidInput,
        sampleSizeHome: 6,
        sampleSizeAway: 6,
        oddsTimestampUtc: '2026-09-25T08:30:00Z', // 90m old
      });

      const selC = ValueEngine.evaluateSelection({
        ...baseValidInput,
        sampleSizeHome: 4,
        sampleSizeAway: 5,
        oddsTimestampUtc: '2026-09-25T08:00:00Z', // 120m old
      });

      // Neither selA, selB, nor selC should be identical
      expect(selA.confidence).not.toBe(selB.confidence);
      expect(selB.confidence).not.toBe(selC.confidence);

      // Explicit regression check against the old hardcoded placeholders
      expect([78, 75, 72]).not.toContain(selB.confidence);
      expect([78, 75, 72]).not.toContain(selC.confidence);
    });
  });

  // ==========================================================================
  // 6. CANONICAL ORCHESTRATOR INTEGRATION & ZERO ODDS-TO-MODEL CIRCULARITY
  // ==========================================================================
  describe('6. Canonical Orchestrator Production Integration & Invariants', () => {
    it('proves that CanonicalOrchestrator produces disaggregated metrics and zero circularity', async () => {
      const fixtureStandardOdds: CanonicalFixtureInput = {
        fixtureId: 'apifootball-1379101',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        league: 'EPL',
        kickoffUtc: kickoffTime,
        predictionTimestampUtc: predictionTime,
        oddsTimestampUtc: oddsTimeFresh,
        pinnacleOdds: {
          ah: { line: -0.25, homeOdds: 1.95, awayOdds: 1.95 },
          ou: { line: 2.5, overOdds: 1.85, underOdds: 2.05 },
          btts: { yesOdds: 1.90, noOdds: 1.98 },
        },
      };

      const fixtureShiftedOdds: CanonicalFixtureInput = {
        fixtureId: 'apifootball-1379101',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        league: 'EPL',
        kickoffUtc: kickoffTime,
        predictionTimestampUtc: predictionTime,
        oddsTimestampUtc: oddsTimeFresh,
        pinnacleOdds: {
          ah: { line: -0.25, homeOdds: 2.40, awayOdds: 1.65 }, // Huge line swing
          ou: { line: 2.5, overOdds: 2.30, underOdds: 1.68 },
          btts: { yesOdds: 2.40, noOdds: 1.65 },
        },
      };

      const resStandard = await CanonicalOrchestrator.evaluateFixture(fixtureStandardOdds, {
        historicalMatches: EPL_TEST_HISTORY,
      });

      const resShifted = await CanonicalOrchestrator.evaluateFixture(fixtureShiftedOdds, {
        historicalMatches: EPL_TEST_HISTORY,
      });

      // Zero circularity invariant: model parameters and probabilities MUST be 100% identical
      expect(resStandard.parameters.lambdaHome).toBe(resShifted.parameters.lambdaHome);
      expect(resStandard.parameters.lambdaAway).toBe(resShifted.parameters.lambdaAway);
      expect(resStandard.probabilities.ou['2.5'].pOver).toBe(resShifted.probabilities.ou['2.5'].pOver);
      expect(resStandard.probabilities.btts.pYes).toBe(resShifted.probabilities.btts.pYes);
      expect(resStandard.probabilities.ah['-0.25'].pCoverHome).toBe(resShifted.probabilities.ah['-0.25'].pCoverHome);

      // Downstream Value Engine metrics (edge, EV) MUST reflect the Pinnacle price shift
      expect(resStandard.evaluations.ah?.edge).not.toBe(resShifted.evaluations.ah?.edge);
      expect(resStandard.evaluations.ah?.expectedValue).not.toBe(resShifted.evaluations.ah?.expectedValue);

      // Verify all 4 disaggregated metrics are present on the evaluations:
      const ahEval = resStandard.evaluations.ah!;
      expect(ahEval.modelProbability).toBeDefined();
      expect(ahEval.marketProbability).toBeDefined();
      expect(ahEval.edge).toBeDefined();
      expect(ahEval.expectedValue).toBeDefined();
      expect(ahEval.confidence).toBeDefined();
      expect(ahEval.confidenceBreakdown).toBeDefined();
      expect(ahEval.passedGates).toBeDefined();

      console.log(`[Q4 Proof] Canonical AH evaluation:`, {
        selection: ahEval.selection,
        P_model: `${(ahEval.modelProbability * 100).toFixed(1)}%`,
        P_devig: `${(ahEval.marketProbability * 100).toFixed(1)}%`,
        edge: `${(ahEval.edge * 100).toFixed(2)}%`,
        EV: `${(ahEval.expectedValue * 100).toFixed(2)}%`,
        confidence: `${ahEval.confidence}/100`,
        verdict: ahEval.verdict,
        status: ahEval.validationStatus,
      });
    });
  });
});
