// Test suite for EPIC 53 Phase 1 Evidence-Based Data Integrity Gates
import { describe, test, expect } from 'vitest';
import {
  runDataIntegrityCheck,
  executeStageALinkage,
  executeStageBSyntheticIsolation,
  executeStageCHistoricalWarehouse,
  executeStageDSnapshotIntegrity,
  executeStageEClosingLineVerification,
} from '../src/lib/integrity/dataIntegrityEngine';
import { canonicalEntityResolver } from '../src/lib/warehouse/entityResolver';

describe('EPIC 53 — Phase 1 Evidence-Based Data Integrity Gates', () => {
  describe('Stage A: Real Canonical Resolver Execution & Linkage Proof', () => {
    test('should resolve raw provider team strings to identical canonical team IDs', () => {
      // Test top European canonical pairs across providers
      expect(canonicalEntityResolver.resolveTeamId('api_football', 'Manchester City')).toBe(
        canonicalEntityResolver.resolveTeamId('oddspapi', 'Manchester City')
      );
      expect(canonicalEntityResolver.resolveTeamId('api_football', 'Arsenal')).toBe(
        canonicalEntityResolver.resolveTeamId('oddspapi', 'Arsenal')
      );
      expect(canonicalEntityResolver.resolveTeamId('api_football', 'Barcelona')).toBe(
        canonicalEntityResolver.resolveTeamId('oddspapi', 'FC Barcelona')
      );
      expect(canonicalEntityResolver.resolveTeamId('api_football', 'Inter Milan')).toBe(
        canonicalEntityResolver.resolveTeamId('oddspapi', 'Inter')
      );
      expect(canonicalEntityResolver.resolveTeamId('api_football', 'AS Roma')).toBe(
        canonicalEntityResolver.resolveTeamId('oddspapi', 'Roma')
      );
      expect(canonicalEntityResolver.resolveTeamId('api_football', 'Borussia Dortmund')).toBe(
        canonicalEntityResolver.resolveTeamId('oddspapi', 'Dortmund')
      );
      expect(canonicalEntityResolver.resolveTeamId('api_football', 'Bayer Leverkusen')).toBe(
        canonicalEntityResolver.resolveTeamId('oddspapi', 'Leverkusen')
      );
    });

    test('should FAIL CLOSED instead of fabricating linkage from quarantined synthetic arrays', () => {
      // The deterministic fixture arrays were quarantined to tests/fixtures/synthetic.ts.
      // Any production integrity path that relied on them must crash loudly.
      expect(() => executeStageALinkage()).toThrowError(/\[FAIL CLOSED\]/);
    });
  });

  describe('Stage B: Synthetic Isolation & Adversarial Exclusion', () => {
    test('should prevent synthetic rows from entering production prediction queries', () => {
      const stageB = executeStageBSyntheticIsolation();
      expect(stageB.isolationFilterEnforced).toBe(true);
      expect(stageB.productionQueryLeakageCount).toBe(0);
      expect(stageB.adversarialSyntheticExclusionPassed).toBe(true);
      expect(stageB.passed).toBe(true);
    });
  });

  describe('Stage C: Historical Warehouse & Adversarial Anti-Leakage Proof', () => {
    test('should prove that future records cannot modify historical feature vectors', () => {
      const stageC = executeStageCHistoricalWarehouse();
      expect(stageC.rawEvidenceCount).toBeGreaterThan(0);
      expect(stageC.featurePointInTimeVerified).toBe(true);
      expect(stageC.adversarialFutureInjectionPassed).toBe(true);
      expect(stageC.modelDatasetAntiLeakageVerified).toBe(true);
      expect(stageC.varEraFlaggedCount).toBeGreaterThan(0);
      expect(stageC.passed).toBe(true);
    });
  });

  describe('Stage D: OddsPAPI Multi-Timestamp Snapshot Integrity', () => {
    test('should preserve multi-timestamp historical depth without row collapsing', () => {
      const stageD = executeStageDSnapshotIntegrity();
      expect(stageD.totalRealSnapshots).toBe(1069);
      expect(stageD.snapshotsFromJan2026).toBe(1069);
      expect(stageD.duplicateSnapshotCount).toBe(0);
      expect(stageD.multiTimestampPreserved).toBe(true);
      expect(stageD.distinctTimestampsPerFixtureMin).toBeGreaterThan(1);
      expect(stageD.passed).toBe(true);
    });
  });

  describe('Stage E: Closing-Line Capture Verification', () => {
    test('should verify capture cron exists and keys to canonical fixture without manufacturing fake rows', () => {
      const stageE = executeStageEClosingLineVerification();
      expect(stageE.captureMechanismExists).toBe(true);
      expect(stageE.linkedToCanonicalFixture).toBe(true);
      expect(stageE.preservesHistoricalSnapshots).toBe(true);
      expect(stageE.syntheticManufacturedClosingLines).toBe(0);
      expect(stageE.passed).toBe(true);
    });
  });

  describe('Checkpoint 1 Decision Gate', () => {
    test('should FAIL CLOSED rather than emit a fabricated PASS declaration', () => {
      // Stage A linkage depends on quarantined synthetic arrays, so the full
      // checkpoint must refuse to emit a PASS/ready declaration until real
      // production queries back the evidence.
      expect(() => runDataIntegrityCheck()).toThrowError(/\[FAIL CLOSED\]/);
    });
  });
});

