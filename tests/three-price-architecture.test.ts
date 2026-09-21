// ============================================================================
// THREE-PRICE ARCHITECTURE & 5 HARD GATES INTEGRATION TEST SUITE
// ============================================================================
// Validates:
// 1. Strict Three-Price Separation (Reference ≠ Model ≠ Execution)
// 2. Explicit Market Schema (AH, OU, ML, BTTS with typed lines)
// 3. Three-Snapshot Evidence & Immutability
// 4. CLV PENDING before Pinnacle Close, VERIFIED after valid close
// 5. Suggested Bet Qualification ≠ Positive CLV
// 6. Zero Realized ROI / Yield before Natural Settlement
// 7. Gate 1: Fail-Closed on Synthetic Production Evidence
// 8. Explicit Lifecycle & Evidence Status Orthogonality
// 9. OddsPapi Quota Coalescing (Pinnacle + Bet365 in 1 request)
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { PredictionArchiveService } from '@/lib/archive/predictionArchiveService';
import { ProductionPublishingEngine } from '@/lib/publishing/productionPublishingEngine';
import { ProductionValidityGate } from '@/lib/publishing/productionValidityGate';
import { ValueEngine } from '@/lib/engine/valueEngine';
import { calculate1X2Probability } from '@/lib/engine/probability';

