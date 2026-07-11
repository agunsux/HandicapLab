/**
 * EPIC 20.10 — Decision Artifact Integration
 */

import type { DecisionArtifact, DecisionExplanation } from './types';
import { generateDIArtifactId } from './id';

export class DecisionArtifactIntegration {
  create(params: {
    datasetId: string;
    experimentId: string;
    modelVersion: string;
    decisionExplanation: DecisionExplanation;
  }): DecisionArtifact {
    return {
      artifactId: generateDIArtifactId(),
      datasetId: params.datasetId,
      experimentId: params.experimentId,
      modelVersion: params.modelVersion,
      decisionExplanation: params.decisionExplanation,
      timestamp: new Date().toISOString(),
      immutable: true as const,
    };
  }
}

export const defaultDecisionArtifactIntegration = new DecisionArtifactIntegration();