import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { assertNotProduction, assertValidProvenance, SecurityGuardError } from '@/lib/security/environmentGuard';

describe('Environment Isolation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('rejects execution if NODE_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => assertNotProduction()).toThrow(SecurityGuardError);
  });

  it('rejects execution if VERCEL_ENV is production', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(() => assertNotProduction()).toThrow(SecurityGuardError);
  });

  it('rejects execution if SUPABASE_URL points to production DB', () => {
    vi.stubEnv('SUPABASE_URL', 'https://rgkrfzxipkrwqccfuqfq.supabase.co');
    expect(() => assertNotProduction()).toThrow(SecurityGuardError);
  });

  it('allows execution in development/test environment', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SUPABASE_URL', 'http://localhost:54321');
    expect(() => assertNotProduction()).not.toThrow();
  });
});

describe('Provenance Guard', () => {
  it('rejects UNKNOWN provenance', () => {
    expect(() => assertValidProvenance('UNKNOWN')).toThrow(SecurityGuardError);
    expect(() => assertValidProvenance(undefined)).toThrow(SecurityGuardError);
    expect(() => assertValidProvenance(null)).toThrow(SecurityGuardError);
  });

  it('rejects SYNTHETIC and QUARANTINED_SYNTHETIC provenance', () => {
    expect(() => assertValidProvenance('SYNTHETIC')).toThrow(SecurityGuardError);
    expect(() => assertValidProvenance('QUARANTINED_SYNTHETIC')).toThrow(SecurityGuardError);
  });

  it('allows valid provenances', () => {
    expect(() => assertValidProvenance('PROVIDER')).not.toThrow();
    expect(() => assertValidProvenance('HISTORICAL')).not.toThrow();
    expect(() => assertValidProvenance('MANUAL')).not.toThrow();
  });
});
