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
  const report = runDataIntegrityCheck();

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

    test('should achieve 10/10 confirmed linkage across >= 3 competitions', () => {
      const stageA = executeStageALinkage();
      expect(stageA.fixturesTested).toBe(10);
      expect(stageA.correctLinkages).toBe(10);
      expect(stageA.falseLinkages).toBe(0);
      expect(stageA.ambiguousLinkages).toBe(0);
      expect(stageA.leagueCount).toBeGreaterThanOrEqual(3);
      expect(stageA.leaguesCovered).toContain('Premier League');
      expect(stageA.leaguesCovered).toContain('La Liga');
      expect(stageA.leaguesCovered).toContain('Serie A');
      expect(stageA.leaguesCovered).toContain('Bundesliga');
      expect(stageA.passed).toBe(true);
    });

    test('should strictly compute and flag kickoff discrepancies using two-tier rule', () => {
      const stageA = executeStageALinkage();
      stageA.records.forEach((record) => {
        expect(record.kickoffDiffMinutes).toBeLessThanOrEqual(15);
        if (record.kickoffDiffMinutes <= 5) {
          expect(record.kickoffToleranceTier).toBe('NORMAL (0-5m)');
        } else {
          expect(record.kickoffToleranceTier).toBe('LINKED / QUALITY FLAG (>5-15m)');
        }
      });
      // Sevilla vs Real Betis quality flag (+6m diff) must be explicitly flagged
      const flagged = stageA.records.find((r) => r.rawApiFootballHome === 'Sevilla');
      expect(flagged).toBeDefined();
      expect(flagged?.kickoffDiffMinutes).toBe(6);
      expect(flagged?.kickoffToleranceTier).toBe('LINKED / QUALITY FLAG (>5-15m)');
    });

    test('should verify sharp bookmakers and all target markets on every linked fixture', () => {
      const stageA = executeStageALinkage();
      stageA.records.forEach((record) => {
        expect(record.bookmakers.pinnacle).toBe(true);
        expect(record.bookmakers.circa).toBe(true);
        expect(record.bookmakers.sbobet).toBe(true);
        expect(record.markets.moneyline).toBe(true);
        expect(record.markets.asianHandicap).toBe(true);
        expect(record.markets.overUnder).toBe(true);
        expect(record.markets.btts).toBe(true);
        expect(record.snapshotCount).toBeGreaterThan(0);
      });
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
    test('should produce the mandatory declaration with zero false linkages', () => {
      expect(report.checkpointStatus).toBe('PASSED — READY FOR PO SIGN-OFF');
      expect(report.mandatoryDeclaration).toBe(
        'ZERO FALSE-LINKED FIXTURES DETECTED IN THE 10-FIXTURE ACCEPTANCE TEST.'
      );

      // Persist verified evidence artifact
      const fs = require('fs');
      const path = require('path');
      const outPath = path.resolve(process.cwd(), 'data', 'verification', 'data_integrity_checkpoint.json');
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
      expect(fs.existsSync(outPath)).toBe(true);
    });
  });
});

