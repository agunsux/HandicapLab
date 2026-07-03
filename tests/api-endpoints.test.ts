import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as fixturesGET } from '../src/app/api/fixtures/route';
import { GET as probsGET } from '../src/app/api/probabilities/route';
import { GET as confGET } from '../src/app/api/confidence/route';
import { GET as resultsGET } from '../src/app/api/results/route';
import { GET as backtestGET } from '../src/app/api/backtest/route';
import { GET as dashboardGET } from '../src/app/api/dashboard/route';
import { supabase } from '../src/lib/supabase.server';

// Create a globally accessible mock chain object
const mockChain = {
  select: vi.fn(),
  in: vi.fn(),
  eq: vi.fn(),
  not: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  maybeSingle: vi.fn(),
  single: vi.fn()
};

// Mock Supabase
vi.mock('../src/lib/supabase.server', () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn()
    }
  };
});

describe('New API Endpoints', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Set up default chain method returns
    mockChain.select.mockReturnValue(mockChain);
    mockChain.in.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);
    mockChain.not.mockReturnValue(mockChain);
    mockChain.order.mockReturnValue(mockChain);
    mockChain.limit.mockReturnValue(mockChain);
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockChain.single.mockResolvedValue({ data: {}, error: null });

    // Make supabase.from always return our mockChain
    vi.mocked(supabase.from).mockReturnValue(mockChain as any);
  });

  it('/api/fixtures should return a list of matches', async () => {
    const mockMatches = [
      { id: 'match_1', home_team: 'Chelsea', away_team: 'Arsenal', kickoff: '2026-07-04T12:00:00Z', status: 'upcoming' }
    ];
    
    mockChain.limit.mockResolvedValue({ data: mockMatches, error: null } as any);

    const req = new Request('http://localhost/api/fixtures');
    const res = await fixturesGET(req as any);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.count).toBe(1);
    expect(json.data.fixtures[0].home_team).toBe('Chelsea');
  });

  it('/api/probabilities should return match probabilities', async () => {
    const mockPredictions = [
      {
        match_id: 'match_1',
        market_type: 'ML',
        prediction: {
          pHome: 0.60,
          pDraw: 0.25,
          pAway: 0.15,
          expected_goals: 2.85,
          pBttsYes: 0.62,
          pBttsNo: 0.38,
          calibrationApplied: true
        }
      }
    ];

    mockChain.eq.mockResolvedValue({ data: mockPredictions, error: null } as any);

    const req = new Request('http://localhost/api/probabilities?matchId=match_1');
    const res = await probsGET(req as any);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.moneyline.home).toBe(0.60);
    expect(json.data.expected_goals).toBe(2.85);
    expect(json.data.btts.yes).toBe(0.62);
  });

  it('/api/confidence should return confidence breakdown', async () => {
    const mockPredictions = [
      {
        id: 'pred_1',
        match_id: 'match_1',
        confidence: 82,
        market_confidence_score: 82,
        prediction: {
          confidence: {
            confidenceScore: 82,
            dataQualityScore: 88,
            recommendationStatus: 'Recommended',
            reasons: ['Confirmed starting lineup', 'High historical calibration'],
            modelConfidence: 0.85,
            dataConfidence: 0.82,
            marketConfidence: 0.80,
            finalConfidence: 0.82
          }
        }
      }
    ];

    mockChain.limit.mockResolvedValue({ data: mockPredictions, error: null } as any);

    const req = new Request('http://localhost/api/confidence?matchId=match_1');
    const res = await confGET(req as any);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.confidence_score).toBe(82);
    expect(json.data.data_quality_score).toBe(88);
    expect(json.data.recommendation_status).toBe('Recommended');
    expect(json.data.reasons).toContain('Confirmed starting lineup');
  });

  it('/api/results should return match results', async () => {
    const mockResults = [
      { id: 'match_2', home_team: 'Chelsea', away_team: 'Arsenal', home_goals: 2, away_goals: 1, status: 'finished' }
    ];

    mockChain.limit.mockResolvedValue({ data: mockResults, error: null } as any);

    const req = new Request('http://localhost/api/results');
    const res = await resultsGET(req as any);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.count).toBe(1);
    expect(json.data.results[0].home_goals).toBe(2);
  });

  it('/api/backtest should compute ROI and win rates', async () => {
    const mockPredictions = [
      { id: 'p1', market_type: 'AH', brier_score: 0.09, clv: 0.04 }
    ];
    const mockTrades = [
      { id: 't1', profit: 0.091, stake: 0.1, status: 'settled' }
    ];

    // Modify mock chain behaviour specifically for this test
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const mockTableChain = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(),
        single: vi.fn()
      };
      
      if (table === 'predictions') {
        mockTableChain.not.mockResolvedValue({ data: mockPredictions, error: null } as any);
      } else if (table === 'paper_trades') {
        mockTableChain.eq.mockResolvedValue({ data: mockTrades, error: null } as any);
      }
      
      return mockTableChain as any;
    });

    const req = new Request('http://localhost/api/backtest');
    const res = await backtestGET(req as any);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.roi_percentage).toBe(91); // (0.091 / 0.1) * 100
    expect(json.data.avg_clv_percentage).toBe(4);
    expect(json.data.avg_brier_score).toBe(0.09);
  });

  it('/api/dashboard should return unified dashboard data', async () => {
    const mockMatches = [
      { id: 'match_d1', home_team: 'Chelsea', away_team: 'Arsenal', kickoff: '2026-07-04T12:00:00Z', status: 'upcoming', league: 'EPL', competition_type: 'club' }
    ];
    const mockPredictions = [
      {
        id: 'pred_d1',
        match_id: 'match_d1',
        market_type: 'ML',
        selection: 'home',
        entry_odds: 1.95,
        model_probability: 0.55,
        edge_pct: 2.25,
        expected_value: 0.0725,
        confidence: 82,
        prediction: {
          confidence: {
            confidenceScore: 82,
            dataQualityScore: 88,
            recommendationStatus: 'Recommended',
            reasons: ['Confirmed starting lineup', 'High historical calibration']
          }
        }
      }
    ];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const mockTableChain = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(),
        single: vi.fn()
      };
      
      if (table === 'matches') {
        mockTableChain.in.mockReturnThis();
        mockTableChain.order.mockReturnThis();
        mockTableChain.limit.mockResolvedValue({ data: mockMatches, error: null } as any);
      } else if (table === 'predictions') {
        mockTableChain.in.mockResolvedValue({ data: mockPredictions, error: null } as any);
      }
      
      return mockTableChain as any;
    });

    const req = new Request('http://localhost/api/dashboard');
    const res = await dashboardGET(req as any);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.todayMatches.length).toBe(1);
    expect(json.data.todayMatches[0].home_team).toBe('Chelsea');
    expect(json.data.todayMatches[0].recommendation_status).toBe('Recommended');
    expect(json.data.valueBets.length).toBe(1);
    expect(json.data.valueBets[0].market).toBe('ML');
    expect(json.data.valueBets[0].ev).toBe(0.0725);
  });
});
