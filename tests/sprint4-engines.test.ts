// Unit Tests for Sprint 4 Engines
// Location: tests/sprint4-engines.test.ts

import { describe, it, expect } from 'vitest';
import { EdgeEngine, BookmakerOddsSnapshot } from '../src/lib/engines/edge-engine';
import { DecisionEngine } from '../src/lib/engines/decision-engine';
import { RecommendationEngine } from '../src/lib/engines/recommendation-engine';
import { ExplainabilityEngine } from '../src/lib/engines/explainability-engine';
import { IntelligenceEngine } from '../src/lib/engines/intelligence-engine';

describe('Sprint 4 Decoupled Engine Suite', () => {
  const mockProbs = {
    pHome: 0.60,
    pDraw: 0.20,
    pAway: 0.20,
    pOver: { '2.5': 0.65 },
    pUnder: { '2.5': 0.35 },
    pAhHome: { '-0.25': 0.55 },
    pAhAway: { '-0.25': 0.45 },
    pBttsYes: 0.60,
    pBttsNo: 0.40
  };

  const mockOdds: BookmakerOddsSnapshot = {
    bookmaker: 'Pinnacle',
    moneyline: {
      home: { opening: 1.60, current: 1.80 },
      draw: { opening: 4.00, current: 4.50 },
      away: { opening: 5.00, current: 5.00 }
    },
    asianHandicap: {
      '-0.25': {
        home: { opening: 1.85, current: 1.95 },
        away: { opening: 1.95, current: 1.85 }
      }
    },
    overUnder: {
      '2.5': {
        over: { opening: 1.70, current: 1.85 },
        under: { opening: 2.10, current: 1.95 }
      }
    },
    btts: {
      yes: { opening: 1.65, current: 1.80 },
      no: { opening: 2.20, current: 2.00 }
    },
    doubleChance: {
      homeDraw: { opening: 1.15, current: 1.25 },
      awayDraw: { opening: 2.20, current: 2.10 },
      homeAway: { opening: 1.20, current: 1.25 }
    }
  };

  describe('EdgeEngine', () => {
    it('should calculate edges and EV correctly across standard markets', () => {
      const edges = EdgeEngine.calculateEdges(mockProbs, mockOdds);
      expect(edges.length).toBeGreaterThan(0);

      // Moneyline Home: Model prob = 0.60, Bookmaker odds = 1.80
      // EV = (0.60 * 1.80 - 1) * 100 = 8%
      const mlHome = edges.find(e => e.market === 'Moneyline Home');
      expect(mlHome).toBeDefined();
      expect(mlHome!.EV).toBe(8.0);
      expect(mlHome!.fair_odds).toBe(1.67);
      expect(mlHome!.CLV_projection).toBe(Number(((1.60 / 1.80 - 1) * 100).toFixed(2)));
    });
  });

  describe('DecisionEngine', () => {
    it('should determine dual confidence and action decisions deterministically', () => {
      const edges = EdgeEngine.calculateEdges(mockProbs, mockOdds);
      const mlHomeEdge = edges.find(e => e.market === 'Moneyline Home')!;

      const decision = DecisionEngine.evaluateDecision('match-1001', mlHomeEdge, 0.85, 0.90);
      expect(decision.confidence_score).toBe(87);
      expect(decision.confidence_label).toBe('Very High');
      expect(decision.decision).toBe('STRONG_VALUE');
      expect(decision.risk).toBe('Medium');
    });

    it('should evaluate low confidence or negative EV as AVOID', () => {
      const edges = EdgeEngine.calculateEdges(mockProbs, mockOdds);
      const mlAwayEdge = edges.find(e => e.market === 'Moneyline Away')!;

      // Away EV = (0.20 * 5.0 - 1) * 100 = 0%
      const decision = DecisionEngine.evaluateDecision('match-1001', mlAwayEdge, 0.10, 0.10);
      expect(decision.decision).toBe('AVOID');
    });
  });

  describe('RecommendationEngine', () => {
    it('should calculate Kelly stakes and reasoning lists', () => {
      const edges = EdgeEngine.calculateEdges(mockProbs, mockOdds);
      const mlHomeEdge = edges.find(e => e.market === 'Moneyline Home')!;
      const decision = DecisionEngine.evaluateDecision('match-1001', mlHomeEdge, 0.85, 0.90);

      const recommendation = RecommendationEngine.generateRecommendation(decision, 0.58, 0.60);
      expect(recommendation.recommended_stake).toBeGreaterThan(0);
      expect(recommendation.kelly_fraction).toBeGreaterThan(0);
      expect(recommendation.reasoning.length).toBeGreaterThan(0);
    });
  });

  describe('ExplainabilityEngine', () => {
    it('should compute contribution, direction, and magnitude graphs without static text', () => {
      const features = {
        homeAttack: 2.2,
        awayAttack: 1.8,
        homeDefense: 1.6,
        awayDefense: 2.0,
        homeRestDays: 6,
        awayRestDays: 3,
        isHomeAdvantage: true,
        missingLineupKeyPlayers: 2
      };

      const explanation = ExplainabilityEngine.explainPrediction(features);
      expect(explanation.length).toBeGreaterThan(0);
      explanation.forEach(exp => {
        expect(exp.feature).toBeDefined();
        expect(exp.contribution).not.toBeNaN();
        expect(['Positive', 'Negative']).toContain(exp.direction);
        expect(['Strong', 'Moderate', 'Weak']).toContain(exp.magnitude);
      });
    });
  });

  describe('IntelligenceEngine', () => {
    it('should aggregate recommendations into high-level dashboard insights', () => {
      const edges = EdgeEngine.calculateEdges(mockProbs, mockOdds);
      const recommendations = edges.map(edge => {
        const dec = DecisionEngine.evaluateDecision('match-1001', edge, 0.80, 0.80);
        return RecommendationEngine.generateRecommendation(dec, 0.5, 0.5);
      });

      const insights = IntelligenceEngine.generateInsights(recommendations);
      expect(insights.todaysBestEdge).toBeDefined();
      expect(insights.topValueBets).toBeDefined();
      expect(insights.highestConfidence).toBeDefined();
    });
  });
});
