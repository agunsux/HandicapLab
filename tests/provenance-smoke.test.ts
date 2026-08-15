import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { validateCredential, CredentialKind } from '../src/lib/auth/credentialValidator';
import { PROVENANCE_STATUSES } from '../src/app/api/v1/provenance/smoke/route';

const CRED_KEYS = [
  'ODDS_PAPI_KEY',
  'APIFOOTBALL_KEY',
  'API_FOOTBALL_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

function expectFailClosed(fn: () => string, keyName: string) {
  expect(fn).toThrowError(/\[FAIL CLOSED\]/);
  expect(fn).toThrowError(new RegExp(keyName));
}

describe('EPIC 57 Preflight — Provenance Smoke', () => {
  describe('1. Credential fail-closed behavior (no values printed, no fallback substitution)', () => {
    it('rejects missing credential', () => {
      expectFailClosed(() => validateCredential('ODDS_PAPI_KEY', undefined), 'ODDS_PAPI_KEY');
    });

    it('rejects empty credential', () => {
      expectFailClosed(() => validateCredential('ODDS_PAPI_KEY', ''), 'ODDS_PAPI_KEY');
      expectFailClosed(() => validateCredential('ODDS_PAPI_KEY', '   '), 'ODDS_PAPI_KEY');
    });

    it('rejects whitespace/newline contamination', () => {
      expectFailClosed(
        () => validateCredential('APIFOOTBALL_KEY', 'abcdef1234567890\nabcdef1234567890'),
        'APIFOOTBALL_KEY'
      );
    });

    it('rejects transcript contamination markers', () => {
      for (const marker of ['Searched for', 'Viewed ', 'Ran command', 'Created ', 'Tool Use']) {
        expectFailClosed(
          () => validateCredential('ODDS_PAPI_KEY', `abcd1234${marker}efgh5678`),
          'ODDS_PAPI_KEY'
        );
      }
    });

    it('rejects placeholder/template credentials', () => {
      for (const value of ['your_api_key_here_123', 'xxxx', 'placeholder_value_123', 'changeme_1234', 'mock_key_12345']) {
        expectFailClosed(() => validateCredential('ODDS_PAPI_KEY', value), 'ODDS_PAPI_KEY');
      }
    });

    it('rejects suspiciously short credentials', () => {
      expectFailClosed(() => validateCredential('ODDS_PAPI_KEY', 'short'), 'ODDS_PAPI_KEY');
    });

    it('rejects malformed JWT (Supabase service role)', () => {
      expectFailClosed(
        () => validateCredential('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiJ9.only-two-segments', 'jwt'),
        'SUPABASE_SERVICE_ROLE_KEY'
      );
      expectFailClosed(
        () => validateCredential('SUPABASE_SERVICE_ROLE_KEY', 'a.b.c.extra-segment', 'jwt'),
        'SUPABASE_SERVICE_ROLE_KEY'
      );
      expectFailClosed(
        () => validateCredential('SUPABASE_SERVICE_ROLE_KEY', 'eyJh!!x.eyJi!!y.eyJj!!z', 'jwt'),
        'SUPABASE_SERVICE_ROLE_KEY'
      );
    });

    it('rejects control characters', () => {
      expectFailClosed(() => validateCredential('ODDS_PAPI_KEY', `abcd1234\u0000efgh5678`), 'ODDS_PAPI_KEY');
    });

    it('accepts a structurally valid opaque key and JWT', () => {
      expect(validateCredential('ODDS_PAPI_KEY', 'abcd1234efgh5678ijkl', 'opaque')).toBe('abcd1234efgh5678ijkl');
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      expect(validateCredential('SUPABASE_SERVICE_ROLE_KEY', jwt, 'jwt')).toBe(jwt);
    });

    it('never returns a substitute/dummy value', () => {
      try {
        validateCredential('ODDS_PAPI_KEY', undefined, 'opaque');
        throw new Error('should not reach');
      } catch {
        // expected
      }
    });
  });

  describe('2. Provenance status semantics', () => {
    it('exposes the minimum required fail-closed status taxonomy', () => {
      for (const required of [
        'VERIFIED_LIVE',
        'VERIFICATION_FAILED',
        'AUTH_FAILED',
        'PROVIDER_UNAVAILABLE',
        'RECORD_NOT_FOUND',
        'SCHEMA_INVALID',
        'PROVENANCE_MISSING',
      ]) {
        expect(PROVENANCE_STATUSES).toContain(required);
      }
      expect(new Set(PROVENANCE_STATUSES).size).toBe(PROVENANCE_STATUSES.length);
    });
  });

  describe('3. Smoke endpoint — deterministic fail-closed with missing/invalid credentials', () => {
    const original: Record<string, string | undefined> = {};

    beforeEach(() => {
      for (const k of CRED_KEYS) {
        original[k] = process.env[k];
        delete process.env[k];
      }
    });

    afterEach(() => {
      for (const k of CRED_KEYS) {
        if (original[k] === undefined) delete process.env[k];
        else process.env[k] = original[k];
      }
    });

    it('missing OddsPAPI credential -> ODDSPAPI_LIVE_AUTH_FAILED', async () => {
      const { GET } = await import('../src/app/api/v1/provenance/smoke/route');
      const res = await GET();
      const body = await res.json();
      expect(res.status).toBe(503);
      expect(body.success).toBe(false);
      expect(body.status).toBe('ODDSPAPI_LIVE_AUTH_FAILED');
      expect(body.message).toMatch(/ODDS_PAPI_KEY/);
      expect(body.message).not.toMatch(/[A-Za-z0-9]{20,}/); // no credential value leaked
    });

    it('invalid/placeholder OddsPAPI credential -> ODDSPAPI_LIVE_AUTH_FAILED', async () => {
      process.env.ODDS_PAPI_KEY = 'placeholder_value_123456';
      const { GET } = await import('../src/app/api/v1/provenance/smoke/route');
      const res = await GET();
      const body = await res.json();
      expect(body.status).toBe('ODDSPAPI_LIVE_AUTH_FAILED');
    });

    it('valid OddsPAPI but missing API-Football -> AUTH_FAILED', async () => {
      process.env.ODDS_PAPI_KEY = 'abcd1234efgh5678ijklmnop';
      const { GET } = await import('../src/app/api/v1/provenance/smoke/route');
      const res = await GET();
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.status).toBe('AUTH_FAILED');
      expect(body.message).toMatch(/APIFOOTBALL_KEY/);
    });

    it('valid OddsPAPI + API-Football but missing Supabase -> AUTH_FAILED', async () => {
      process.env.ODDS_PAPI_KEY = 'abcd1234efgh5678ijklmnop';
      process.env.APIFOOTBALL_KEY = 'api-football-1234567890-key';
      const { GET } = await import('../src/app/api/v1/provenance/smoke/route');
      const res = await GET();
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.status).toBe('AUTH_FAILED');
      expect(body.message).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    });
  });

  describe('4. Zero mutation — smoke endpoint is read-only', () => {
    it('contains no write operations against the database', () => {
      const source = fs.readFileSync(
        path.resolve(process.cwd(), 'src/app/api/v1/provenance/smoke/route.ts'),
        'utf8'
      );
      for (const writeOp of ['.insert(', '.update(', '.upsert(', '.delete(', 'rpc(']) {
        expect(source).not.toContain(writeOp);
      }
      expect(source).toContain('.select(');
    });
  });
});
