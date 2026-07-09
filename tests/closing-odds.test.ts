/**
 * Closing Odds Infrastructure — Tests
 * ======================================
 * Tests the capture engine, cron, and monitor components.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// Mock DB connection
const mockQuery = vi.fn();
vi.mock('@/lib/db/connection', () => ({
  query: (...args: any[]) => mockQuery(...args),
  transaction: async (fn: any) => fn(mockQuery),
}));

// Mock providers
vi.mock('@/lib/data/providers/odds/provider', () => ({
  OddsApiProvider: vi.fn().mockImplementation(() => ({
    name: 'the-odds-api',
    fetchOdds: vi.fn().mockResolvedValue([
      {
        id: 'odds-1',
        fixtureId: 'fixture-1',
        bookmaker: 'bet365',
        marketType: 'moneyline',
        line: 0,
        priceHome: 1.85,
        priceAway: 2.10,
        priceDraw: 3.40,
        capturedAt: new Date(),
        providerName: 'the-odds-api',
        rawResponseHash: 'hash1',
      },
    ]),
    normalizeMarket: vi.fn().mockReturnValue({
      marketType: 'moneyline',
      line: 0,
      homeOdds: 1.85,
      awayOdds: 2.10,
      drawOdds: 3.40,
      homeProb: 0.48,
      awayProb: 0.42,
      drawProb: 0.10,
      vig: 0.05,
    }),
    healthCheck: vi.fn().mockResolvedValue(true),
    getHealthStatus: vi.fn().mockResolvedValue({
      healthy: true,
      provider: 'the-odds-api',
      latencyMs: 150,
      lastChecked: new Date(),
    }),
  })),
}));

vi.mock('@/lib/data/providers/apiFootball/provider', () => ({
  ApiFootballProvider: vi.fn().mockImplementation(() => ({
    name: 'api-football',
    fetchFixtures: vi.fn().mockResolvedValue([]),
    healthCheck: vi.fn().mockResolvedValue(true),
  })),
}));

import { CaptureEngine, CAPTURE_SCHEDULE } from '@/lib/closing-odds/CaptureEngine';
import { CaptureMonitor } from '@/lib/closing-odds/CaptureMonitor';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const upcomingMatch = {
  id: 'match-1',
  fixtureExternalId: 'ext-1',
  homeTeam: 'Liverpool',
  awayTeam: 'Manchester City',
  league: 'EPL',
  kickoff: new Date(Date.now() + 3600000), // 1 hour from now
};

const matchAtKickoff = {
  id: 'match-2',
  fixtureExternalId: 'ext-2',
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  league: 'EPL',
  kickoff: new Date(Date.now() + 60000), // 1 minute from now
};

const finishedMatch = {
  id: 'match-3',
  fixtureExternalId: 'ext-3',
  homeTeam: 'Manchester United',
  awayTeam: 'Tottenham',
  league: 'EPL',
  kickoff: new Date(Date.now() - 7200000), // 2 hours ago
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CaptureEngine', () => {
  let engine: CaptureEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new CaptureEngine();
  });

  describe('determinePhase', () => {
    it('should return opening for matches far in the future', () => {
      const farMatch = {
        ...upcomingMatch,
        kickoff: new Date(Date.now() + 7 * 86400000), // 7 days
      };
      const phase = engine.determinePhase(farMatch);
      expect(phase).toBe('opening');
    });

    it('should return t-1h for matches 1 hour away', () => {
      const phase = engine.determinePhase(upcomingMatch);
      expect(phase).toBe('t-1h');
    });

    it('should return t-30m for matches 30 minutes away', () => {
      const nearMatch = {
        ...upcomingMatch,
        kickoff: new Date(Date.now() + 1800000), // 30 min
      };
      const phase = engine.determinePhase(nearMatch);
      expect(phase).toBe('t-30m');
    });

    it('should return t-5m for matches 1 minute before kickoff', () => {
      const phase = engine.determinePhase(matchAtKickoff);
      expect(phase).toBe('t-5m');
    });

    it('should return post-kickoff for matches just finished', () => {
      const recentMatch = {
        ...finishedMatch,
        kickoff: new Date(Date.now() - 600000), // 10 min ago
      };
      const phase = engine.determinePhase(recentMatch);
      expect(phase).toBe('post-kickoff');
    });

    it('should return null for matches far in the past', () => {
      const phase = engine.determinePhase(finishedMatch);
      expect(phase).toBeNull();
    });
  });

  describe('captureMatch', () => {
    it('should capture odds for a match at a given phase', async () => {
      // Mock DB insert to succeed
      mockQuery.mockImplementation(async (sql: string) => ({ rows: [] }));

      const results = await engine.captureMatch(upcomingMatch, 't-1h', ['moneyline']);
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].marketType).toBe('moneyline');
      expect(results[0].homeOdds).toBe(1.85);
      expect(results[0].awayOdds).toBe(2.10);
    });

    it('should handle market capture when provider returns empty odds', async () => {
      // Manually construct a provider with empty fetch behavior
      const emptyProvider = {
        name: 'the-odds-api',
        fetchOdds: vi.fn().mockResolvedValue([]),
        normalizeMarket: vi.fn().mockReturnValue({
          marketType: 'moneyline',
          line: 0,
          homeOdds: 1.85,
          awayOdds: 2.10,
          drawOdds: 3.40,
          homeProb: 0.48,
          awayProb: 0.42,
          drawProb: 0.10,
          vig: 0.05,
        }),
        healthCheck: vi.fn().mockResolvedValue(true),
        getHealthStatus: vi.fn().mockResolvedValue({
          healthy: true,
          provider: 'the-odds-api',
          latencyMs: 150,
          lastChecked: new Date(),
        }),
      } as any;

      const customEngine = new CaptureEngine(emptyProvider as any);
      mockQuery.mockResolvedValue({ rows: [] });

      const results = await customEngine.captureMatch(upcomingMatch, 't-1h', ['moneyline']);
      
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('No odds returned');
    });

    it('should capture all three markets', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const results = await engine.captureMatch(upcomingMatch, 't-1h', [
        'moneyline',
        'asian_handicap',
        'over_under',
      ]);
      
      expect(results).toHaveLength(3);
      expect(results.filter(r => r.success).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('runCapturePhase', () => {
    it('should filter matches by phase and capture', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await engine.runCapturePhase('t-1h', [upcomingMatch, matchAtKickoff, finishedMatch]);
      
      // Only upcomingMatch should be in t-1h phase
      expect(result.totalMatches).toBe(1);
      expect(result.status).toBe('success');
      expect(result.coveragePct).toBe(100);
    });

    it('should handle no eligible matches gracefully', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await engine.runCapturePhase('t-48h', [finishedMatch]);
      
      expect(result.totalMatches).toBe(0);
      expect(result.successfulCaptures).toBe(0);
    });
  });
});

describe('CAPTURE_SCHEDULE', () => {
  it('should define all 11 phases', () => {
    expect(CAPTURE_SCHEDULE).toHaveLength(11);
  });

  it('should have correct phase sequence', () => {
    const phases = CAPTURE_SCHEDULE.map(c => c.phase);
    expect(phases).toEqual([
      'opening',
      't-48h',
      't-24h',
      't-6h',
      't-3h',
      't-1h',
      't-30m',
      't-15m',
      't-5m',
      'kickoff',
      'post-kickoff',
    ]);
  });

  it('should mark t-15m, t-5m, kickoff as closing odds updaters', () => {
    const updaters = CAPTURE_SCHEDULE.filter(c => c.updatesClosingOdds).map(c => c.phase);
    expect(updaters).toEqual(['t-15m', 't-5m', 'kickoff']);
  });
});

describe('CaptureMonitor', () => {
  let monitor: CaptureMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    monitor = new CaptureMonitor();
  });

  describe('getHealthMetrics', () => {
    it('should return zero metrics when DB is empty', async () => {
      mockQuery.mockResolvedValue({ rows: [{ count: '0' }] });

      const metrics = await monitor.getHealthMetrics();

      expect(metrics.closingOddsCoverage).toBe(0);
      expect(metrics.totalMatchesTracked).toBe(0);
      expect(metrics.totalCapturesToday).toBe(0);
      expect(metrics.missingClosingOdds).toBe(0);
    });

    it('should compute coverage correctly', async () => {
      // Mock multiple queries
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })  // total matches
        .mockResolvedValueOnce({ rows: [{ with_closing: '8', total: '10' }] })  // closing odds
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })  // late captures
        .mockResolvedValueOnce({ rows: [{ avg_delay: '30' }] })  // avg delay
        .mockResolvedValueOnce({ rows: [{ dup_count: '0' }] })  // duplicates
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })  // invalid
        .mockResolvedValueOnce({ rows: [{ retried: '2', retry_success: '2' }] })  // retries
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });  // today's captures

      const metrics = await monitor.getHealthMetrics();

      expect(metrics.closingOddsCoverage).toBe(80); // 8/10
      expect(metrics.missingClosingOdds).toBe(2);
      expect(metrics.missingClosingOddsPct).toBe(20);
      expect(metrics.lateCaptureCount).toBe(0);
      expect(metrics.averageCaptureDelay).toBe(30);
      expect(metrics.duplicateCount).toBe(0);
      expect(metrics.retrySuccessRate).toBe(100);
      expect(metrics.totalCapturesToday).toBe(5);
    });
  });

  describe('getTargetComparison', () => {
    it('should mark status based on thresholds', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [{ with_closing: '10', total: '10' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ avg_delay: '30' }] })
        .mockResolvedValueOnce({ rows: [{ dup_count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ retried: '1', retry_success: '1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '3' }] });

      const targets = await monitor.getTargetComparison();

      const coverageTarget = targets.find(t => t.metric === 'Closing Odds Coverage');
      expect(coverageTarget?.status).toBe('✅');
      expect(coverageTarget?.actual).toBe('100%');

      const delayTarget = targets.find(t => t.metric === 'Capture Delay');
      expect(delayTarget?.status).toBe('✅');
      expect(delayTarget?.actual).toBe('30s');
    });
  });

  describe('generateReport', () => {
    it('should generate a markdown report', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [{ with_closing: '10', total: '10' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ avg_delay: '30' }] })
        .mockResolvedValueOnce({ rows: [{ dup_count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ retried: '1', retry_success: '1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        // League coverage
        .mockResolvedValueOnce({ rows: [{
          league: 'EPL', total_fixtures: '5', with_opening: '5',
          with_closing: '5', with_any_movement: '5', avg_delay: '25',
        }] })
        // Market coverage
        .mockResolvedValueOnce({ rows: [{
          market_type: 'moneyline', fixtures_covered: '5', total_fixtures: '5', avg_movement: '0.02',
        }] });

      const report = await monitor.generateReport();

      expect(report).toContain('# Closing Odds Capture Report');
      expect(report).toContain('Target vs Actual');
      expect(report).toContain('Per-League Coverage');
      expect(report).toContain('Per-Market Coverage');
    });
  });
});