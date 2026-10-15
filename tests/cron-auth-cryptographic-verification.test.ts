import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  verifyCronRequest,
  setIdTokenVerifierForTesting,
  CANONICAL_CLOUD_RUN_AUDIENCE,
  CANONICAL_SCHEDULER_SA,
  type IdTokenVerifier,
} from '@/lib/auth/cronAuth';
import { DistributedCronLease } from '@/lib/crons/distributedCronLease';
import { NextRequest } from 'next/server';

describe('P0 Cron Authentication & Cryptographic Verification (EPIC 81C)', () => {
  const originalEnv = { ...process.env };

  const validPayload = {
    iss: 'https://accounts.google.com',
    aud: CANONICAL_CLOUD_RUN_AUDIENCE,
    sub: '1029384756',
    email: CANONICAL_SCHEDULER_SA,
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  const mockVerifier: IdTokenVerifier = {
    async verifyIdToken(options: { idToken: string; audience: string | string[] }) {
      const { idToken, audience } = options;

      if (idToken === 'forged-signature-token') {
        throw new Error('CryptoError: Signature verification failed against Google certs');
      }

      if (idToken === 'malformed-jwt') {
        throw new Error('Malformed token structure');
      }

      if (idToken === 'wrong-aud-token') {
        return {
          getPayload: () => ({
            ...validPayload,
            aud: 'https://wrong-service-audience.run.app',
          }),
        };
      }

      if (idToken === 'wrong-iss-token') {
        return {
          getPayload: () => ({
            ...validPayload,
            iss: 'https://evil-identity-provider.com',
          }),
        };
      }

      if (idToken === 'expired-token') {
        return {
          getPayload: () => ({
            ...validPayload,
            exp: Math.floor(Date.now() / 1000) - 300,
          }),
        };
      }

      if (idToken === 'unauthorized-sa-token') {
        return {
          getPayload: () => ({
            ...validPayload,
            email: 'attacker@evil-external-project.iam.gserviceaccount.com',
          }),
        };
      }

      if (idToken === 'unverified-email-token') {
        return {
          getPayload: () => ({
            ...validPayload,
            email_verified: false,
          }),
        };
      }

      if (idToken === 'valid-google-oidc-token') {
        return {
          getPayload: () => ({
            ...validPayload,
            aud: Array.isArray(audience) ? audience[0] : audience,
          }),
        };
      }

      throw new Error(`Unrecognized mock token: ${idToken}`);
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.CRON_SECRET = 'active-cron-secret-super-secure';
    process.env.CLOUD_RUN_AUDIENCE = CANONICAL_CLOUD_RUN_AUDIENCE;
    process.env.CRON_SERVICE_ACCOUNT_EMAIL = CANONICAL_SCHEDULER_SA;
    setIdTokenVerifierForTesting(mockVerifier);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setIdTokenVerifierForTesting(null);
  });

  it('rejects missing Authorization header with 401', async () => {
    const req = new NextRequest('https://salmo.dev/api/cron/pipeline');
    const result = await verifyCronRequest(req);
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('MISSING_OR_MALFORMED_AUTHORIZATION_HEADER');
  });

  it('rejects non-Bearer authorization header', async () => {
    const req = new NextRequest('https://salmo.dev/api/cron/pipeline', {
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    });
    const result = await verifyCronRequest(req);
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('MISSING_OR_MALFORMED_AUTHORIZATION_HEADER');
  });

  it('prohibits query-parameter authentication (?token=...)', async () => {
    const req = new NextRequest(
      `https://salmo.dev/api/cron/pipeline?token=${process.env.CRON_SECRET}`
    );
    const result = await verifyCronRequest(req);
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('MISSING_OR_MALFORMED_AUTHORIZATION_HEADER');
  });

  it('rejects forged signature tokens with verification error', async () => {
    const req = new NextRequest('https://salmo.dev/api/cron/pipeline', {
      headers: { authorization: 'Bearer forged-signature-token' },
    });
    const result = await verifyCronRequest(req);
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('CRYPTOGRAPHIC_VERIFICATION_FAILED');
  });

  it('rejects tokens with mismatched audience', async () => {
    const req = new NextRequest('https://salmo.dev/api/cron/pipeline', {
      headers: { authorization: 'Bearer wrong-aud-token' },
    });
    const result = await verifyCronRequest(req);
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('AUDIENCE_MISMATCH');
  });

  it('rejects tokens with non-Google issuer', async () => {
    const req = new NextRequest('https://salmo.dev/api/cron/pipeline', {
      headers: { authorization: 'Bearer wrong-iss-token' },
    });
    const result = await verifyCronRequest(req);
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('INVALID_ISSUER');
  });

  it('rejects expired tokens', async () => {
    const req = new NextRequest('https://salmo.dev/api/cron/pipeline', {
      headers: { authorization: 'Bearer expired-token' },
    });
    const result = await verifyCronRequest(req);
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('TOKEN_EXPIRED');
  });

  it('rejects unauthorized service account identities', async () => {
    const req = new NextRequest('https://salmo.dev/api/cron/pipeline', {
      headers: { authorization: 'Bearer unauthorized-sa-token' },
    });
    const result = await verifyCronRequest(req);
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('UNAUTHORIZED_SERVICE_ACCOUNT');
  });

  it('rejects unverified email claims', async () => {
    const req = new NextRequest('https://salmo.dev/api/cron/pipeline', {
      headers: { authorization: 'Bearer unverified-email-token' },
    });
    const result = await verifyCronRequest(req);
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('EMAIL_NOT_VERIFIED');
  });

  it('accepts valid Google OIDC ID token with verified cryptographic claims', async () => {
    const req = new NextRequest('https://salmo.dev/api/cron/pipeline', {
      headers: { authorization: 'Bearer valid-google-oidc-token' },
    });
    const result = await verifyCronRequest(req);
    expect(result.authorized).toBe(true);
    expect(result.identity).toBe(CANONICAL_SCHEDULER_SA);
  });

  it('accepts valid timing-safe CRON_SECRET in Bearer header', async () => {
    const req = new NextRequest('https://salmo.dev/api/cron/pipeline', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const result = await verifyCronRequest(req);
    expect(result.authorized).toBe(true);
    expect(result.identity).toBe('bearer_cron_secret');
  });
});

describe('Route Handler Security & Mutual Exclusion (pipeline and rescue-pipeline)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.CRON_SECRET = 'active-cron-secret-super-secure';
    process.env.CLOUD_RUN_AUDIENCE = CANONICAL_CLOUD_RUN_AUDIENCE;
    process.env.CRON_SERVICE_ACCOUNT_EMAIL = CANONICAL_SCHEDULER_SA;
    setIdTokenVerifierForTesting({
      async verifyIdToken() {
        return {
          getPayload: () => ({
            iss: 'https://accounts.google.com',
            aud: CANONICAL_CLOUD_RUN_AUDIENCE,
            email: CANONICAL_SCHEDULER_SA,
            email_verified: true,
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        };
      },
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setIdTokenVerifierForTesting(null);
  });

  it('pipeline GET rejects unauthorized calls with 401', async () => {
    const { GET } = await import('@/app/api/cron/pipeline/route');
    const req = new NextRequest('https://salmo.dev/api/cron/pipeline?mode=health');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('pipeline POST rejects unauthorized calls with 401', async () => {
    const { POST } = await import('@/app/api/cron/pipeline/route');
    const req = new NextRequest('https://salmo.dev/api/cron/pipeline?mode=health', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rescue-pipeline GET rejects unauthorized calls with 401', async () => {
    const { GET } = await import('@/app/api/cron/rescue-pipeline/route');
    const req = new NextRequest('https://salmo.dev/api/cron/rescue-pipeline');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('rescue-pipeline POST rejects unauthorized calls with 401', async () => {
    const { POST } = await import('@/app/api/cron/rescue-pipeline/route');
    const req = new NextRequest('https://salmo.dev/api/cron/rescue-pipeline', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('pipeline GET authorizes valid Cloud Scheduler OIDC token', async () => {
    const { GET } = await import('@/app/api/cron/pipeline/route');
    const req = new NextRequest('https://salmo.dev/api/cron/pipeline?mode=health', {
      headers: { authorization: 'Bearer valid-oidc-token' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('DistributedCronLease fails closed in Cloud Run if GCS token is unavailable', async () => {
    process.env.K_REVISION = 'handicaplab-production-00007-jwr';
    delete process.env.GCS_AUTH_TOKEN;

    const lease = await DistributedCronLease.acquireLease('cron_pipeline_test');
    expect(lease.acquired).toBe(false);
    expect(lease.reason).toContain('DISTRIBUTED_LOCK_UNAVAILABLE');
  });

  it('DistributedCronLease blocks conflicting execution between pipeline and rescue', async () => {
    delete process.env.K_REVISION; // test environment fallback
    vi.spyOn(DistributedCronLease, 'isJobActive').mockImplementation(async (job: string) => {
      return job === 'cron_rescue_pipeline';
    });

    const lease = await DistributedCronLease.acquireLease('cron_pipeline');
    expect(lease.acquired).toBe(false);
    expect(lease.reason).toContain('CONFLICTING_JOB_ACTIVE');
  });
});
