import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EnvironmentGuard,
  ProvenanceEnforcer,
  QuarantineManager,
  type SourceType,
} from '@/lib/governance/dataSafety';

describe('GATE 0 — P0 Data Safety & Governance', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('P0-A: Environment Isolation', () => {
    it('proves local environment != production', () => {
      (process.env as any).NODE_ENV = 'development';
      delete process.env.VERCEL_ENV;
      delete process.env.APP_ENV;
      delete (process.env as any).VITEST;

      const env = EnvironmentGuard.getEnvironment();
      expect(env).toBe('DEVELOPMENT');
      expect(env).not.toBe('PRODUCTION');
    });

    it('proves test environment != production', () => {
      (process.env as any).NODE_ENV = 'test';
      const env = EnvironmentGuard.getEnvironment();
      expect(env).toBe('TEST');
      expect(env).not.toBe('PRODUCTION');
    });

    it('proves synthetic writers cannot write to production', () => {
      expect(() => {
        EnvironmentGuard.assertSafeWriter('SYNTHETIC', 'PRODUCTION');
      }).toThrowError(/\[P0-A VIOLATION\]/);

      expect(() => {
        EnvironmentGuard.assertSafeWriter('TEST', 'PRODUCTION');
      }).toThrowError(/\[P0-A VIOLATION\]/);

      // REAL_PROVIDER in PRODUCTION is allowed
      expect(() => {
        EnvironmentGuard.assertSafeWriter('REAL_PROVIDER', 'PRODUCTION');
      }).not.toThrow();
    });

    it('proves unknown environment fails closed', () => {
      expect(() => {
        EnvironmentGuard.assertSafeWriter('REAL_PROVIDER', 'UNKNOWN');
      }).toThrowError(/\[P0-A FAIL-CLOSED\]/);
    });

    it('assertNotProduction throws when in production', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.APP_ENV = 'production';
      delete (process.env as any).VITEST;

      expect(() => {
        EnvironmentGuard.assertNotProduction('Simulated Test Run');
      }).toThrowError(/strictly prohibited in PRODUCTION/);
    });

    it('passes comprehensive isolation verification suite', () => {
      const verification = EnvironmentGuard.verifyIsolation();
      expect(verification.localNotProd).toBe(true);
      expect(verification.testNotProd).toBe(true);
      expect(verification.syntheticWriterBlockedInProd).toBe(true);
      expect(verification.unknownFailsClosed).toBe(true);
      expect(verification.status).toBe('PASS');
    });
  });

  describe('P0-B: Data Provenance Enforcement', () => {
    it('creates immutable provenance object with all required fields', () => {
      const prov = ProvenanceEnforcer.createProvenance({
        source_type: 'REAL_PROVIDER',
        provider: 'API-Football Pro',
        provider_fixture_id: '123456',
        ingestion_run_id: 'ingest-run-001',
        source_timestamp: '2026-08-15T00:00:00.000Z',
      });

      expect(prov.source_type).toBe('REAL_PROVIDER');
      expect(prov.provider).toBe('API-Football Pro');
      expect(prov.provider_fixture_id).toBe('123456');
      expect(prov.ingestion_run_id).toBe('ingest-run-001');
      expect(prov.source_timestamp).toBe('2026-08-15T00:00:00.000Z');
      expect(prov.ingested_at).toBeDefined();
    });

    it('rejects provenance with empty provider or fixture id', () => {
      expect(() => {
        ProvenanceEnforcer.createProvenance({
          source_type: 'REAL_PROVIDER',
          provider: '',
          provider_fixture_id: '123456',
        });
      }).toThrowError(/P0-B VIOLATION/);

      expect(() => {
        ProvenanceEnforcer.createProvenance({
          source_type: 'REAL_PROVIDER',
          provider: 'API-Football',
          provider_fixture_id: '',
        });
      }).toThrowError(/P0-B VIOLATION/);
    });

    it('validates valid and invalid provenance records correctly', () => {
      const validRecord = {
        source_type: 'REAL_PROVIDER' as SourceType,
        provider: 'API-Football',
        provider_fixture_id: '998877',
        ingestion_run_id: 'run-1',
        source_timestamp: new Date().toISOString(),
        ingested_at: new Date().toISOString(),
      };
      expect(ProvenanceEnforcer.validateProvenance(validRecord)).toBe(true);

      const invalidRecord = {
        source_type: 'INVALID_TYPE',
        provider: 'API-Football',
      };
      expect(ProvenanceEnforcer.validateProvenance(invalidRecord)).toBe(false);
    });

    it('strictly isolates research queries by excluding synthetic and test records', () => {
      const mixedRecords = [
        { id: 1, source_type: 'REAL_PROVIDER', value: 10 },
        { id: 2, source_type: 'SYNTHETIC', value: 20 },
        { id: 3, source_type: 'TEST', value: 30 },
        { id: 4, source_type: 'REAL_PROVIDER', value: 40 },
        { id: 5, source_type: 'UNKNOWN', value: 50 },
      ];

      const result = ProvenanceEnforcer.filterResearchData(mixedRecords);
      expect(result.cleanRecords.length).toBe(2);
      expect(result.cleanRecords.every((r) => r.source_type === 'REAL_PROVIDER')).toBe(true);
      expect(result.syntheticCount).toBe(1);
      expect(result.testCount).toBe(1);
      expect(result.invalidCount).toBe(1);
      expect(result.quarantinedCount).toBe(3);
    });
  });

  describe('P0-C: Safe Quarantine & Isolation', () => {
    it('quarantines record safely with quarantine metadata without destroying original fields', () => {
      const syntheticRow = {
        id: 'pred-100',
        match_id: 'm-200',
        selection: 'home',
        source_type: 'SYNTHETIC',
      };

      const quarantined = QuarantineManager.quarantineRecord(
        syntheticRow,
        'Detected synthetic generator run'
      );

      expect(quarantined.id).toBe('pred-100');
      expect(quarantined.data_status).toBe('QUARANTINED');
      expect(quarantined.quarantine_reason).toBe('Detected synthetic generator run');
      expect(quarantined.quarantined_at).toBeDefined();
    });

    it('audits research pool and passes when 0 unquarantined synthetic rows exist', () => {
      const validPool = [
        { id: 1, source_type: 'REAL_PROVIDER', data_status: 'ACTIVE' },
        { id: 2, source_type: 'REAL_PROVIDER', data_status: 'ACTIVE' },
        { id: 3, source_type: 'SYNTHETIC', data_status: 'QUARANTINED' },
      ];

      const audit = QuarantineManager.auditResearchPool(validPool);
      expect(audit.status).toBe('PASS');
      expect(audit.activeRealRecords).toBe(2);
      expect(audit.quarantinedRecords).toBe(1);
      expect(audit.violationsCount).toBe(0);
    });

    it('audits research pool and fails when unquarantined synthetic rows exist', () => {
      const contaminatedPool = [
        { id: 1, source_type: 'REAL_PROVIDER', data_status: 'ACTIVE' },
        { id: 2, source_type: 'SYNTHETIC', data_status: 'ACTIVE' }, // VIOLATION!
      ];

      const audit = QuarantineManager.auditResearchPool(contaminatedPool);
      expect(audit.status).toBe('FAIL');
      expect(audit.violationsCount).toBe(1);
    });
  });
});
