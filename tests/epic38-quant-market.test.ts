import { describe, it, expect } from 'vitest';
import { MarketQualityEngine } from '../src/lib/quant-market/market-quality-score';
import { EVDecayEngine } from '../src/lib/quant-market/ev-decay-engine';
import { ClosingLineIntelligenceEngine } from '../src/lib/quant-market/closing-line-intelligence';
import { LeagueIntelligenceEngineV2 } from '../src/lib/quant-market/league-intelligence-v2';
import { MetaValueEngine } from '../src/lib/quant-market/meta-value-score';
import { PortfolioRiskEngine } from '../src/lib/quant-market/portfolio-risk-engine';

describe('EPIC 38 — Quantitative Market Intelligence Test Suite', () => {
  describe('1. Market Quality Score Engine (0-100)', () => {
    it('should compute 0-100 score and classify market tier', () => {
      const mq = MarketQualityEngine.computeMarketQuality({
        overround: 0.018,
        volatility: 0.008,
        booksAvailable: 8,
        consensusDeviation: 0.005,
        leagueEfficiency: 0.95,
      });

      expect(mq.score).toBeGreaterThan(80);
      expect(mq.tier).toBe('INSTITUTIONAL');
      expect(mq.explanation).toContain('Bookmaker margin');
    });
  });

  describe('2. EV Decay Engine & Optimal Betting Window', () => {
    it('should analyze EV trajectory and detect steam movement', () => {
      const trajectory = [
        { hoursBeforeKickoff: 24, ev: 0.12, odds: 2.10 },
        { hoursBeforeKickoff: 12, ev: 0.08, odds: 2.02 },
        { hoursBeforeKickoff: 2, ev: 0.04, odds: 1.94 },
      ];

      const res = EVDecayEngine.analyzeEVDecay('fix-ev-1', 'asian_handicap', trajectory);
      expect(res.steamAlert).toBe(true);
      expect(res.optimalBettingWindow).toBe('IMMEDIATE');
    });
  });

  describe('3. Closing Line Intelligence Engine', () => {
    it('should predict expected closing odds and CLV %', () => {
      const clvProj = ClosingLineIntelligenceEngine.predictClosingLine('fix-clv-1', 'moneyline', 2.05, 0.58);
      expect(clvProj.expectedClosingOdds).toBeLessThan(2.05);
      expect(clvProj.predictedClvPct).toBeGreaterThan(0);
    });
  });

  describe('4. League Intelligence 2.0', () => {
    it('should return League Trust Score profile', () => {
      const profile = LeagueIntelligenceEngineV2.getLeagueTrustProfile('Premier League');
      expect(profile.leagueTrustScore).toBeGreaterThan(90);
      expect(profile.tier).toBe('TIER_1_PREMIUM');
    });
  });

  describe('5. Meta Value Score Engine (0-100)', () => {
    it('should compute composite Meta Value Score', () => {
      const meta = MetaValueEngine.computeMetaScore({
        expectedValue: 0.088,
        probEdge: 0.055,
        calibrationEce: 0.015,
        historicalRoi: 0.089,
        marketQualityScore: 88.5,
        leagueTrustScore: 92.5,
        predictedClv: 0.045,
        ciWidth: 0.08,
      });

      expect(meta.score).toBeGreaterThan(80);
      expect(['HIGH_VALUE', 'ELITE_VALUE']).toContain(meta.tier);
      expect(meta.mathematicalJustification).toContain('Meta Value Score');
    });
  });

  describe('6. Portfolio Risk & Quarter-Kelly Optimizer', () => {
    it('should execute Quarter-Kelly portfolio risk optimization', () => {
      const bets = [
        { fixtureId: 'f-1', league: 'Premier League', market: 'asian_handicap', modelProb: 0.58, bookmakerOdds: 2.05, ev: 0.189, fullKellyStakePct: 0.18 },
        { fixtureId: 'f-2', league: 'La Liga', market: 'moneyline', modelProb: 0.53, bookmakerOdds: 2.15, ev: 0.139, fullKellyStakePct: 0.12 },
      ];

      const report = PortfolioRiskEngine.optimizePortfolio(bets, 1000, 0.05);
      expect(report.recommendedBets.length).toBe(2);
      expect(report.totalAllocatedStakeUnits).toBeGreaterThan(0);
      expect(report.summaryText).toContain('Quarter-Kelly');
    });
  });
});
