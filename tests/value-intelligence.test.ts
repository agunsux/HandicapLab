import { describe, it, expect } from 'vitest';
import { computeFairOdds, calculateImpliedProb, calculateOverround } from '../src/lib/value-intelligence/fair-odds-engine';
import { classifyRecommendation } from '../src/lib/value-intelligence/recommendation-engine';
import { HistoricalSimilarityEngine } from '../src/lib/value-intelligence/similarity-engine';
import { LeagueIntelligenceEngine } from '../src/lib/value-intelligence/league-intelligence';
import { ConfidenceMovementEngine } from '../src/lib/value-intelligence/confidence-movement';
import { generateValueExplanation } from '../src/lib/value-intelligence/explainability';

describe('EPIC 36 — Value Betting Intelligence Platform Test Suite', () => {
  const sampleQuote = {
    market: 'asian_handicap' as const,
    line: -0.5,
    priceHome: 2.05,
    priceAway: 1.85,
    bookmaker: 'pinnacle',
  };

  describe('1. Fair Odds & Vig Removal Engine', () => {
    it('should compute vig-removed implied probability and Model Fair Odds', () => {
      const impliedHome = calculateImpliedProb(sampleQuote, 'home');
      expect(impliedHome).toBeGreaterThan(0.45);
      expect(impliedHome).toBeLessThan(0.50);

      const overround = calculateOverround(sampleQuote);
      expect(overround).toBeGreaterThan(0.02);

      const fair = computeFairOdds(sampleQuote, 'home', 0.58);
      expect(fair.modelFairOdds).toBe(1.724); // 1 / 0.58
      expect(fair.bookmakerOdds).toBe(2.05);
      expect(fair.expectedValue).toBeGreaterThan(0.18); // 0.58 * 2.05 - 1 = 0.189
      expect(fair.probEdge).toBeGreaterThan(0.08);
    });
  });

  describe('2. 5-Tier Value Recommendation Classifier', () => {
    it('should classify high +EV bets as STRONG_VALUE and negative EV as NO_VALUE', () => {
      const rec1 = classifyRecommendation({
        fixtureId: 'f-test-1',
        league: 'Premier League',
        season: '2025-2026',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        kickoff: new Date().toISOString(),
        quote: sampleQuote,
        selection: 'home',
        modelProb: 0.58,
        confidence: 0.72,
      });

      expect(rec1.category).toBe('STRONG_VALUE');
      expect(rec1.actionable).toBe(true);
      expect(rec1.expectedValue).toBeGreaterThan(0.05);

      // Negative EV bet must be NO_VALUE and actionable = false
      const rec2 = classifyRecommendation({
        fixtureId: 'f-test-2',
        league: 'Premier League',
        season: '2025-2026',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        kickoff: new Date().toISOString(),
        quote: sampleQuote,
        selection: 'home',
        modelProb: 0.40, // 0.40 * 2.05 - 1 = -0.18 EV
        confidence: 0.70,
      });

      expect(rec2.category).toBe('NO_VALUE');
      expect(rec2.actionable).toBe(false);
      expect(rec2.expectedValue).toBeLessThan(0);
    });
  });

  describe('3. Historical Similarity Engine', () => {
    it('should retrieve empirical evidence metrics for a cohort filter', () => {
      const evidence = HistoricalSimilarityEngine.queryHistoricalEvidence({
        league: 'Premier League',
        market: 'asian_handicap',
        minOdds: 2.05,
        maxOdds: 2.05,
        minEv: 0.10,
      });

      expect(evidence.sampleSize).toBeGreaterThan(100);
      expect(evidence.historicalRoi).toBeGreaterThan(0.05);
      expect(evidence.summaryText).toContain('Premier League');
    });
  });

  describe('4. League Intelligence Engine', () => {
    it('should rank leagues by historical ROI and efficiency', () => {
      const ranked = LeagueIntelligenceEngine.getRankedLeagues();
      expect(ranked.length).toBeGreaterThan(0);
      expect(ranked[0].rank).toBe(1);
      expect(ranked[0].historicalRoi).toBeGreaterThanOrEqual(ranked[1].historicalRoi);
    });
  });

  describe('5. Confidence & Odds Movement Intelligence', () => {
    it('should categorize confidence buckets and analyze steam movements', () => {
      const buckets = ConfidenceMovementEngine.getConfidenceBuckets();
      expect(buckets.length).toBe(6);

      const movement = ConfidenceMovementEngine.analyzeOddsMovement(
        'fix-mov-1',
        'asian_handicap',
        2.20, // opening
        2.05, // prediction
        2.00  // current (Steam)
      );

      expect(movement.movementType).toBe('steam');
      expect(movement.historicalRoiForMovement).toBeGreaterThan(0.07);
    });
  });

  describe('6. 5-Question Mathematical Explainability Engine', () => {
    it('should generate transparent justifications for all 5 questions', () => {
      const rec = classifyRecommendation({
        fixtureId: 'f-exp-1',
        league: 'La Liga',
        season: '2025-2026',
        homeTeam: 'Real Madrid',
        awayTeam: 'Barcelona',
        kickoff: new Date().toISOString(),
        quote: { market: 'moneyline' as const, line: 0, priceHome: 2.15, priceDraw: 3.50, priceAway: 3.30, bookmaker: 'pinnacle' },
        selection: 'home',
        modelProb: 0.53,
        confidence: 0.68,
      });

      const explanation = generateValueExplanation(rec);
      expect(explanation.whyThisBet.title).toContain('Expected Value');
      expect(explanation.whyNow.movementType).toBeDefined();
      expect(explanation.whatVariablesInfluencedIt.primaryDrivers.length).toBeGreaterThan(0);
      expect(explanation.howMuchEdgeExists.modelFairOdds).toBe(rec.modelFairOdds);
      expect(explanation.whatHappenedHistorically.similarMatchesCount).toBeGreaterThan(0);
      expect(explanation.formattedMarkdown).toContain('# Value Intelligence Audit');
    });
  });
});
