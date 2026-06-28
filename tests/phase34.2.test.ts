import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as dataHealthGET } from '../src/app/api/admin/data-health/route';
import { POST as dryRunPOST } from '../src/app/api/admin/prediction-validation/route';
import { supabase } from '../src/lib/supabase.server';

// Mock Supabase Server Client
let mockMatches: any[] = [];
let mockOdds: any[] = [];
let mockSignals: any[] = [];
let mockRatings: any[] = [];

vi.mock('../src/lib/supabase.server', () => {
  const chain: any = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    gte: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    not: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => chain),
    insert: vi.fn().mockImplementation(() => chain),
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
      } else if (chain._currentTable === 'odds_snapshots') {
        resolve({ data: mockOdds, error: null });
      } else if (chain._currentTable === 'signals') {
        resolve({ data: mockSignals, error: null });
      } else {
        resolve({ data: [], error: null });
      }
    })
  };

  // Capture equality checks
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

describe('Phase 34.2: Live Prediction Validation & Competition Coverage tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatches = [];
    mockOdds = [];
    mockSignals = [];
    mockRatings = [];
    process.env.ADMIN_SECRET = 'test_admin_secret';
  });

  describe('Part 1, 2, 3, 5 & 7: Data Health Extension & Production Readiness', () => {
    it('should aggregate coverage, validate registries, and return the Production Readiness Report', async () => {
      mockMatches = [
        { id: 'match-1', league: 'FIFA World Cup' },
        { id: 'match-2', league: 'FIFA World Cup' },
        { id: 'match-3', league: 'Premier League' }
      ];

      mockOdds = [
        { match_id: 'match-1', captured_at: new Date().toISOString(), odds_home: 1.95, odds_away: 1.90, handicap_line: -0.25 },
        { match_id: 'match-2', captured_at: new Date().toISOString(), odds_home: 1.85, odds_away: 2.05, handicap_line: 0.0 }
      ];

      mockSignals = [
        { id: 'sig-1', league: 'FIFA World Cup', market: 'asian_handicap', market_category: 'asian_handicap' },
        { id: 'sig-2', league: 'FIFA World Cup', market: 'moneyline', market_category: 'moneyline' },
        { id: 'sig-3', league: 'FIFA World Cup', market: 'over_under', market_category: 'over_under' }
      ];

      const request = new Request('http://localhost/api/admin/data-health', {
        headers: { 'x-admin-secret': 'test_admin_secret' }
      });

      const response = await dataHealthGET(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.competition_coverage).toBeDefined();

      const wcCoverage = json.competition_coverage.find((c: any) => c.competition === 'FIFA World Cup');
      expect(wcCoverage.fixtures).toBe(2);
      expect(wcCoverage.with_odds).toBe(2);
      expect(wcCoverage.with_signals).toBe(3);

      expect(json.world_cup_priority_validation.valid).toBe(true);
      expect(json.world_cup_priority_validation.markets_covered.AH).toBe(true);
      expect(json.world_cup_priority_validation.markets_covered.OU).toBe(true);
      expect(json.world_cup_priority_validation.markets_covered.ML).toBe(true);

      expect(json.prediction_readiness_report.status).toBeDefined();
    });
  });

  describe('Part 4: Real Prediction Dry Run POST Trigger', () => {
    it('should complete dry run and report skip reasons without inserting new signals', async () => {
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

      const request = new Request('http://localhost/api/admin/prediction-validation', {
        method: 'POST',
        headers: {
          'x-admin-secret': 'test_admin_secret',
          'content-type': 'application/json'
        },
        body: JSON.stringify({ competition_id: 'world_cup_2026' })
      });

      const response = await dryRunPOST(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.fixtures_checked).toBe(1);
      expect(json.odds_found).toBe(1);
      expect(json.reasons_skipped).toBeDefined();
    });
  });
});
