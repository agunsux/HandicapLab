// ============================================================================
// HANDICAPLAB MODEL VERSION REGISTRY & PROVENANCE
// ============================================================================
// Location: src/lib/archive/modelVersionRegistry.ts
//
// Invariants enforced:
// 1. Every prediction is stamped with its active model version at creation.
// 2. Historical model versions are immutable: never overwrite or recalculate.
// 3. Complete configuration snapshot enables forensic reconstruction.
// ============================================================================

import crypto from 'crypto';

export interface ModelVersionDefinition {
  versionId: string;
  name: string;
  description: string;
  marketScope: ('AH' | 'OU' | 'BTTS')[];
  parametersVersion: string;
  featureVersion: string;
  dataVersion: string;
  isActive: boolean;
  activatedAtUtc: string;
  configSnapshot: {
    engine: string;
    rho: number;
    homeAdvantageMultiplier: number;
    decayFactor?: number;
    scoreGridSize: number;
    valueGateMinEdge: number;
    valueGateMinEv: number;
  };
}

export class ModelVersionRegistry {
  private static readonly REGISTRY: Record<string, ModelVersionDefinition> = {
    'dixon-coles-v1.0': {
      versionId: 'dixon-coles-v1.0',
      name: 'Dixon-Coles Poisson Intensity Grid v1.0',
      description: 'Production Dixon-Coles bivariate Poisson with low-score correlation adjustment rho=-0.05',
      marketScope: ['AH', 'OU', 'BTTS'],
      parametersVersion: 'params-epl-2026-v1',
      featureVersion: 'prematch-features-v1.0',
      dataVersion: 'canonical-production-v1',
      isActive: true,
      activatedAtUtc: '2026-06-01T00:00:00.000Z',
      configSnapshot: {
        engine: 'dixon-coles-poisson',
        rho: -0.05,
        homeAdvantageMultiplier: 1.12,
        scoreGridSize: 10,
        valueGateMinEdge: 0.02,
        valueGateMinEv: 0.03,
      },
    },
    'BTTS-jointscore-v1.0.0': {
      versionId: 'BTTS-jointscore-v1.0.0',
      name: 'Joint Score Grid BTTS Derivation v1.0.0',
      description: 'BTTS probabilities derived directly from Dixon-Coles 10x10 score grid matrix',
      marketScope: ['BTTS'],
      parametersVersion: 'params-btts-2026-v1',
      featureVersion: 'prematch-features-v1.0',
      dataVersion: 'canonical-production-v1',
      isActive: true,
      activatedAtUtc: '2026-06-01T00:00:00.000Z',
      configSnapshot: {
        engine: 'joint-score-matrix-summation',
        rho: -0.05,
        homeAdvantageMultiplier: 1.12,
        scoreGridSize: 10,
        valueGateMinEdge: 0.02,
        valueGateMinEv: 0.03,
      },
    },
  };

  /**
   * Returns active model version for a given market.
   */
  public static getActiveModelVersion(market: 'AH' | 'OU' | 'BTTS' | 'ML' | string): ModelVersionDefinition {
    if (market === 'BTTS') {
      return this.REGISTRY['BTTS-jointscore-v1.0.0'] || this.REGISTRY['dixon-coles-v1.0'];
    }
    return this.REGISTRY['dixon-coles-v1.0'];
  }

  /**
   * Retrieves definition for any registered model version (including retired ones).
   */
  public static getModelVersion(versionId: string): ModelVersionDefinition | null {
    return this.REGISTRY[versionId] || null;
  }

  /**
   * Computes a deterministic SHA-256 fingerprint for a model version & its parameters.
   */
  public static computeModelHash(versionId: string): string {
    const def = this.getModelVersion(versionId);
    if (!def) {
      return crypto.createHash('sha256').update(versionId).digest('hex');
    }
    const payload = JSON.stringify({
      versionId: def.versionId,
      parametersVersion: def.parametersVersion,
      featureVersion: def.featureVersion,
      configSnapshot: def.configSnapshot,
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Verifies model version registration and returns its cryptographic fingerprint.
   */
  public static verifyModelConfiguration(versionId: string): { verified: boolean; modelHash: string; definition: ModelVersionDefinition | null } {
    const def = this.getModelVersion(versionId);
    if (!def) {
      return { verified: false, modelHash: '', definition: null };
    }
    const hash = this.computeModelHash(versionId);
    return { verified: true, modelHash: hash, definition: def };
  }
}
