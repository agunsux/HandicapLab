import { describe, it, expect, vi, beforeEach } from 'vitest';
import { middleware } from '../src/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { runHealthCheck } from '../src/lib/services/healthChecker';
import { CronLogger } from '../src/lib/services/cronLogger';
import { ApiHelper } from '../src/lib/utils/apiHelper';
import { GET as launchReadinessGET } from '../src/app/api/admin/launch-readiness/route';
import { supabase } from '../src/lib/supabase.server';

// Mock Supabase Server Client
let mockMatches: any[] = [];
let mockOdds: any[] = [];
let mockSignals: any[] = [];
let mockCronRuns: any[] = [];

vi.mock('../src/lib/supabase.server', () => {
  const chain: any = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
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
        return Promise.resolve({ data: mockCronRuns[0] || null, error: null });
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
        resolve({ data: mockCronRuns, error: null });
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

describe('Phase 35.1: Production Hardening Integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatches = [];
    mockOdds = [];
    mockSignals = [];
    mockCronRuns = [];
    process.env.ADMIN_SECRET = 'super_secret';
  });

  describe('Part 1: Health System Integration', () => {
    it('should calculate DB latency, check odds/signals stale status, and map readiness', async () => {
      mockMatches = [{ id: 'match-1' }];
      mockOdds = [{ captured_at: new Date().toISOString() }];
      mockSignals = [{ created_at: new Date().toISOString() }];

      const result = await runHealthCheck();
      expect(result.database.healthy).toBe(true);
      expect(result.odds.stale).toBe(false);
      expect(result.signals.stale).toBe(false);
      expect(result.status).toBe('WARNING');
    });
  });

  describe('Part 2: Cron Reliability', () => {
    it('should compute durations, status flags, and last successful run timestamp', async () => {
      mockCronRuns = [
        { id: 'run-1', cron_name: 'generate-signals', start_time: new Date(Date.now() - 5000).toISOString(), end_time: new Date().toISOString(), errors: null },
        { id: 'run-2', cron_name: 'generate-signals', start_time: new Date(Date.now() - 10000).toISOString(), end_time: new Date().toISOString(), errors: 'Quota Exceeded' }
      ];

      const metrics = await CronLogger.getCronMetrics('generate-signals');
      expect(metrics.failureCount).toBe(1);
      expect(metrics.lastSuccessfulRun).toBeDefined();
      expect(metrics.recentRuns[0].duration).toBeCloseTo(5, 1);
    });
  });

  describe('Part 3: Middleware Protection & Rate Limiting', () => {
    it('should restrict admin paths with unauthorized status if header secret is invalid', async () => {
      const request = new NextRequest('http://localhost/api/admin/model-health', {
        headers: { 'x-admin-secret': 'wrong_secret' }
      });
      const response = await middleware(request);
      expect(response.status).toBe(401);
    });

    it('should rate limit public endpoints after 100 requests', async () => {
      const request = new NextRequest('http://localhost/api/feed', {
        headers: { 'x-forwarded-for': '1.1.1.1' }
      });

      let lastRes: any = null;
      for (let i = 0; i < 105; i++) {
        lastRes = await middleware(request);
      }
      expect(lastRes.status).toBe(429);
    });
  });

  describe('Part 4: API Reliability and Error Normalization', () => {
    it('should normalize success and error payload formats consistently', async () => {
      const resSuccess = ApiHelper.response(true, { message: 'Ok' });
      const bodySuccess = await resSuccess.json();
      expect(bodySuccess.success).toBe(true);
      expect(bodySuccess.data.message).toBe('Ok');
      expect(bodySuccess.request_id).toBeDefined();

      const resFail = ApiHelper.response(false, null, new Error('Validation failed'), 400);
      const bodyFail = await resFail.json();
      expect(bodyFail.success).toBe(false);
      expect(bodyFail.error).toBe('Validation failed');
      expect(bodyFail.request_id).toBeDefined();
    });

    it('should throw request timeout error if execution crosses limit', async () => {
      const longFn = () => new Promise(resolve => setTimeout(resolve, 50));
      await expect(ApiHelper.executeWithTimeout(longFn, 10)).rejects.toThrow('REQUEST_TIMEOUT');
    });
  });

  describe('Part 6: Launch Readiness API Route', () => {
    it('should return launch status checks for all critical operational categories', async () => {
      mockMatches = [{ id: 'match-1' }];
      const request = new Request('http://localhost/api/admin/launch-readiness');
      const response = await launchReadinessGET(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.database).toBeDefined();
      expect(json.cron).toBeDefined();
      expect(json.odds).toBeDefined();
      expect(json.signals).toBeDefined();
      expect(json.payments).toBe('READY');
    });
  });
});