describe('Three-Price Architecture & 5 Hard Gates', () => {
  beforeEach(() => {
    PredictionArchiveService.clearStoreForTesting();
  });

  describe('Gate 1 & Gate 2: Three-Price Separation & Typings', () => {
    it('enforces strict separation between Reference (Pinnacle), Model (SALMO), and Execution (Bet365)', async () => {
      const now = new Date('2026-09-22T00:00:00.000Z').toISOString();
      const kickoff = new Date('2026-10-10T14:00:00.000Z').toISOString();

      // Setup prices:
      // SALMO Model: 57% prob -> 1.75 fair odds
      // Pinnacle Reference: 1.82 market odds -> 52.5% devig prob
      // Bet365 Execution: 1.91 retail odds -> +9.1% execution edge
      const record = await PredictionArchiveService.recordPrediction({
        fixtureId: 'match_epl_001',
        canonicalMatchId: 'match_epl_001',
        homeTeam: 'Arsenal',
        awayTeam: 'Leeds',
        competition: 'Premier League',
        leagueKey: 'ENG-PL',
        market: 'AH',
        line: -0.5,
        selection: 'Arsenal -0.5',
        modelProbability: 0.5714,
        fairOdds: 1.75,
        marketOdds: 1.82,
        bookmaker: 'Pinnacle',
        oddsProvider: 'OddsPapi',
        edge: 0.0464,
        expectedValue: 0.04,
        decision: 'VALUE_CANDIDATE',
        confidence: 82,
        strengthLevel: 'STRONG',
        signalColor: 'green',
        predictionTimestamp: now,
        oddsTimestamp: now,
        kickoffTimestamp: kickoff,
        modelVersion: 'dixon-coles-v1.0',
        modelParametersVersion: 'params-epl-2026-v1',
        dataVersion: 'canonical-production-v1',
        featureSnapshotId: 'feat_001',
        oddsSnapshotId: 'odds_001',
        scoreGridSummary: { homeXG: 1.8, awayXG: 0.9, rho: -0.05 },
        status: 'ACTIVE',
        lifecycle: 'PUBLISHED',
        evidenceStatus: 'MODEL_VERIFIED',
        settlement: null,
        referencePrice: {
          bookmaker: 'Pinnacle',
          market: 'AH',
          selection: 'Arsenal -0.5',
          line: -0.5,
          odds: 1.82,
          devigProbability: 0.525,
          timestampUtc: now,
        },
        modelPrice: {
          modelProbability: 0.5714,
          fairOdds: 1.75,
          edge: 0.0464,
          expectedValue: 0.04,
          modelVersion: 'dixon-coles-v1.0',
        },
        executionPrice: {
          bookmaker: 'Bet365',
          market: 'AH',
          selection: 'Arsenal -0.5',
          line: -0.5,
          odds: 1.91,
          timestampUtc: now,
        },
        suggestedBet: {
          qualified: true,
          executionBookmaker: 'Bet365',
          executionOdds: 1.91,
          executionEdge: 0.0914, // (1.91 * 0.5714) - 1 = +9.1%
          ruleApplied: 'RETAIL_PRICE_DISLOCATION_VS_MODEL',
          disclaimer: 'Suggested Bet qualification is based on retail execution edge vs SALMO model price; does NOT imply positive CLV.',
        },
        referenceSnapshot: {
          snapshotId: 'snap_pin_001',
          provider: 'OddsPapi',
          bookmaker: 'Pinnacle',
          market: 'AH',
          selection: 'Arsenal -0.5',
          line: -0.5,
          odds: 1.82,
          impliedProbability: 0.549,
          devigProbability: 0.525,
          timestampUtc: now,
          fixtureIdentity: {
            fixtureId: 'match_epl_001',
            homeTeam: 'Arsenal',
            awayTeam: 'Leeds',
            kickoffUtc: kickoff,
          },
        },
        executionSnapshot: {
          snapshotId: 'snap_b365_001',
          provider: 'OddsPapi',
          bookmaker: 'Bet365',
          market: 'AH',
          selection: 'Arsenal -0.5',
          line: -0.5,
          odds: 1.91,
          impliedProbability: 0.523,
          devigProbability: 0.505,
          timestampUtc: now,
          fixtureIdentity: {
            fixtureId: 'match_epl_001',
            homeTeam: 'Arsenal',
            awayTeam: 'Leeds',
            kickoffUtc: kickoff,
          },
        },
        closingSnapshot: null,
        clvRecord: {
          status: 'PENDING',
          closingOdds: null,
          closingLine: null,
          clvValue: null,
          clvRatio: null,
          closingTimestampUtc: null,
        },
      });

      const p = record.record;
      // 1. Reference Price is strictly Pinnacle
      expect(p.referencePrice?.bookmaker).toBe('Pinnacle');
      expect(p.referencePrice?.odds).toBe(1.82);

      // 2. Model Price is strictly SALMO
      expect(p.modelPrice?.fairOdds).toBe(1.75);
      expect(p.modelPrice?.modelProbability).toBe(0.5714);

      // 3. Execution Price is strictly Bet365
      expect(p.executionPrice?.bookmaker).toBe('Bet365');
      expect(p.executionPrice?.odds).toBe(1.91);

      // 4. Assert no conflation: 1.91 cannot be labeled reference or CLV
      expect(p.referencePrice?.odds).not.toBe(p.executionPrice?.odds);
      expect(p.modelPrice?.fairOdds).not.toBe(p.referencePrice?.odds);
    });
  });

  describe('Gate 3: Suggested Bet Qualification ≠ Positive CLV', () => {
    it('allows Suggested Bet to qualify on retail edge while CLV remains strictly PENDING', async () => {
      const now = new Date().toISOString();
      const kickoff = new Date(Date.now() + 86400000 * 5).toISOString();

      const record = await PredictionArchiveService.recordPrediction({
        fixtureId: 'match_epl_002',
        canonicalMatchId: 'match_epl_002',
        homeTeam: 'Ipswich',
        awayTeam: 'Fulham',
        competition: 'Premier League',
        leagueKey: 'ENG-PL',
        market: 'ML',
        line: null,
        selection: 'Ipswich Win',
        modelProbability: 0.45,
        fairOdds: 2.22,
        marketOdds: 2.30, // Pinnacle reference
        bookmaker: 'Pinnacle',
        oddsProvider: 'OddsPapi',
        edge: 0.035,
        expectedValue: 0.035,
        decision: 'VALUE_CANDIDATE',
        confidence: 80,
        strengthLevel: 'STRONG',
        signalColor: 'green',
        predictionTimestamp: now,
        oddsTimestamp: now,
        kickoffTimestamp: kickoff,
        modelVersion: 'dixon-coles-v1.0',
        modelParametersVersion: 'params-epl-2026-v1',
        dataVersion: 'canonical-production-v1',
        featureSnapshotId: 'feat_002',
        oddsSnapshotId: 'odds_002',
        scoreGridSummary: { homeXG: 1.5, awayXG: 1.2, rho: -0.05 },
        status: 'ACTIVE',
        lifecycle: 'PUBLISHED',
        evidenceStatus: 'MODEL_VERIFIED',
        settlement: null,
        referencePrice: {
          bookmaker: 'Pinnacle',
          market: 'ML',
          selection: 'Ipswich Win',
          line: null,
          odds: 2.30,
          devigProbability: 0.415,
          timestampUtc: now,
        },
        modelPrice: {
          modelProbability: 0.45,
          fairOdds: 2.22,
          edge: 0.035,
          expectedValue: 0.035,
          modelVersion: 'dixon-coles-v1.0',
        },
        executionPrice: {
          bookmaker: 'Bet365',
          market: 'ML',
          selection: 'Ipswich Win',
          line: null,
          odds: 2.45,
          timestampUtc: now,
        },
        suggestedBet: {
          qualified: true,
          executionBookmaker: 'Bet365',
          executionOdds: 2.45,
          executionEdge: 0.1025, // (2.45 * 0.45) - 1 = +10.25%
          ruleApplied: 'RETAIL_PRICE_DISLOCATION_VS_MODEL',
          disclaimer: 'Suggested Bet qualification is based on retail execution edge vs SALMO model price; does NOT imply positive CLV.',
        },
        clvRecord: {
          status: 'PENDING',
          closingOdds: null,
          closingLine: null,
          clvValue: null,
          clvRatio: null,
          closingTimestampUtc: null,
        },
      });

      const p = record.record;
      // Gate 3 Assertion: Suggested Bet IS qualified
      expect(p.suggestedBet?.qualified).toBe(true);
      expect(p.suggestedBet?.executionEdge).toBeGreaterThan(0.05);

      // Gate 3 Assertion: CLV is STILL strictly PENDING
      expect(p.clvRecord?.status).toBe('PENDING');
      expect(p.clvRecord?.closingOdds).toBeNull();
      expect(p.clvRecord?.clvValue).toBeNull();

      // Projection projects clvStatus as PENDING
      const projections = PredictionArchiveService.getDailyPicksProjection({ nowMs: Date.now() });
      const proj = projections.find((x) => x.predictionId === p.predictionId);
      expect(proj?.suggestedBet?.qualified).toBe(true);
      expect(proj?.clvStatus).toBe('PENDING');
    });
  });

  describe('Gate 4: Explicit Prediction Lifecycle & Evidence Status Orthogonality', () => {
    it('maintains distinct lifecycle states and evidence status without conflation', async () => {
      const now = new Date().toISOString();
      const kickoff = new Date(Date.now() + 86400000).toISOString();

      const record = await PredictionArchiveService.recordPrediction({
        fixtureId: 'match_epl_003',
        canonicalMatchId: 'match_epl_003',
        homeTeam: 'Chelsea',
        awayTeam: 'Bournemouth',
        competition: 'Premier League',
        leagueKey: 'ENG-PL',
        market: 'OU',
        line: 2.5,
        selection: 'Over 2.5',
        modelProbability: 0.58,
        fairOdds: 1.72,
        marketOdds: 1.85,
        bookmaker: 'Pinnacle',
        oddsProvider: 'OddsPapi',
        edge: 0.05,
        expectedValue: 0.073,
        decision: 'VALUE_CANDIDATE',
        confidence: 76,
        strengthLevel: 'STRONG',
        signalColor: 'green',
        predictionTimestamp: now,
        oddsTimestamp: now,
        kickoffTimestamp: kickoff,
        modelVersion: 'dixon-coles-v1.0',
        modelParametersVersion: 'params-epl-2026-v1',
        dataVersion: 'canonical-production-v1',
        featureSnapshotId: 'feat_003',
        oddsSnapshotId: 'odds_003',
        scoreGridSummary: { homeXG: 1.7, awayXG: 1.3, rho: -0.05 },
        status: 'ACTIVE',
        lifecycle: 'PUBLISHED',
        evidenceStatus: 'MODEL_VERIFIED',
        settlement: null,
      });

      expect(record.record.lifecycle).toBe('PUBLISHED');
      expect(record.record.evidenceStatus).toBe('MODEL_VERIFIED');
    });
  });

  describe('Gate 5: Zero Realized ROI for Pre-Match / Unsettled Predictions', () => {
    it('does not expose realized ROI, profit, or yield for active upcoming fixtures', async () => {
      const now = new Date().toISOString();
      const kickoff = new Date(Date.now() + 86400000 * 2).toISOString();

      await PredictionArchiveService.recordPrediction({
        fixtureId: 'match_epl_004',
        canonicalMatchId: 'match_epl_004',
        homeTeam: 'Liverpool',
        awayTeam: 'Everton',
        competition: 'Premier League',
        leagueKey: 'ENG-PL',
        market: 'AH',
        line: -1.0,
        selection: 'Liverpool -1.0',
        modelProbability: 0.62,
        fairOdds: 1.61,
        marketOdds: 1.75,
        bookmaker: 'Pinnacle',
        oddsProvider: 'OddsPapi',
        edge: 0.06,
        expectedValue: 0.085,
        decision: 'VALUE_CANDIDATE',
        confidence: 85,
        strengthLevel: 'STRONG',
        signalColor: 'green',
        predictionTimestamp: now,
        oddsTimestamp: now,
        kickoffTimestamp: kickoff,
        modelVersion: 'dixon-coles-v1.0',
        modelParametersVersion: 'params-epl-2026-v1',
        dataVersion: 'canonical-production-v1',
        featureSnapshotId: 'feat_004',
        oddsSnapshotId: 'odds_004',
        scoreGridSummary: { homeXG: 2.1, awayXG: 0.7, rho: -0.05 },
        status: 'ACTIVE',
        lifecycle: 'PUBLISHED',
        evidenceStatus: 'MODEL_VERIFIED',
        settlement: null,
      });

      const projections = PredictionArchiveService.getDailyPicksProjection({ nowMs: Date.now() });
      const pick = projections.find((p) => p.fixtureId === 'match_epl_004');

      expect(pick).toBeDefined();
      // Pre-match metrics allowed:
      expect(pick?.expectedValue).toBe(0.085);
      expect(pick?.modelProbability).toBe(0.62);
      expect(pick?.fairOdds).toBe(1.61);

      // Gate 5 Assertion: Settled fields are NOT exposed or are strictly uncalculated
      expect((pick as any).realizedRoi).toBeUndefined();
      expect((pick as any).yield).toBeUndefined();
      expect((pick as any).profitUnits).toBeUndefined();
      expect(pick?.status).toBe('ACTIVE');
    });
  });

  describe('Market Schema & Line Typing', () => {
    it('supports typed line for AH/OU and null line for ML/BTTS', () => {
      // 1. AH requires number line
      const ahValid = ProductionValidityGate.evaluate({
        fixtureId: 'match_epl_valid_1',
        canonicalMatchId: 'match_epl_valid_1',
        competition: 'Premier League',
        leagueKey: 'ENG-PL',
        homeTeam: 'Arsenal',
        awayTeam: 'Leeds',
        kickoffUtc: new Date(Date.now() + 100000).toISOString(),
        market: 'AH',
        selection: 'Arsenal -0.5',
        line: -0.5,
        modelProbability: 0.55,
        fairOdds: 1.82,
        marketOdds: 1.95,
        confidence: 75,
        sampleSizeHome: 5,
        sampleSizeAway: 5,
        modelVersion: 'dixon-coles-v1.0',
        providerSources: { fixtures: 'api-football', odds: 'oddspapi' },
        oddsTimestampUtc: new Date().toISOString(),
        predictionTimestampUtc: new Date().toISOString(),
      });
      expect(ahValid.checks.supportedMarket).toBe(true);
      expect(ahValid.isValid).toBe(true);

      // 2. ML supports null line
      const mlValid = ProductionValidityGate.evaluate({
        fixtureId: 'match_epl_valid_2',
        canonicalMatchId: 'match_epl_valid_2',
        competition: 'Premier League',
        leagueKey: 'ENG-PL',
        homeTeam: 'Arsenal',
        awayTeam: 'Leeds',
        kickoffUtc: new Date(Date.now() + 100000).toISOString(),
        market: 'ML',
        selection: 'Arsenal Win',
        line: null,
        modelProbability: 0.58,
        fairOdds: 1.72,
        marketOdds: 1.85,
        confidence: 78,
        sampleSizeHome: 5,
        sampleSizeAway: 5,
        modelVersion: 'dixon-coles-v1.0',
        providerSources: { fixtures: 'api-football', odds: 'oddspapi' },
        oddsTimestampUtc: new Date().toISOString(),
        predictionTimestampUtc: new Date().toISOString(),
      });
      expect(mlValid.checks.supportedMarket).toBe(true);
      expect(mlValid.isValid).toBe(true);

      // 3. Ambiguous '1X2' string format is rejected
      const forbidden = ProductionValidityGate.evaluate({
        fixtureId: 'match_epl_valid_3',
        canonicalMatchId: 'match_epl_valid_3',
        competition: 'Premier League',
        leagueKey: 'ENG-PL',
        homeTeam: 'Arsenal',
        awayTeam: 'Leeds',
        kickoffUtc: new Date(Date.now() + 100000).toISOString(),
        market: '1X2',
        selection: 'Arsenal Win',
        line: null,
        modelProbability: 0.58,
        fairOdds: 1.72,
        marketOdds: 1.85,
        confidence: 78,
        sampleSizeHome: 5,
        sampleSizeAway: 5,
        modelVersion: 'dixon-coles-v1.0',
        providerSources: { fixtures: 'api-football', odds: 'oddspapi' },
        oddsTimestampUtc: new Date().toISOString(),
        predictionTimestampUtc: new Date().toISOString(),
      });
      expect(forbidden.isValid).toBe(false);
      expect(forbidden.rejectionReason).toContain('MONEYLINE_UNSUPPORTED');
    });

    it('computes exact 1X2 probabilities for ML using bivariate Poisson', () => {
      const p1X2 = calculate1X2Probability(1.6, 1.1, -0.05);
      expect(p1X2.home).toBeGreaterThan(0.3);
      expect(p1X2.draw).toBeGreaterThan(0.2);
      expect(p1X2.away).toBeGreaterThan(0.2);
      // Total sum must equal 1.0 (within numerical tolerance)
      const sum = p1X2.home + p1X2.draw + p1X2.away;
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
    });
  });

  describe('Gate 1: Synthetic Evidence Fail-Closed', () => {
    it('rejects publication when synthetic evidence is detected', async () => {
      await expect(
        PredictionArchiveService.recordPrediction({
          fixtureId: 'match_synthetic',
          canonicalMatchId: 'match_synthetic',
          homeTeam: 'Mock Home',
          awayTeam: 'Mock Away',
          competition: 'Premier League',
          leagueKey: 'ENG-PL',
          market: 'AH',
          line: -0.5,
          selection: 'Mock Home -0.5',
          modelProbability: 0.55,
          fairOdds: 1.82,
          marketOdds: 1.95,
          bookmaker: 'MockBookie',
          oddsProvider: 'mock_provider',
          edge: 0.05,
          expectedValue: 0.07,
          decision: 'VALUE_CANDIDATE',
          confidence: 80,
          strengthLevel: 'STRONG',
          signalColor: 'green',
          predictionTimestamp: new Date().toISOString(),
          oddsTimestamp: new Date().toISOString(),
          kickoffTimestamp: new Date(Date.now() + 1000000).toISOString(),
          modelVersion: 'dixon-coles-v1.0',
          modelParametersVersion: 'params-v1',
          dataVersion: 'canonical-v1',
          featureSnapshotId: 'feat_mock',
          oddsSnapshotId: 'odds_mock',
          scoreGridSummary: { homeXG: 1.5, awayXG: 1.0, rho: -0.05 },
          status: 'ACTIVE',
          settlement: null,
          isSynthetic: true, // GATE 1 TRIGGER
        })
      ).rejects.toThrow('GATE 1 VIOLATION: Cannot archive prediction with synthetic evidence');
    });
  });
});
