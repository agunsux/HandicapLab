import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelIntelligenceAdjuster } from '../src/lib/intelligence/adjuster';
import { PerformanceAttribution } from '../src/lib/intelligence/attribution';
import { StrategyDecayMonitor } from '../src/lib/intelligence/decay';
import { GET as healthGET } from '../src/app/api/admin/model-health/route';
import { supabase } from '../src/lib/supabase.server';

// Mock Supabase client
let mockSignalsStore: any[] = [];
vi.mock('../src/lib/supabase.server', () => {
  const chain: any = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    insert: vi.fn().mockImplementation(() => chain),
    maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
    then: vi.fn().mockImplementation((resolve) => {
      resolve({ data: mockSignalsStore, error: null });
    })
  };
  return {
    supabase: {
      from: vi.fn((table: string) => {
        chain._currentTable = table;
        return chain;
      })
    }
  };
});

describe('Phase 34.1: Prediction Edge Intelligence Layer tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignalsStore = [];
  });

  describe('Part 1 & Part 3: Performance Attribution & Calibration Buckets', () => {
    it('should map confidence and odds into correct attribution buckets', () => {
      expect(PerformanceAttribution.getConfidenceBucket(0.85)).toBe('80-90');
      expect(PerformanceAttribution.getConfidenceBucket(92)).toBe('90+');
      expect(PerformanceAttribution.getConfidenceBucket(0.65)).toBe('60-70');

      expect(PerformanceAttribution.getOddsRange(1.50)).toBe('<1.70');
      expect(PerformanceAttribution.getOddsRange(1.85)).toBe('1.70-2.00');
      expect(PerformanceAttribution.getOddsRange(2.10)).toBe('>2.00');
    });

    it('should insert attribution metrics correctly during logAttribution call', async () => {
      const mockSignal = {
        id: 'sig-att-1',
        confidence: 82,
        odds: 1.95,
        market: 'asian_handicap',
        league: 'Premier League'
      };

      await PerformanceAttribution.logAttribution(mockSignal, 'won', 0.95, 0.05);
      expect(supabase.from).toHaveBeenCalledWith('signal_performance_attribution');
    });
  });

  describe('Part 2: League Quality Score', () => {
    it('should compute dynamic quality score using weighted metrics', () => {
      // High stats: ROI=12%, CLV=3.2%, sample=120, liquidity=90
      // roiWeight = 30, clvWeight = 30, sampleWeight = 20, liquidityWeight = 18 -> 98 pts
      const highScore = ModelIntelligenceAdjuster.calculateLeagueQualityScore(12, 3.2, 120, 90);
      expect(highScore).toBe(98);

      // Low stats: ROI=-4%, CLV=-0.5%, sample=5, liquidity=40
      // roiWeight = 0, clvWeight = 0, sampleWeight = 5, liquidityWeight = 8 -> 13 pts
      const lowScore = ModelIntelligenceAdjuster.calculateLeagueQualityScore(-4, -0.5, 5, 40);
      expect(lowScore).toBe(13);
    });
  });

  describe('Part 4: Strategy Health Decay Monitor', () => {
    it('should evaluate strategy health status based on rolling windows', () => {
      // Create 40 signals with won status (100% win rate)
      const healthySignals = Array.from({ length: 40 }, (_, i) => ({
        status: 'won',
        odds: 2.0,
        clv_percentage: 2.5,
        settled_at: new Date(Date.now() - i * 3600 * 1000).toISOString()
      }));

      const healthyRes = StrategyDecayMonitor.evaluateHealth(healthySignals);
      expect(healthyRes.status).toBe('healthy');
      expect(healthyRes.rolling30.winRate).toBe(100.0);

      // Create signals with high loss count (degraded status)
      const degradedSignals = Array.from({ length: 40 }, (_, i) => ({
        status: 'lost',
        odds: 2.0,
        clv_percentage: -3.0,
        settled_at: new Date(Date.now() - i * 3600 * 1000).toISOString()
      }));

      const degradedRes = StrategyDecayMonitor.evaluateHealth(degradedSignals);
      expect(degradedRes.status).toBe('degraded');
      expect(degradedRes.rolling30.roi).toBe(-100.0);
    });
  });

  describe('Part 5: Market Movement Steam Score', () => {
    it('should calculate correct line movement and steam score for Asian Handicap', () => {
      // Selection home expects line movement to go more negative (AH -0.25 -> AH -0.5)
      const resHomeSteam = ModelIntelligenceAdjuster.calculateSteamScore(
        'asian_handicap',
        'home',
        -0.25,
        -0.5,
        1.90,
        1.85
      );
      expect(resHomeSteam.lineMove).toBe(-0.25);
      expect(resHomeSteam.steamScore).toBe(5);

      // Selection home with line move going positive (AH -0.25 -> AH 0.0) -> against pick
      const resHomeAntiSteam = ModelIntelligenceAdjuster.calculateSteamScore(
        'asian_handicap',
        'home',
        -0.25,
        0.0,
        1.90,
        2.05
      );
      expect(resHomeAntiSteam.steamScore).toBe(-5);
    });

    it('should calculate correct odds steam score for Moneyline', () => {
      // Moneyline with dropping odds -> steam in favor
      const resMLSteam = ModelIntelligenceAdjuster.calculateSteamScore(
        'moneyline',
        'home',
        0.0,
        0.0,
        2.10,
        1.85
      );
      expect(resMLSteam.steamScore).toBe(5);
    });
  });

  describe('Part 6: Model Health API Route', () => {
    it('should compile and return health statistics and dimensions correctly', async () => {
      mockSignalsStore = [
        { id: 'sig_1', status: 'won', odds: 2.00, clv_percentage: 2.50, league: 'Premier League', market: 'asian_handicap', confidence: 85 },
        { id: 'sig_2', status: 'lost', odds: 1.95, clv_percentage: -1.00, league: 'Premier League', market: 'asian_handicap', confidence: 85 }
      ];

      const request = new Request('http://localhost/api/admin/model-health');
      const response = await healthGET(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.overall.total_signals).toBe(2);
      expect(json.overall.roi).toBe(0.0); // (100 - 100) / 2 = 0
      expect(json.by_competition[0].competition).toBe('Premier League');
      expect(json.by_market[0].market).toBe('asian_handicap');
    });
  });
});
