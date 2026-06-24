import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeatureImportance } from '../src/lib/ablation/feature-importance';
import { ComparisonMatrix } from '../src/lib/ablation/comparison-matrix';
import { AblationRunner } from '../src/lib/ablation/runner';
import { ExperimentConfig, ComparisonResult } from '../src/lib/ablation/types';
import { MatchFeatures } from '../src/lib/engines/feature-engine/types';
import { supabase } from '../src/lib/supabase.server';

// Mock Supabase Client
vi.mock('../src/lib/supabase.server', () => {
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({ data: [], error: null })
              }))
            }))
          }))
        })),
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      })),
      rpc: vi.fn()
    }
  };
});

describe('Ablation Framework', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('FeatureImportance', () => {
    it('should rank features based on importance and assign impacts', async () => {
      const mockFeatures: MatchFeatures = {
        matchId: 'm-1',
        marketType: 'ML',
        kickoffAt: new Date(),
        homeFormLast5: [3, 3, 3, 3, 3],
        awayFormLast5: [0, 0, 0, 0, 0],
        homeFormWeighted: 3.0,
        awayFormWeighted: 0.0,
        homeRestDays: 5,
        awayRestDays: 2,
        homeTravelKm: 0,
        homeElo: 1800,
        awayElo: 1200,
        eloDelta: 600,
        homeAttack: 2.0,
        homeDefense: 0.5,
        awayAttack: 0.5,
        awayDefense: 2.0,
        leagueAvgGoals: 2.5,
        isHomeAdvantage: true,
        leagueId: 'EPL',
        season: '2026',
        generatedAt: new Date()
      };

      // Mock dataset containing 2 favor-aligned matches
      const dataset = [
        { features: mockFeatures, outcome: 'home' as const },
        { features: { ...mockFeatures, homeElo: 1200, awayElo: 1800, outcome: 'away' }, outcome: 'away' as const }
      ];

      const report = await FeatureImportance.analyze(dataset);
      expect(report.length).toBe(4);
      expect(report[0].feature).toBeDefined();
      expect(report[0].importance).toBeGreaterThanOrEqual(0);
      expect(['positive', 'negative', 'neutral']).toContain(report[0].impact);
    });
  });

  describe('ComparisonMatrix', () => {
    it('should generate a formatted markdown comparison table', () => {
      const results: ComparisonResult[] = [
        {
          variant: 'Baseline Poisson',
          modelVersion: 'poisson-v1',
          featureVersion: 'basic-v1',
          metrics: { totalPredictions: 100, winRate: 0.55, roi: 5.2, avgBrierScore: 0.19, avgCLV: 0.015, totalProfit: 5.2 },
          vsBaseline: { winRateDelta: 0, roiDelta: 0, brierDelta: 0, clvDelta: 0 }
        },
        {
          variant: 'Dixon-Coles Variant',
          modelVersion: 'dixon-coles-v1',
          featureVersion: 'basic-v1',
          metrics: { totalPredictions: 100, winRate: 0.58, roi: 8.5, avgBrierScore: 0.18, avgCLV: 0.025, totalProfit: 8.5 },
          vsBaseline: { winRateDelta: 0.03, roiDelta: 3.3, brierDelta: -0.01, clvDelta: 0.01 }
        }
      ];

      const markdown = ComparisonMatrix.generate(results);
      expect(markdown).toContain('| Model / Variant | Features | Win Rate | ROI | Brier Score | CLV |');
      // Dixon-Coles has superior metrics, so it should be bolded and have a trophy icon
      expect(markdown).toContain('**8.50%** 🏆'); // ROI Winner
      expect(markdown).toContain('**58.00%** 🏆'); // Win Rate Winner
    });
  });

  describe('AblationRunner', () => {
    it('should run a comparative experiment and yield variant deltas', async () => {
      const config: ExperimentConfig = {
        name: 'Sprint 5 Ablation Run',
        baseline: { modelVersion: 'poisson-v1', featureVersion: 'basic-v1' },
        variants: [
          { name: 'Dixon-Coles Model', modelVersion: 'dixon-coles-v1', featureVersion: 'basic-v1' }
        ],
        dateRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
        markets: ['ML']
      };

      const mockDbResults = [
        {
          id: 'res-1',
          actual_home_score: 2,
          actual_away_score: 1,
          hit_1x2: true,
          hit_ah: false,
          hit_ou: false,
          profit_1x2: 1.0,
          profit_ah: 0,
          profit_ou: 0,
          predictions: {
            id: 'pred-1',
            match_id: 'match-1',
            market_type: 'ML',
            prediction: { pHome: 0.65, pDraw: 0.20, pAway: 0.15 },
            odds_snapshot: { homeOdds: 2.0, drawOdds: 3.0, awayOdds: 4.0 },
            closing_odds: { homeOdds: 2.10, drawOdds: 3.10, awayOdds: 4.10 },
            model_version: 'poisson-v1',
            brier_score: 0.15,
            clv: 0.05,
            created_at: new Date().toISOString()
          },
          matches: {
            id: 'match-1',
            league: 'Premier League',
            kickoff: new Date().toISOString()
          }
        }
      ];

      // Setup supabase mock for runner check
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'prediction_results') {
          return {
            select: vi.fn().mockResolvedValue({ data: mockDbResults, error: null })
          } as any;
        }
        if (table === 'matches') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gt: vi.fn().mockResolvedValue({ count: 10, error: null })
              }))
            }))
          } as any;
        }
        // Fallback for predictions table and others
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null })
                }))
              }))
            }))
          })),
          insert: vi.fn().mockResolvedValue({ data: null, error: null })
        } as any;
      });

      const report = await AblationRunner.runExperiment(config);
      expect(report.baseline.variant).toBe('Baseline');
      expect(report.baseline.metrics.totalPredictions).toBe(1);
      expect(report.variants.length).toBe(1);
      expect(report.variants[0].variant).toBe('Dixon-Coles Model');
    });
  });
});
