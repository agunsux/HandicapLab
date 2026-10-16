// ============================================================================
// HANDICAPLAB — CONTRACT SYNC AUTHENTICATION REGRESSION TEST SUITE
// ============================================================================
// Location: tests/salmo-sync-auth.test.ts
//
// Tests authentication enforcement for /api/v1/salmo/sync, including:
// 1. Rejection of unauthenticated requests with HTTP 401.
// 2. Rejection of query-string tokens (?key=..., ?token=...).
// 3. Timing-safe comparison of HANDICAPLAB_API_KEY, SALMO_SYNC_API_KEY, CRON_SECRET.
// 4. Cryptographic Google Cloud OIDC ID token verification & claims validation.
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  verifyContractSyncRequest,
  setIdTokenVerifierForTesting,
  CANONICAL_CLOUD_RUN_AUDIENCE,
  CANONICAL_SCHEDULER_SA,
} from '@/lib/auth/cronAuth';
import { GET as handleSyncGet } from '@/app/api/v1/salmo/sync/route';

const TEST_SYNC_KEY = 'handicaplab_secret_sync_key_test_2026';
const TEST_CRON_SECRET = 'handicaplab_cron_secret_test_2026';

describe('HandicapLab Contract Sync Auth (/api/v1/salmo/sync)', () => {
  beforeEach(() => {
    process.env.HANDICAPLAB_API_KEY = TEST_SYNC_KEY;
    process.env.CRON_SECRET = TEST_CRON_SECRET;
    setIdTokenVerifierForTesting(null);
  });

  afterEach(() => {
    delete process.env.HANDICAPLAB_API_KEY;
    delete process.env.SALMO_SYNC_API_KEY;
    delete process.env.CRON_SECRET;
    setIdTokenVerifierForTesting(null);
  });

  it('rejects sync request without Authorization header with 401 reason', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/salmo/sync');
    const result = await verifyContractSyncRequest(req);
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('MISSING_OR_MALFORMED_AUTHORIZATION_HEADER');
  });

  it('rejects sync request with non-Bearer Authorization header', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/salmo/sync', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    const result = await verifyContractSyncRequest(req);
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('MISSING_OR_MALFORMED_AUTHORIZATION_HEADER');
  });

  it('strictly rejects query parameter credential leakage (?key=...)', async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/salmo/sync?key=${TEST_SYNC_KEY}`, {
      headers: { Authorization: `Bearer ${TEST_SYNC_KEY}` },
    });
    const result = await verifyContractSyncRequest(req);
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('QUERY_PARAMETER_AUTH_PROHIBITED');
  });

  it('strictly rejects query parameter credential leakage (?token=...)', async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/salmo/sync?token=${TEST_SYNC_KEY}`);
    const result = await verifyContractSyncRequest(req);
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('QUERY_PARAMETER_AUTH_PROHIBITED');
  });

  it('rejects invalid or forged Bearer token', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/salmo/sync', {
      headers: { Authorization: 'Bearer forged_token_12345' },
    });
    const result = await verifyContractSyncRequest(req);
    expect(result.authorized).toBe(false);
  });

  it('authorizes valid Bearer matching HANDICAPLAB_API_KEY', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/salmo/sync', {
      headers: { Authorization: `Bearer ${TEST_SYNC_KEY}` },
    });
    const result = await verifyContractSyncRequest(req);
    expect(result.authorized).toBe(true);
    expect(result.identity).toBe('bearer_api_key');
  });

  it('authorizes valid Bearer matching SALMO_SYNC_API_KEY', async () => {
    delete process.env.HANDICAPLAB_API_KEY;
    process.env.SALMO_SYNC_API_KEY = 'salmo_specific_sync_key_999';

    const req = new NextRequest('http://localhost:3000/api/v1/salmo/sync', {
      headers: { Authorization: 'Bearer salmo_specific_sync_key_999' },
    });
    const result = await verifyContractSyncRequest(req);
    expect(result.authorized).toBe(true);
    expect(result.identity).toBe('bearer_api_key');
  });

  it('authorizes valid Bearer matching CRON_SECRET fallback', async () => {
    delete process.env.HANDICAPLAB_API_KEY;

    const req = new NextRequest('http://localhost:3000/api/v1/salmo/sync', {
      headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` },
    });
    const result = await verifyContractSyncRequest(req);
    expect(result.authorized).toBe(true);
    expect(result.identity).toBe('bearer_api_key');
  });

  it('authorizes valid Google Cloud OIDC ID token', async () => {
    delete process.env.HANDICAPLAB_API_KEY;
    delete process.env.CRON_SECRET;

    const mockVerifier = {
      verifyIdToken: async ({ idToken, audience }: any) => {
        expect(idToken).toBe('valid_google_oidc_jwt');
        return {
          getPayload: () => ({
            iss: 'https://accounts.google.com',
            aud: audience,
            exp: Math.floor(Date.now() / 1000) + 3600,
            email: CANONICAL_SCHEDULER_SA,
            email_verified: true,
          }),
        };
      },
    };
    setIdTokenVerifierForTesting(mockVerifier);

    const req = new NextRequest('http://localhost:3000/api/v1/salmo/sync', {
      headers: { Authorization: 'Bearer valid_google_oidc_jwt' },
    });
    const result = await verifyContractSyncRequest(req);
    expect(result.authorized).toBe(true);
    expect(result.identity).toBe(CANONICAL_SCHEDULER_SA);
  });

  it('rejects expired Google Cloud OIDC ID token', async () => {
    delete process.env.HANDICAPLAB_API_KEY;
    delete process.env.CRON_SECRET;

    const mockVerifier = {
      verifyIdToken: async () => ({
        getPayload: () => ({
          iss: 'https://accounts.google.com',
          aud: CANONICAL_CLOUD_RUN_AUDIENCE,
          exp: Math.floor(Date.now() / 1000) - 30, // Expired
          email: CANONICAL_SCHEDULER_SA,
          email_verified: true,
        }),
      }),
    };
    setIdTokenVerifierForTesting(mockVerifier);

    const req = new NextRequest('http://localhost:3000/api/v1/salmo/sync', {
      headers: { Authorization: 'Bearer expired_token' },
    });
    const result = await verifyContractSyncRequest(req);
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('TOKEN_EXPIRED');
  });

  it('route handler GET /api/v1/salmo/sync returns 401 when unauthenticated', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/salmo/sync');
    const res = await handleSyncGet(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('UNAUTHORIZED');
    expect(json.reason).toBe('MISSING_OR_MALFORMED_AUTHORIZATION_HEADER');
  });
});
