/**
 * EPIC 19.12 — Feature Artifact Integration
 * Creates immutable artifacts fully traceable.
 */

import type { FeatureArtifact } from './types';
import { generateFIArtifactId } from './id';

export class FeatureArtifactIntegration {
  create(params: {
    datasetId: string;
    experimentId: string;
    modelVersion: string;
    importanceReportId?: string;
    ablationReportId?: string;
  }): FeatureArtifact {
    return {
      artifactId: generateFIArtifactId(),
      datasetId: params.datasetId,
      experimentId: params.experimentId,
      modelVersion: params.modelVersion,
      importanceReportId: params.importanceReportId ?? null,
      ablationReportId: params.ablationReportId ?? null,
      timestamp: new Date().toISOString(),
      immutable: true as const,
    };
  }
}

export const defaultFeatureArtifactIntegration = new FeatureArtifactIntegration();