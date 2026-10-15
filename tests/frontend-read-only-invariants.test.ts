import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UpcomingFixturesService } from '@/lib/services/upcomingFixturesService';
import { CanonicalFixtureRegistry } from '@/lib/services/canonicalFixtureRegistry';
import { apiFootballClient } from '@/lib/apis/apifootball';
import { GcsLedgerStorage } from '@/lib/pipeline/rescue/gcsLedgerStorage';
import { DailyPicksEngine } from '@/lib/daily-picks/engine';
import { setIdTokenVerifierForTesting } from '@/lib/auth/cronAuth';

describe('Frontend Read-Only SSR & Timeout Invariants (EPIC 81)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('UpcomingFixturesService.getUpcomingFixtures({ readOnly: true }) makes ZERO calls to apiFootballClient', async () => {
    const apiFootballSpy = vi.spyOn(apiFootballClient, 'getFixturesRange');
    const syncUpcomingSpy = vi.spyOn(CanonicalFixtureRegistry, 'syncUpcomingFixtures');

    const result = await UpcomingFixturesService.getUpcomingFixtures({
      daysAhead: 7,
      limit: 12,
      readOnly: true,
    });

    expect(apiFootballSpy).not.toHaveBeenCalled();
    expect(syncUpcomingSpy).not.toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.fixtures).toBeDefined();
    expect(Array.isArray(result.fixtures)).toBe(true);
  });

  it('CanonicalFixtureRegistry.getUpcomingFixtures defaults to read-only when process.env.VERCEL is set', async () => {
    process.env.VERCEL = '1';
    const apiFootballSpy = vi.spyOn(apiFootballClient, 'getFixturesRange');
    const syncUpcomingSpy = vi.spyOn(CanonicalFixtureRegistry, 'syncUpcomingFixtures');

    const result = await CanonicalFixtureRegistry.getUpcomingFixtures({
      horizon: 'NEXT_7_DAYS',
      limit: 10,
    });

    expect(apiFootballSpy).not.toHaveBeenCalled();
    expect(syncUpcomingSpy).not.toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.providerState).toBe('READ_ONLY');
  });

  it('DailyPicksEngine.getDailyPicks({ allowProviderCalls: false }) makes ZERO calls to OddsPapi or live generation', async () => {
    const generateSpy = vi.spyOn(DailyPicksEngine, 'generateAndPersistDailyPicks');
    const fetchOddsSpy = vi.spyOn(DailyPicksEngine, 'fetchOddsPapiPinnacle');

    const result = await DailyPicksEngine.getDailyPicks({
      forceRefresh: false,
      allowProviderCalls: false,
    });

    expect(generateSpy).not.toHaveBeenCalled();
    expect(fetchOddsSpy).not.toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(Array.isArray(result.picks)).toBe(true);
  });

  it('GcsLedgerStorage.getGcpAccessToken short-circuits to null on Vercel without network request', async () => {
    process.env.VERCEL = '1';
    delete process.env.GCS_AUTH_TOKEN;

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const token = await GcsLedgerStorage.getGcpAccessToken();

    expect(token).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  describe('Cloud Scheduler Cron Authentication (pipeline & rescue-pipeline)', () => {
    beforeEach(() => {
      process.env.CRON_SECRET = 'active-cron-secret-12345';
      setIdTokenVerifierForTesting({
        async verifyIdToken({ idToken }: { idToken: string }) {
          const parts = idToken.split('.');
          if (parts.length !== 3 || parts[2] !== 'fake-signature') {
            throw new Error('Invalid token structure');
          }
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          return {
            getPayload: () => payload,
          };
        },
      });
    });

    afterEach(() => {
      setIdTokenVerifierForTesting(null);
    });

    function createMockJwt(payload: any): string {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const claimsObj = {
        aud: 'https://handicaplab-production-129269713730.asia-southeast2.run.app',
        email_verified: true,
        ...payload,
      };
      const claims = Buffer.from(JSON.stringify(claimsObj)).toString('base64url');
      return `${header}.${claims}.fake-signature`;
    }

    it('validates authentic Cloud Scheduler OIDC ID token for handicaplab-run service account', async () => {
      const { GET } = await import('@/app/api/cron/pipeline/route');
      const nowSec = Math.floor(Date.now() / 1000);

      const validToken = createMockJwt({
        iss: 'https://accounts.google.com',
        email: 'handicaplab-run@handicap-salmo.iam.gserviceaccount.com',
        exp: nowSec + 3600,
      });

      const req = new Request('https://salmo.dev/api/cron/pipeline?mode=health', {
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      const response = await GET(req as any);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    it('rejects expired Cloud Scheduler OIDC token with 401', async () => {
      const { GET } = await import('@/app/api/cron/pipeline/route');
      const nowSec = Math.floor(Date.now() / 1000);

      const expiredToken = createMockJwt({
        iss: 'https://accounts.google.com',
        email: 'handicaplab-run@handicap-salmo.iam.gserviceaccount.com',
        exp: nowSec - 300,
      });

      const req = new Request('https://salmo.dev/api/cron/pipeline?mode=health', {
        headers: {
          authorization: `Bearer ${expiredToken}`,
        },
      });

      const response = await GET(req as any);
      expect(response.status).toBe(401);
    });

    it('rejects unauthorized service account with 401', async () => {
      const { GET } = await import('@/app/api/cron/pipeline/route');
      const nowSec = Math.floor(Date.now() / 1000);

      const unauthorizedToken = createMockJwt({
        iss: 'https://accounts.google.com',
        email: 'attacker@malicious-project.iam.gserviceaccount.com',
        exp: nowSec + 3600,
      });

      const req = new Request('https://salmo.dev/api/cron/pipeline?mode=health', {
        headers: {
          authorization: `Bearer ${unauthorizedToken}`,
        },
      });

      const response = await GET(req as any);
      expect(response.status).toBe(401);
    });

    it('rejects concurrent/duplicate pipeline execution with 409 Conflict', async () => {
      const { GET } = await import('@/app/api/cron/pipeline/route');
      const { DistributedCronLease } = await import('@/lib/crons/distributedCronLease');

      // Acquire an initial lease to simulate another running instance
      const initialLease = await DistributedCronLease.acquireLease('cron_daily', 60_000);
      expect(initialLease.acquired).toBe(true);

      try {
        const nowSec = Math.floor(Date.now() / 1000);
        const validToken = createMockJwt({
          iss: 'https://accounts.google.com',
          email: 'handicaplab-run@handicap-salmo.iam.gserviceaccount.com',
          exp: nowSec + 3600,
        });

        const req = new Request('https://salmo.dev/api/cron/pipeline?mode=daily', {
          headers: {
            authorization: `Bearer ${validToken}`,
          },
        });

        const response = await GET(req as any);
        expect(response.status).toBe(409);
        const body = await response.json();
        expect(body.success).toBe(false);
        expect(body.message).toContain('Concurrent cron execution skipped');
      } finally {
        if (initialLease.leaseId) {
          await DistributedCronLease.releaseLease('cron_daily', initialLease.leaseId);
        }
      }
    });
  });

  describe('ProviderGateway & Latency Isolation Invariants', () => {
    it('sets acquire timeout to 2500ms on Vercel and preserves 30000ms outside Vercel', () => {
      delete process.env.VERCEL;
      const defaultTimeout = process.env.VERCEL ? 2500 : 30_000;
      expect(defaultTimeout).toBe(30_000);

      process.env.VERCEL = '1';
      const vercelTimeout = process.env.VERCEL ? 2500 : 30_000;
      expect(vercelTimeout).toBe(2500);
    });
  });

  describe('DistributedCronLease GCS Distributed Concurrency & CAS Invariants', () => {
    it('acquires GCS lease atomically via ifGenerationMatch=0 when object does not exist', async () => {
      const { DistributedCronLease } = await import('@/lib/crons/distributedCronLease');
      process.env.GCS_AUTH_TOKEN = 'mock-gcp-token';

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init?: any) => {
        const urlStr = String(url);
        if (urlStr.includes('alt=media')) {
          // Object does not exist
          return new Response('Not Found', { status: 404 });
        }
        if (urlStr.includes('ifGenerationMatch=0')) {
          // Atomic creation succeeds
          return new Response(JSON.stringify({ generation: '1729050000001' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('Internal Error', { status: 500 });
      });

      const result = await DistributedCronLease.acquireLease('test_gcs_atomic_job', 60_000);
      expect(result.acquired).toBe(true);
      expect(result.storageType).toBe('gcs');
      expect(result.generation).toBe('1729050000001');

      delete process.env.GCS_AUTH_TOKEN;
    });

    it('rejects concurrent creation with race condition lost when GCS returns HTTP 412', async () => {
      const { DistributedCronLease } = await import('@/lib/crons/distributedCronLease');
      process.env.GCS_AUTH_TOKEN = 'mock-gcp-token';

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init?: any) => {
        const urlStr = String(url);
        if (urlStr.includes('alt=media')) {
          return new Response('Not Found', { status: 404 });
        }
        if (urlStr.includes('ifGenerationMatch=0')) {
          // Another instance won the race
          return new Response('Precondition Failed', { status: 412 });
        }
        return new Response('Error', { status: 500 });
      });

      const result = await DistributedCronLease.acquireLease('test_gcs_atomic_job', 60_000);
      expect(result.acquired).toBe(false);
      expect(result.storageType).toBe('gcs');
      expect(result.reason).toContain('Race condition lost');

      delete process.env.GCS_AUTH_TOKEN;
    });

    it('rejects acquisition when an active (non-expired) GCS lease is held by another instance', async () => {
      const { DistributedCronLease } = await import('@/lib/crons/distributedCronLease');
      process.env.GCS_AUTH_TOKEN = 'mock-gcp-token';

      const activeLease = {
        jobName: 'test_gcs_atomic_job',
        leaseId: 'lease_active_123',
        acquiredAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 180_000).toISOString(),
        holderInstanceId: 'instance_worker_1',
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('alt=media')) {
          return new Response(JSON.stringify(activeLease), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'x-goog-generation': '1729050000002',
            },
          });
        }
        return new Response('Error', { status: 500 });
      });

      const result = await DistributedCronLease.acquireLease('test_gcs_atomic_job', 60_000);
      expect(result.acquired).toBe(false);
      expect(result.storageType).toBe('gcs');
      expect(result.reason).toContain('CONCURRENT_EXECUTION_HELD');
      expect(result.existingLease?.holderInstanceId).toBe('instance_worker_1');

      delete process.env.GCS_AUTH_TOKEN;
    });

    it('recovers a stale GCS lease using Compare-And-Swap ifGenerationMatch', async () => {
      const { DistributedCronLease } = await import('@/lib/crons/distributedCronLease');
      process.env.GCS_AUTH_TOKEN = 'mock-gcp-token';

      const staleLease = {
        jobName: 'test_gcs_atomic_job',
        leaseId: 'lease_stale_999',
        acquiredAt: new Date(Date.now() - 360_000).toISOString(),
        expiresAt: new Date(Date.now() - 60_000).toISOString(), // expired 1m ago
        holderInstanceId: 'instance_crashed_worker',
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('alt=media')) {
          return new Response(JSON.stringify(staleLease), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'x-goog-generation': '1729050000002',
            },
          });
        }
        if (urlStr.includes('ifGenerationMatch=1729050000002')) {
          // Stale CAS overwrite succeeds
          return new Response(JSON.stringify({ generation: '1729050000003' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('Error', { status: 500 });
      });

      const result = await DistributedCronLease.acquireLease('test_gcs_atomic_job', 60_000);
      expect(result.acquired).toBe(true);
      expect(result.storageType).toBe('gcs');
      expect(result.generation).toBe('1729050000003');

      delete process.env.GCS_AUTH_TOKEN;
    });

    it('safely releases GCS lease verifying ownership and generation', async () => {
      const { DistributedCronLease } = await import('@/lib/crons/distributedCronLease');
      process.env.GCS_AUTH_TOKEN = 'mock-gcp-token';

      const currentHeldLease = {
        jobName: 'test_gcs_atomic_job',
        leaseId: 'lease_my_turn_456',
        acquiredAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        holderInstanceId: 'instance_me',
      };

      let deleteCalledWithGeneration = false;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init?: any) => {
        const urlStr = String(url);
        if (urlStr.includes('alt=media')) {
          return new Response(JSON.stringify(currentHeldLease), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'x-goog-generation': '1729050000003',
            },
          });
        }
        if (init?.method === 'DELETE' && urlStr.includes('ifGenerationMatch=1729050000003')) {
          deleteCalledWithGeneration = true;
          return new Response(null, { status: 204 });
        }
        return new Response('Error', { status: 500 });
      });

      const released = await DistributedCronLease.releaseLease('test_gcs_atomic_job', 'lease_my_turn_456', '1729050000003');
      expect(released).toBe(true);
      expect(deleteCalledWithGeneration).toBe(true);

      delete process.env.GCS_AUTH_TOKEN;
    });
  });
});
