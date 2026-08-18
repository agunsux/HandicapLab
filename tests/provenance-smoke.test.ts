import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { validateCredential, CredentialKind } from '../src/lib/auth/credentialValidator';
import { PROVENANCE_STATUSES, evaluateRecordEligibility } from '../src/app/api/v1/provenance/smoke/route';

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

  describe('5. Record Eligibility Hardening — principled exclusion of non-genuine records', () => {
    const validResolvedRecord = {
      ledgerId: 'ledger-uuid-001',
      matchId: 'match-uuid-001',
      providerFixtureId: '123456',
      home: 'Manchester City',
      away: 'Chelsea',
      kickoff: '2026-08-22T15:00:00.000Z',
      competition: 'Premier League',
      source: 'PROVIDER',
      modelId: 'prematch-v1',
      rowFields: {
        home: true,
        away: true,
        kickoff: true,
        matchId: true,
        providerFixtureId: true,
        league: true,
      },
      matchJoin: 'joined' as const,
      matchJoinError: null,
    };

    const validRow = {
      id: 'ledger-uuid-001',
      match_id: 'match-uuid-001',
      model_id: 'prematch-v1',
      source_type: 'PROVIDER',
      data_status: 'ACTIVE',
      prediction_timestamp: '2026-08-22T12:00:00.000Z',
      explainability_json: {
        summary: 'Form and xG advantage for home team',
        reasonCodes: ['Positive Expected Value', 'Form Advantage'],
      },
      feature_version: 'v1.0',
      feature_vector_snapshot: { matchId: '123456' },
    };

    const validMatch = {
      id: 'match-uuid-001',
      home_team: 'Manchester City',
      away_team: 'Chelsea',
      kickoff: '2026-08-22T15:00:00.000Z',
      league: 'Premier League',
      status: 'upcoming',
      source_type: 'PROVIDER',
      data_status: 'ACTIVE',
    };

    it('accepts genuine production record as eligible for live verification', () => {
      const res = evaluateRecordEligibility(validRow, validResolvedRecord, validMatch);
      expect(res.eligible).toBe(true);
      expect(res.status).toBe('VERIFICATION_FAILED');
      expect(res.reason).toBe('pending live verification');
    });

    it('excludes records labelled "Real test run" in explainability metadata', () => {
      const testRow = {
        ...validRow,
        explainability_json: {
          summary: 'Real test run',
          reasonCodes: ['Positive Expected Value', 'Quarantined: High Calibration Uncertainty'],
        },
      };
      const res = evaluateRecordEligibility(testRow, validResolvedRecord, validMatch);
      expect(res.eligible).toBe(false);
      expect(res.status).toBe('SCHEMA_INVALID');
      expect(res.reason).toMatch(/Explainability metadata indicates a validation or test script execution/);
    });

    it('excludes records with test model identifiers (e.g. prematch-v2-test)', () => {
      const testRow = {
        ...validRow,
        model_id: 'prematch-v2-test',
      };
      const res = evaluateRecordEligibility(testRow, validResolvedRecord, validMatch);
      expect(res.eligible).toBe(false);
      expect(res.status).toBe('SCHEMA_INVALID');
      expect(res.reason).toMatch(/Model identifier.*indicates a test or validation model/);
    });

    it('excludes quarantined records', () => {
      const quarantinedRow = {
        ...validRow,
        data_status: 'QUARANTINED',
      };
      const res = evaluateRecordEligibility(quarantinedRow, validResolvedRecord, validMatch);
      expect(res.eligible).toBe(false);
      expect(res.status).toBe('PROVENANCE_MISSING');
      expect(res.reason).toMatch(/quarantined by data governance/);
    });

    it('excludes records with synthetic or test source_type', () => {
      const syntheticRow = {
        ...validRow,
        source_type: 'SYNTHETIC',
      };
      const res = evaluateRecordEligibility(syntheticRow, validResolvedRecord, validMatch);
      expect(res.eligible).toBe(false);
      expect(res.status).toBe('PROVENANCE_MISSING');
      expect(res.reason).toMatch(/flagged as non-genuine/);
    });

    it('excludes records with shadow-match identifiers in feature snapshot', () => {
      const shadowRow = {
        ...validRow,
        feature_vector_snapshot: { matchId: 'shadow-match-123' },
      };
      const res = evaluateRecordEligibility(shadowRow, validResolvedRecord, validMatch);
      expect(res.eligible).toBe(false);
      expect(res.status).toBe('SCHEMA_INVALID');
      expect(res.reason).toMatch(/Feature snapshot contains test match identifier/);
    });

    it('excludes post-kickoff predictions (look-ahead leakage violation)', () => {
      const postKickoffRow = {
        ...validRow,
        prediction_timestamp: '2026-08-22T16:00:00.000Z', // 1 hour after 15:00 kickoff
      };
      const res = evaluateRecordEligibility(postKickoffRow, validResolvedRecord, validMatch);
      expect(res.eligible).toBe(false);
      expect(res.status).toBe('SCHEMA_INVALID');
      expect(res.reason).toMatch(/Prediction timestamp violates pre-kickoff invariant/);
    });

    it('excludes archived test fixtures', () => {
      const archivedMatch = {
        ...validMatch,
        status: 'archived',
      };
      const res = evaluateRecordEligibility(validRow, validResolvedRecord, archivedMatch);
      expect(res.eligible).toBe(false);
      expect(res.status).toBe('PROVENANCE_MISSING');
      expect(res.reason).toMatch(/archived test fixture/);
    });

    it('excludes dummy team names', () => {
      const dummyRecord = {
        ...validResolvedRecord,
        home: 'Test Team Synthetic',
      };
      const res = evaluateRecordEligibility(validRow, dummyRecord, validMatch);
      expect(res.eligible).toBe(false);
      expect(res.status).toBe('SCHEMA_INVALID');
      expect(res.reason).toMatch(/Record contains dummy, mock, synthetic, or shadow match identifiers/);
    });
  });
});
