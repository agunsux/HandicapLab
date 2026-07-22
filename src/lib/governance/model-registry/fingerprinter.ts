// Canonical Cryptographic Fingerprinting Engine
// Location: src/lib/governance/model-registry/fingerprinter.ts

import { createHash } from 'crypto';
import { FingerprintSet } from './types';

export class Fingerprinter {
  /**
   * Computes a deterministic SHA-256 hash for any serializable object or string payload.
   */
  public static hash(data: any): string {
    const payload = typeof data === 'string' ? data : JSON.stringify(data, Object.keys(data).sort());
    return createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Generates a complete set of cryptographic SHA-256 fingerprints for a model governance record.
   */
  public static generateFingerprints(params: {
    dataset: any;
    featureSchema: any;
    featureTransform: any;
    calibrationArtifact: any;
    hyperparameters: any;
    gitCommitSha?: string;
  }): FingerprintSet {
    return {
      datasetSha: this.hash(params.dataset),
      featureSchemaSha: this.hash(params.featureSchema),
      featureTransformSha: this.hash(params.featureTransform),
      calibrationSha: this.hash(params.calibrationArtifact),
      hyperparameterSha: this.hash(params.hyperparameters),
      gitCommitSha: params.gitCommitSha || 'HEAD_UNCOMMITTED'
    };
  }

  /**
   * Compares two fingerprint sets and checks exact equality across all dimensions.
   */
  public static verifyMatch(a: FingerprintSet, b: FingerprintSet): {
    dataset: boolean;
    featureSchema: boolean;
    featureTransform: boolean;
    calibration: boolean;
    hyperparameters: boolean;
    gitCommit: boolean;
    allMatched: boolean;
  } {
    const matches = {
      dataset: a.datasetSha === b.datasetSha,
      featureSchema: a.featureSchemaSha === b.featureSchemaSha,
      featureTransform: a.featureTransformSha === b.featureTransformSha,
      calibration: a.calibrationSha === b.calibrationSha,
      hyperparameters: a.hyperparameterSha === b.hyperparameterSha,
      gitCommit: a.gitCommitSha === b.gitCommitSha
    };

    const allMatched = Object.values(matches).every(Boolean);

    return {
      ...matches,
      allMatched
    };
  }
}
