// EPIC 41 — Model Governance Platform Comprehensive Test Suite
// Location: tests/governance/model-registry.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRegistryService } from '../../src/lib/governance/model-registry/registry';
import { Fingerprinter } from '../../src/lib/governance/model-registry/fingerprinter';
import { ModelMetadata } from '../../src/lib/governance/model-registry/types';
import { ProviderCredentialCheck } from '../../src/lib/health/credential-health';

describe('EPIC 41 — Model Governance Platform Tests', () => {
  let registry: ModelRegistryService;

  beforeEach(() => {
    ModelRegistryService.resetInstance();
    registry = ModelRegistryService.getInstance();
  });

  describe('1. Immutable Model Registry & Registration', () => {
    it('should initialize with baseline Champion model', () => {
      const champion = registry.getChampion();
      expect(champion.id).toBe('HL-DC-POISSON-v1.0.0');
      expect(champion.state).toBe('CHAMPION');
      expect(champion.version).toBe('1.0.0');
    });

    it('should register a new model version in DRAFT state', () => {
      const newModel: Omit<ModelMetadata, 'createdAt' | 'state'> = {
        id: 'HL-DC-POISSON-v2.0.0',
        name: 'Dixon-Coles Neural Ensemble',
        version: '2.0.0',
        artifactUri: 's3://handicaplab-models/artifacts/HL-DC-POISSON-v2.0.0.json',
        fingerprints: {
          datasetSha: '1111111111111111111111111111111111111111111111111111111111111111',
          featureSchemaSha: '2222222222222222222222222222222222222222222222222222222222222222',
          featureTransformSha: '3333333333333333333333333333333333333333333333333333333333333333',
          calibrationSha: '4444444444444444444444444444444444444444444444444444444444444444',
          hyperparameterSha: '5555555555555555555555555555555555555555555555555555555555555555',
          gitCommitSha: 'commit_hash_v2'
        },
        providerSnapshot: {
          provider: 'API-Football Warehouse',
          version: 'v3',
          endpoint: '/fixtures',
          responseSchema: 'v3_json',
          timestamp: new Date().toISOString(),
          credentialProfile: 'PRODUCTION'
        },
        parameters: { homeAdvantage: 0.30, timeDecayLambda: 0.0030 },
        metrics: {
          roiPercent: 9.2,
          clvPercent: 4.1,
          brierScore: 0.182,
          ece: 0.021,
          logLoss: 0.590,
          sampleSize: 500,
          shadowDaysEvaluated: 20
        }
      };

      const registered = registry.registerModel(newModel);
      expect(registered.id).toBe('HL-DC-POISSON-v2.0.0');
      expect(registered.state).toBe('DRAFT');
    });

    it('should throw an Immutability Violation if attempting to overwrite an existing model ID', () => {
      const duplicate: Omit<ModelMetadata, 'createdAt' | 'state'> = {
        id: 'HL-DC-POISSON-v1.0.0', // Existing baseline ID
        name: 'Duplicate Overwrite Attempt',
        version: '1.0.0',
        artifactUri: 's3://overwrite/path',
        fingerprints: registry.getChampion().fingerprints,
        providerSnapshot: registry.getChampion().providerSnapshot,
        parameters: {},
        metrics: { roiPercent: 0, clvPercent: 0, brierScore: 0.5, ece: 0.1, logLoss: 1.0, sampleSize: 10 }
      };

      expect(() => registry.registerModel(duplicate)).toThrow(/Immutability Violation/);
    });
  });

  describe('2. Multi-Layer Cryptographic Fingerprinting', () => {
    it('should generate deterministic SHA-256 fingerprints across all 6 dimensions', () => {
      const dataset = [{ matchId: 1, homeGoals: 2, awayGoals: 1 }];
      const schema = { version: '1.0', fields: ['xgHome', 'xgAway'] };
      const transform = { normalize: true, stdScale: false };
      const calibration = { method: 'platt', a: -1.2, b: 0.05 };
      const params = { decay: 0.003 };

      const fingerprints = Fingerprinter.generateFingerprints({
        dataset,
        featureSchema: schema,
        featureTransform: transform,
        calibrationArtifact: calibration,
        hyperparameters: params,
        gitCommitSha: 'abc123commit'
      });

      expect(fingerprints.datasetSha).toHaveLength(64);
      expect(fingerprints.featureSchemaSha).toHaveLength(64);
      expect(fingerprints.featureTransformSha).toHaveLength(64);
      expect(fingerprints.calibrationSha).toHaveLength(64);
      expect(fingerprints.hyperparameterSha).toHaveLength(64);
      expect(fingerprints.gitCommitSha).toBe('abc123commit');
    });

    it('should verify fingerprint matches correctly', () => {
      const fpA = Fingerprinter.generateFingerprints({
        dataset: 'data_a',
        featureSchema: 'schema_a',
        featureTransform: 'trans_a',
        calibrationArtifact: 'cal_a',
        hyperparameters: 'param_a',
        gitCommitSha: 'commit_a'
      });

      const fpB = Fingerprinter.generateFingerprints({
        dataset: 'data_a',
        featureSchema: 'schema_a',
        featureTransform: 'trans_a',
        calibrationArtifact: 'cal_a',
        hyperparameters: 'param_a',
        gitCommitSha: 'commit_a'
      });

      const result = Fingerprinter.verifyMatch(fpA, fpB);
      expect(result.allMatched).toBe(true);
    });
  });

  describe('3. Champion Promotion Quality Gates & Rollback', () => {
    it('should fail promotion if model metrics fail Quality Gates', () => {
      const weakModel: Omit<ModelMetadata, 'createdAt' | 'state'> = {
        id: 'HL-WEAK-v1.0.0',
        name: 'Weak Model Candidate',
        version: '1.0.0',
        artifactUri: 's3://path',
        fingerprints: registry.getChampion().fingerprints,
        providerSnapshot: registry.getChampion().providerSnapshot,
        parameters: {},
        metrics: {
          roiPercent: 1.0, // Failed: < 5.0%
          clvPercent: -0.5, // Failed: < 2.0%
          brierScore: 0.28, // Failed: > 0.22
          ece: 0.08, // Failed: > 0.05
          logLoss: 0.8,
          sampleSize: 50, // Failed: < 200
          shadowDaysEvaluated: 3 // Failed: < 14
        }
      };

      registry.registerModel(weakModel);
      const res = registry.promoteToChampion('HL-WEAK-v1.0.0');

      expect(res.success).toBe(false);
      expect(res.gateFailures.length).toBeGreaterThan(0);
      expect(registry.getChampion().id).toBe('HL-DC-POISSON-v1.0.0'); // Champion untouched
    });

    it('should promote challenger to Champion when Quality Gates pass', () => {
      const strongModel: Omit<ModelMetadata, 'createdAt' | 'state'> = {
        id: 'HL-STRONG-v2.0.0',
        name: 'Strong Model Candidate',
        version: '2.0.0',
        artifactUri: 's3://path',
        fingerprints: registry.getChampion().fingerprints,
        providerSnapshot: registry.getChampion().providerSnapshot,
        parameters: {},
        metrics: {
          roiPercent: 8.5,
          clvPercent: 3.5,
          brierScore: 0.185,
          ece: 0.025,
          logLoss: 0.58,
          sampleSize: 300,
          shadowDaysEvaluated: 15
        }
      };

      registry.registerModel(strongModel);
      registry.transitionState('HL-STRONG-v2.0.0', 'CHALLENGER');

      const res = registry.promoteToChampion('HL-STRONG-v2.0.0');

      expect(res.success).toBe(true);
      expect(registry.getChampion().id).toBe('HL-STRONG-v2.0.0');
      expect(registry.getModel('HL-DC-POISSON-v1.0.0')?.state).toBe('DEPRECATED');
    });

    it('should perform immutable pointer-based rollback', () => {
      // Register & promote v2
      const v2: Omit<ModelMetadata, 'createdAt' | 'state'> = {
        id: 'HL-V2-MODEL',
        name: 'V2 Model',
        version: '2.0.0',
        artifactUri: 's3://path',
        fingerprints: registry.getChampion().fingerprints,
        providerSnapshot: registry.getChampion().providerSnapshot,
        parameters: {},
        metrics: {
          roiPercent: 8.5, clvPercent: 3.5, brierScore: 0.185, ece: 0.025, logLoss: 0.58, sampleSize: 300, shadowDaysEvaluated: 15
        }
      };
      registry.registerModel(v2);
      registry.promoteToChampion('HL-V2-MODEL');
      expect(registry.getChampion().id).toBe('HL-V2-MODEL');

      // Rollback pointer to baseline v1
      const restored = registry.rollbackChampion('HL-DC-POISSON-v1.0.0', 'Unexpected live market variance');

      expect(restored.id).toBe('HL-DC-POISSON-v1.0.0');
      expect(registry.getChampion().id).toBe('HL-DC-POISSON-v1.0.0');
    });
  });

  describe('4. Complete Prediction Reproducibility Engine', () => {
    it('should verify prediction reproducibility given context & fingerprints', () => {
      const champion = registry.getChampion();

      const context = {
        predictionId: 'PRED-EPL-2026-001',
        modelVersionId: champion.id,
        fingerprints: champion.fingerprints,
        providerSnapshot: champion.providerSnapshot,
        oddsSnapshot: {
          homeWin: 2.10,
          draw: 3.40,
          awayWin: 3.80,
          capturedAt: new Date().toISOString()
        },
        inputFeatures: { xgHome: 1.8, xgAway: 0.9 },
        outputProbabilities: { pHome: 0.52, pDraw: 0.26, pAway: 0.22 }
      };

      const result = registry.reproducePrediction(context);

      expect(result.isExactMatch).toBe(true);
      expect(result.predictionId).toBe('PRED-EPL-2026-001');
      expect(result.fingerprintMatches.dataset).toBe(true);
      expect(result.fingerprintMatches.calibration).toBe(true);
    });
  });

  describe('5. Audit Trail & State Change Traceability', () => {
    it('should log an immutable audit trail record for every state change', () => {
      const trail = registry.getAuditTrail();
      expect(trail.length).toBeGreaterThan(0);
      expect(trail[0].reason).toContain('Initial baseline');

      const v2Model: Omit<ModelMetadata, 'createdAt' | 'state'> = {
        id: 'HL-AUDIT-v1',
        name: 'Audit Model',
        version: '1.0.0',
        artifactUri: 's3://path',
        fingerprints: registry.getChampion().fingerprints,
        providerSnapshot: registry.getChampion().providerSnapshot,
        parameters: {},
        metrics: { roiPercent: 8.0, clvPercent: 3.0, brierScore: 0.19, ece: 0.03, logLoss: 0.6, sampleSize: 300, shadowDaysEvaluated: 15 }
      };
      registry.registerModel(v2Model);
      registry.transitionState('HL-AUDIT-v1', 'SHADOW', 'Starting 14-day shadow mode');

      const updatedTrail = registry.getAuditTrail();
      const lastAudit = updatedTrail[updatedTrail.length - 1];
      expect(lastAudit.modelId).toBe('HL-AUDIT-v1');
      expect(lastAudit.fromState).toBe('DRAFT');
      expect(lastAudit.toState).toBe('SHADOW');
      expect(lastAudit.reason).toBe('Starting 14-day shadow mode');
    });
  });

  describe('6. Provider Credential Health Check (EPIC 34.1)', () => {
    it('should return healthy status in static build / development mode', async () => {
      const check = new ProviderCredentialCheck();
      const res = await check.run();

      expect(res.status).toBe('healthy');
      expect(res.details?.mode).toBeDefined();
    });
  });
});
