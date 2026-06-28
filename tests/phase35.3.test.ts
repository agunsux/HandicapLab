import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as shadowRunPOST } from '../src/app/api/admin/shadow-run/route';
import { GET as shadowPerformanceGET } from '../src/app/api/admin/shadow-performance/route';
import { supabase } from '../src/lib/supabase.server';

// Mock Supabase Server Client
let mockMatches: any[] = [];
let mockOdds: any[] = [];
let mockRatings: any[] = [];
let mockShadowPredictions: any[] = [];

vi.mock('../src/lib/supabase.server', () => {
  const chain: any = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation((col, val) => {
      chain._filters = chain._filters || {};
      chain._filters[col] = val;
      chain._eqVal = val;
      return chain;
    }),
    in: vi.fn().mockImplementation(() => chain),
    not: vi.fn().mockImplementation(() => chain),
    or: vi.fn().mockImplementation(() => chain),
    lt: vi.fn().mockImplementation(() => chain),
    gt: vi.fn().mockImplementation(() => chain),
    lte: vi.fn().mockImplementation(() => chain),
    gte: vi.fn().mockImplementation(() => chain),
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
      if (chain._currentTable === 'matches') {
        const match = mockMatches.find(m => m.id === chain._eqVal);
        return Promise.resolve({ data: match || null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
    single: vi.fn().mockImplementation(() => {
      if (chain._currentTable === 'team_ratings') {
        const rating = mockRatings.find(r => r.team_id === chain._eqVal);
        return Promise.resolve({ data: rating || null, error: null });
      }
      if (chain._currentTable === 'odds_snapshots') {
        const snap = mockOdds.find(o => o.match_id === chain._eqVal);
        return Promise.resolve({ data: snap || null, error: null });
      }
      if (chain._currentTable === 'matches') {
        const match = mockMatches.find(m => m.id === chain._eqVal);
        return Promise.resolve({ data: match || null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
    insert: vi.fn().mockImplementation((data) => {
      if (Array.isArray(data)) {
        mockShadowPredictions.push(...data);
      } else {
        mockShadowPredictions.push(data);
      }
      return Promise.resolve({ error: null });
    }),
    update: vi.fn().mockImplementation((data) => {
      chain._updateData = data;
      chain._currentAction = 'update';
      return chain;
    }),
    then: vi.fn().mockImplementation((resolve) => {
      if (chain._currentAction === 'update') {
        chain._currentAction = null;
        const target = mockShadowPredictions.find(p => p.id === chain._eqVal);
        if (target && chain._updateData) {
          Object.assign(target, chain._updateData);
        }
        chain._updateData = null;
        resolve({ error: null });
        return;
      }
      if (chain._currentTable === 'matches') {
        let data = [...mockMatches];
        if (chain._filters) {
          if (chain._filters.status) {
            data = data.filter(m => m.status === chain._filters.status);
          }
          if (chain._filters.league) {
            data = data.filter(m => m.league === chain._filters.league);
          }
        }
        chain._filters = null;
        resolve({ data, error: null });
      } else if (chain._currentTable === 'shadow_predictions') {
        let data = [...mockShadowPredictions];
        if (chain._eqVal === 'pending') {
          data = data.filter(p => p.result_status === 'pending');
        } else {
          data = data.filter(p => p.result_status !== 'pending');
        }
        resolve({ data, error: null });
      } else {
        resolve({ data: [], error: null });
      }
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

describe('Phase 35.3: Real Data Validation & Shadow Mode tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatches = [];
    mockOdds = [];
    mockRatings = [];
    mockShadowPredictions = [];
  });

  describe('Part 1 & 2: Shadow Mode Runner & Groupings', () => {
    it('should query upcoming matches, calculate internal signals, and insert to shadow_predictions', async () => {
      // Historical matches to satisfy FeatureEngine build queries
      mockMatches = [
        { id: 'match-1', league: 'FIFA World Cup', status: 'upcoming', kickoff: new Date().toISOString(), home_team: 'Brazil', away_team: 'Germany', home_goals: null, away_goals: null },
        { id: 'hist-1', league: 'FIFA World Cup', status: 'finished', home_team: 'Brazil', away_team: 'Germany', home_score: 2, away_score: 1, goals_home: 2, goals_away: 1, home_goals: 2, away_goals: 1, kickoff: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString() },
        { id: 'hist-2', league: 'FIFA World Cup', status: 'finished', home_team: 'Germany', away_team: 'Brazil', home_score: 1, away_score: 2, goals_home: 1, goals_away: 2, home_goals: 1, away_goals: 2, kickoff: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString() }
      ];

      mockRatings = [
        { team_id: 'Brazil', attack_strength: 5.0, defense_strength: 0.1 },
        { team_id: 'Germany', attack_strength: 0.1, defense_strength: 5.0 }
      ];

      mockOdds = [
        { match_id: 'match-1', captured_at: new Date().toISOString(), odds_home: 1.95, odds_away: 1.90, handicap_line: -0.25 }
      ];

      const request = new Request('http://localhost/api/admin/shadow-run', {
        method: 'POST',
        body: JSON.stringify({ competition: 'FIFA World Cup' })
      });

      const response = await shadowRunPOST(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.fixtures_checked).toBe(1);
      expect(json.odds_available).toBe(1);
      expect(mockShadowPredictions.length).toBeGreaterThan(0);
    });
  });

  describe('Part 4 & 5: Shadow Outcomes Settlement & Aggregates Dashboard', () => {
    it('should compare prediction picks vs completed match scores, compute CLV, and aggregate ROI/winrates', async () => {
      mockMatches = [
        { id: 'match-1', status: 'finished', home_score: 2, away_score: 0, goals_home: 2, goals_away: 0, home_goals: 2, away_goals: 0 }
      ];

      mockOdds = [
        { match_id: 'match-1', odds_home: 1.90 }
      ];

      mockShadowPredictions = [
        {
          id: 'pred-1',
          fixture_id: 'match-1',
          competition: 'FIFA World Cup',
          market_type: 'ML',
          predicted_pick: 'home',
          predicted_probability: 0.65,
          predicted_edge: 5.2,
          odds_at_prediction: 1.95,
          result_status: 'pending'
        }
      ];

      const request = new Request('http://localhost/api/admin/shadow-performance');
      const response = await shadowPerformanceGET(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);

      expect(mockShadowPredictions[0].result_status).toBe('won');
      expect(mockShadowPredictions[0].clv).toBeCloseTo(2.63, 1);
      expect(json.settled_count).toBe(1);
      expect(json.win_rate).toBe(100.0);
    });
  });
});
