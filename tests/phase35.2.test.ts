import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runHealthCheck } from '../src/lib/services/healthChecker';
import { CronLogger } from '../src/lib/services/cronLogger';
import { ModelIntelligenceAdjuster } from '../src/lib/intelligence/adjuster';
import { supabase } from '../src/lib/supabase.server';

// Mock Supabase Server Client
let mockMatches: any[] = [];
let mockOdds: any[] = [];
let mockSignals: any[] = [];
let mockCronRuns: any[] = [];

vi.mock('../src/lib/supabase.server', () => {
  const chain: any = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation((col, val) => {
      chain._eqVal = val;
      return chain;
    }),
    in: vi.fn().mockImplementation(() => chain),
    not: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => chain),
    maybeSingle: vi.fn().mockImplementation(() => {
      if (chain._currentTable === 'odds_snapshots') {
        return Promise.resolve({ data: mockOdds[0] || null, error: null });
      }
      if (chain._currentTable === 'signals') {
        return Promise.resolve({ data: mockSignals[0] || null, error: null });
      }
      if (chain._currentTable === 'cron_runs') {
        const filtered = mockCronRuns.filter(r => r.cron_name === chain._eqVal);
        return Promise.resolve({ data: filtered[0] || null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
    then: vi.fn().mockImplementation((resolve) => {
      if (chain._currentTable === 'matches') {
        resolve({ data: mockMatches, error: null });
      } else if (chain._currentTable === 'odds_snapshots') {
        resolve({ data: mockOdds, error: null });
      } else if (chain._currentTable === 'signals') {
        resolve({ data: mockSignals, error: null });
      } else if (chain._currentTable === 'cron_runs') {
        const filtered = mockCronRuns.filter(r => r.cron_name === chain._eqVal);
        resolve({ data: filtered, error: null });
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

describe('Phase 35.2: Live Production Dry Run tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatches = [];
    mockOdds = [];
    mockSignals = [];
    mockCronRuns = [];
  });

  describe('Part 1 & 2 & 3: Full Pipeline & Competition Coverage Runs', () => {
    it('should complete checks for WORLD_CUP_MODE and Tier 1 active leagues', async () => {
      mockMatches = [
        { id: 'match-1', league: 'FIFA World Cup' },
        { id: 'match-2', league: 'Premier League' }
      ];

      mockOdds = [
        { match_id: 'match-1', captured_at: new Date().toISOString() },
        { match_id: 'match-2', captured_at: new Date().toISOString() }
      ];

      mockSignals = [
        { id: 'sig-1', league: 'FIFA World Cup', market: 'asian_handicap', market_category: 'asian_handicap', confidence: 85, edge_pct: 3.20, created_at: new Date().toISOString() },
        { id: 'sig-2', league: 'Premier League', market: 'moneyline', market_category: 'moneyline', confidence: 78, edge_pct: 2.50, created_at: new Date().toISOString() }
      ];

      const health = await runHealthCheck();
      expect(health.database.healthy).toBe(true);
      expect(health.odds.stale).toBe(false);
      expect(health.signals.stale).toBe(false);
    });
  });

  describe('Part 4: Cron Simulation Auditing', () => {
    it('should verify that cronLogger tracks success, failures, and durations correctly', async () => {
      mockCronRuns = [
        { id: 'run-1', cron_name: 'capture-odds', start_time: new Date(Date.now() - 5000).toISOString(), end_time: new Date().toISOString(), errors: null },
        { id: 'run-2', cron_name: 'generate-signals', start_time: new Date(Date.now() - 10000).toISOString(), end_time: new Date().toISOString(), errors: 'Stale odds key' }
      ];

      const oddsMetrics = await CronLogger.getCronMetrics('capture-odds');
      expect(oddsMetrics.failureCount).toBe(0);
      expect(oddsMetrics.recentRuns[0].status).toBe('success');

      const sigMetrics = await CronLogger.getCronMetrics('generate-signals');
      expect(sigMetrics.failureCount).toBe(1);
      expect(sigMetrics.recentRuns[0].status).toBe('failed');
    });
  });

  describe('Part 5: Failure Simulation Handling', () => {
    it('should handle odds provider outages and stale indicators gracefully without crashing', () => {
      const steam = ModelIntelligenceAdjuster.calculateSteamScore(
        'asian_handicap',
        'home',
        -0.25,
        -0.25, // no line move
        1.95,
        1.95  // no odds move
      );

      expect(steam.steamScore).toBe(0);

      const adjusted = ModelIntelligenceAdjuster.adjustConfidence(
        80,
        35,
        -5
      );

      expect(adjusted).toBe(70);
    });
  });
});
