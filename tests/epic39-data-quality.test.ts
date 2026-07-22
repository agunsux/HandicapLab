import { describe, it, expect } from 'vitest';
import { DataQualityEngine } from '../src/lib/data-quality/data-quality-score';
import { IntegrityValidatorEngine } from '../src/lib/data-quality/integrity-validator';
import { FeatureDriftDetectorEngine } from '../src/lib/data-quality/feature-drift-detector';
import { LineageVisualizerEngine } from '../src/lib/data-quality/lineage-visualizer';
import { ExperimentRegistryEngine } from '../src/lib/data-quality/experiment-registry';

describe('EPIC 39 — Data Quality & Integrity Platform Test Suite', () => {
  describe('1. Data Quality Score Engine (0-100)', () => {
    it('should compute 0-100 Data Quality Score and reject duplicate records', () => {
      const report1 = DataQualityEngine.evaluateQuality({
        fixtureId: 'f-test-1',
        totalExpectedFields: 50,
        totalPopulatedFields: 49,
        bookmakerQuotesCount: 8,
        expectedBookmakersCount: 8,
        missingXgCount: 1,
        totalXgMatchesCount: 100,
        duplicateCount: 0,
        integrityFailures: [],
      });

      expect(report1.qualityScore).toBeGreaterThan(90);
      expect(report1.integrityStatus).toBe('PASS');

      // Duplicate record must trigger FAIL
      const report2 = DataQualityEngine.evaluateQuality({
        fixtureId: 'f-test-2',
        totalExpectedFields: 50,
        totalPopulatedFields: 49,
        bookmakerQuotesCount: 8,
        expectedBookmakersCount: 8,
        missingXgCount: 1,
        totalXgMatchesCount: 100,
        duplicateCount: 1,
        integrityFailures: [],
      });

      expect(report2.integrityStatus).toBe('FAIL');
    });
  });

  describe('2. Automated Data Integrity Checker Engine', () => {
    it('should catch impossible odds, impossible scores, and anomalous margins', () => {
      const failures = IntegrityValidatorEngine.validateFixtureIntegrity({
        fixtureId: 'f-fail-1',
        homeScore: -1, // Impossible score
        awayScore: 2,
        kickoffIso: 'invalid-date',
        homeOdds: 0.95, // Impossible odds
        awayOdds: 2.10,
        bookmakerMargin: 0.25, // Anomalous margin (>15%)
      });

      expect(failures.length).toBeGreaterThan(0);
      expect(failures.some(f => f.includes('Impossible Home Score'))).toBe(true);
      expect(failures.some(f => f.includes('Impossible Home Odds'))).toBe(true);
    });
  });

  describe('3. Feature Distribution Drift Detector', () => {
    it('should detect feature drift between historical mean and live snapshot', () => {
      const drift = FeatureDriftDetectorEngine.detectFeatureDrift('Average xG', 1.42, 1.08, 15.0, 30.0);
      expect(drift.driftPct).toBeGreaterThan(20);
      expect(drift.alertLevel).toBe('WARNING');
      expect(drift.summaryText).toContain('WARNING');
    });
  });

  describe('4. Data Lineage Visualizer Engine', () => {
    it('should generate end-to-end pipeline trace steps', () => {
      const lineage = LineageVisualizerEngine.getFixtureLineage('fix-lin-1');
      expect(lineage.length).toBe(7);
      expect(lineage[0].stepName).toBe('Raw Ingestion');
      expect(lineage[6].stepName).toBe('Settlement & Audit');
    });
  });

  describe('5. Research Experiment Registry Engine', () => {
    it('should retrieve registered experiments and allow adding EXP logs', () => {
      const exps = ExperimentRegistryEngine.getExperiments();
      expect(exps.length).toBeGreaterThan(0);
      expect(exps[0].experimentId).toBe('EXP-2026-041');
      expect(exps[0].status).toBe('ACCEPTED');
    });
  });
});
