import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompetitionProfileEngine } from '../src/lib/engines/feature-engine/competition-profile';
import { AdaptiveWeightsEngine } from '../src/lib/engines/probability-engine/adaptive-weights';
import { UncertaintyEngine } from '../src/lib/engines/probability-engine/uncertainty';
import { ClvTracker } from '../src/lib/engines/edge-scanner/clv-tracker';
import { CLVCalculator } from '../src/lib/settlement/clv-calculator';
import { runSegmentedBacktest, HistoricalPrediction } from '../src/lib/engine/backtest-engine';
import { MatchFeatures } from '../src/lib/engines/feature-engine/types';
import { InternationalContextExtractor } from '../src/lib/engines/feature-engine/international-context';

// Mock Supabase Client
vi.mock('../src/lib/supabase.server', () => {
  return {
    supabase: {
      from: vi.fn((table: string) => {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null })
                })
              })
            })
          }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null })
        } as any;
      }),
      rpc: vi.fn()
    }
  };
});

describe('Sprint 6 Integration Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Competition Profile Engine', () => {
    it('returns custom properties for club vs international profiles', () => {
      const club = CompetitionProfileEngine.getProfile('club');
      const inter = CompetitionProfileEngine.getProfile('international');

      expect(club.type).toBe('club');
      expect(club.goalEnvironment).toBe(2.5);
      expect(club.homeAdvantageModifier).toBeGreaterThan(1.05);

      expect(inter.type).toBe('international');
      expect(inter.goalEnvironment).toBe(2.45);
      expect(inter.homeAdvantageModifier).toBeLessThan(1.05);
      expect(inter.restSensitivity).toBe(1.3);
    });
  });

  describe('International Context Extractor', () => {
    it('correctly extracts features and calculates international adjustment score', () => {
      const mockMatch = {
        fifa_ranking_home: 10,
        fifa_ranking_away: 25,
        squad_strength_home: 0.85,
        squad_strength_away: 0.70,
        tournament_stage: 'Quarter-Final'
      };

      const mockFatigue = {
        homeRestDays: 5,
        awayRestDays: 6,
        homeTravelKm: 1500
      };

      const context = InternationalContextExtractor.extract(mockMatch, mockFatigue);

      expect(context.fifaRankingHome).toBe(10);
      expect(context.fifaRankingAway).toBe(25);
      expect(context.squadContinuityHome).toBe(0.85);
      expect(context.squadContinuityAway).toBe(0.70);
      expect(context.knockoutPressure).toBe(0.8); // Quarter-Final should be 0.8
      expect(context.internationalAdjustmentScore).toBeGreaterThan(0.9);
      expect(context.internationalAdjustmentScore).toBeLessThan(1.2);
    });

    it('calculates lower score when travel is high and rest days are low', () => {
      const mockMatch = {
        fifa_ranking_home: 10,
        fifa_ranking_away: 25,
        squad_strength_home: 0.85,
        squad_strength_away: 0.70,
        tournament_stage: 'Final'
      };

      const mockFatigueHighTravel = {
        homeRestDays: 3, // Low rest
        awayRestDays: 3,
        homeTravelKm: 6000 // High travel
      };

      const context = InternationalContextExtractor.extract(mockMatch, mockFatigueHighTravel);

      expect(context.knockoutPressure).toBe(1.0); // Final is 1.0
      // High travel/low rest/high pressure should degrade the adjustment score compared to optimal setup
      expect(context.internationalAdjustmentScore).toBeLessThan(1.0);
    });
  });

  describe('Adaptive Weights Engine', () => {
    it('returns equal weights as fallback when no history is present', async () => {
      const weights = await AdaptiveWeightsEngine.getWeights('EPL');
      expect(weights.poisson).toBe(0.5);
      expect(weights.dixonColes).toBe(0.5);
    });
  });

  describe('Uncertainty Engine (Split Confidence)', () => {
    const mockFeatures: MatchFeatures = {
      matchId: 'm-1',
      marketType: 'ML',
      kickoffAt: new Date(),
      homeFormLast5: [3, 1, 0, 3, 3],
      awayFormLast5: [1, 1, 3, 0, 1],
      homeFormWeighted: 1.8,
      awayFormWeighted: 1.2,
      homeRestDays: 5,
      awayRestDays: 4,
      homeTravelKm: 100,
      homeElo: 1550,
      awayElo: 1450,
      eloDelta: 100,
      homeAttack: 1.2,
      homeDefense: 0.9,
      awayAttack: 1.0,
      awayDefense: 1.1,
      leagueAvgGoals: 2.5,
      isHomeAdvantage: true,
      leagueId: 'EPL',
      season: '2026',
      generatedAt: new Date(),
      competitionType: 'club',
      squadFamiliarity: 1.0,
      squadContinuityHome: 1.0,
      squadContinuityAway: 1.0
    };

    it('calculates split confidence based on model discrepancies and data quality', () => {
      const pML = [0.55, 0.25, 0.20];
      const dcML = [0.52, 0.27, 0.21]; // close match
      const conf = UncertaintyEngine.calculate(mockFeatures, pML, dcML);

      expect(conf.modelConfidence).toBeGreaterThan(0.85);
      expect(conf.dataConfidence).toBe(1.0);
      expect(conf.finalConfidence).toBeGreaterThan(0.70);
    });
  });

  describe('Connected CLV Tracker', () => {
    it('delegates directly to CLVCalculator without duplicating formulas', () => {
      const entry = 2.0;
      const closing = 1.8;
      
      const clvTrackerVal = ClvTracker.calculateClv(entry, closing);
      const clvCalcVal = CLVCalculator.calculate(entry, closing);

      expect(clvTrackerVal).toBe(clvCalcVal);
      expect(clvTrackerVal).toBeCloseTo(0.0556, 4);
    });
  });

  describe('Segmented Backtester', () => {
    const predictions: HistoricalPrediction[] = [
      {
        matchId: 'm-1',
        predictionType: 'moneyline',
        predictedValue: 'home',
        probability: 0.65,
        fairOdds: 1.54,
        marketOdds: 1.80,
        edgePercent: 0.17,
        actualResult: '2-1',
        correct: true,
        competitionType: 'club',
        leagueId: 'EPL',
        clv: 0.05
      },
      {
        matchId: 'm-2',
        predictionType: 'moneyline',
        predictedValue: 'away',
        probability: 0.55,
        fairOdds: 1.82,
        marketOdds: 2.10,
        edgePercent: 0.155,
        actualResult: '0-2',
        correct: true,
        competitionType: 'international',
        leagueId: 'WORLD_CUP',
        clv: -0.02
      }
    ];

    it('accurately segments report slices and calculates ROI and Sharpe ratio', () => {
      const report = runSegmentedBacktest(predictions);

      expect(report.overall.totalBets).toBe(2);
      expect(report.overall.winRate).toBe(100.0);
      expect(report.overall.yieldPercent).toBeGreaterThan(0);
      
      expect(report.marketSegments['ML'].totalBets).toBe(2);
      expect(report.competitionSegments['club'].totalBets).toBe(1);
      expect(report.competitionSegments['international'].totalBets).toBe(1);
    });
  });
});
