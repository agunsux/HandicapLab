import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as simulationPOST } from '../src/app/api/admin/market-simulation/route';
import { supabase } from '../src/lib/supabase.server';

// Mock Supabase Server Client
let mockMatches: any[] = [];
let mockOdds: any[] = [];
let mockRatings: any[] = [];

vi.mock('../src/lib/supabase.server', () => {
  const chain: any = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    gte: vi.fn().mockImplementation(() => chain),
    lte: vi.fn().mockImplementation(() => chain),
    not: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => chain),
    maybeSingle: vi.fn().mockImplementation(() => {
      if (chain._currentTable === 'team_ratings') {
        const rating = mockRatings.find(r => r.team_id === chain._eqVal);
        return Promise.resolve({ data: rating || null, error: null });
      }
      if (chain._currentTable === 'odds_snapshots') {
        const snap = mockOdds.find(o => o.match_id === chain._eqVal);
        return Promise.resolve({ data: snap || null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
    eqVal: vi.fn().mockImplementation((val) => {
      chain._eqVal = val;
      return chain;
    }),
    then: vi.fn().mockImplementation((resolve) => {
      if (chain._currentTable === 'matches') {
        resolve({ data: mockMatches, error: null });
      } else {
        resolve({ data: [], error: null });
      }
    })
  };

  chain.eq = vi.fn().mockImplementation((col, val) => {
    chain._eqVal = val;
    return chain;
  });

  return {
    supabase: {
      from: vi.fn((table: string) => {
        chain._currentTable = table;
        return chain;
      }),
      rpc: vi.fn()
    }
  };
});

describe('Phase 34.3: Real Market Simulation & Signal Verification tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatches = [];
    mockOdds = [];
    mockRatings = [];
    process.env.ADMIN_SECRET = 'test_admin_secret';
  });

  describe('Part 1, 2, 3 & 4: Market Simulation Runner & Reports', () => {
    it('should complete simulation run, return signal quality checks, and output coverage summaries', async () => {
      mockMatches = [
        { id: 'match-1', league: 'FIFA World Cup', status: 'upcoming', kickoff: new Date().toISOString(), home_team: 'Brazil', away_team: 'Germany' }
      ];

      mockRatings = [
        { team_id: 'Brazil', attack_strength: 1.25, defense_strength: 0.85 },
        { team_id: 'Germany', attack_strength: 1.10, defense_strength: 0.95 }
      ];

      mockOdds = [
        { match_id: 'match-1', captured_at: new Date().toISOString(), odds_home: 1.95, odds_away: 1.90, handicap_line: -0.25 }
      ];

      const request = new Request('http://localhost/api/admin/market-simulation', {
        method: 'POST',
        headers: {
          'x-admin-secret': 'test_admin_secret',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
          competition: 'FIFA World Cup'
        })
      });

      const response = await simulationPOST(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.matches_analyzed).toBe(1);
      expect(json.markets_analyzed.AH).toBe(1);
      expect(json.signals).toBeDefined();

      if (json.signals.length > 0) {
        const sig = json.signals[0];
        expect(sig.Match).toBe('Brazil vs Germany');
        expect(sig.Bookmaker).toBe('Pinnacle');
        expect(sig.Confidence).toBeDefined();
        expect(sig.Edge).toBeDefined();
      }

      expect(json.simulation_report.odds_coverage).toBe(100.0);
    });
  });

  describe('Part 5: WORLD_CUP_MODE preset test', () => {
    it('should execute simulation using WORLD_CUP_MODE configuration successfully', async () => {
      mockMatches = [
        { id: 'match-1', league: 'FIFA World Cup', status: 'upcoming', kickoff: new Date().toISOString(), home_team: 'Brazil', away_team: 'Germany' }
      ];

      mockRatings = [
        { team_id: 'Brazil', attack_strength: 1.25, defense_strength: 0.85 },
        { team_id: 'Germany', attack_strength: 1.10, defense_strength: 0.95 }
      ];

      mockOdds = [
        { match_id: 'match-1', captured_at: new Date().toISOString(), odds_home: 1.95, odds_away: 1.90, handicap_line: -0.25 }
      ];

      const request = new Request('http://localhost/api/admin/market-simulation', {
        method: 'POST',
        headers: {
          'x-admin-secret': 'test_admin_secret',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          competition: 'WORLD_CUP_MODE'
        })
      });

      const response = await simulationPOST(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.competition).toBe('WORLD_CUP_MODE');
    });
  });
});
