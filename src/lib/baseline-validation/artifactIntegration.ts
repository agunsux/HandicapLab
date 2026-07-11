/**
 * EPIC 17.10 — Research Artifact Integration
 * Creates immutable research artifacts fully traceable to datasets,
 * evidence, replay sessions, experiments, models, and features.
 */

import type { ValidationArtifact } from './types';
import { generateArtifactId } from './id';
import { simpleHash } from '../replay-lab/id';

export class ArtifactIntegration {
  createArtifact(params: {
    benchmarkReportId: string;
    datasetId: string;
    evidenceArtifactId: string;
    replaySessionId: string;
    experimentId: string;
    modelVersion: string;
    featureVersion: string;
    championDecisionId?: string;
    researchReportId?: string;
  }): ValidationArtifact {
    const evalPayload = [
      params.benchmarkReportId, params.datasetId, params.evidenceArtifactId,
      params.replaySessionId, params.experimentId, params.modelVersion,
    ].join('|');

    return {
      artifactId: generateArtifactId(),
      benchmarkReportId: params.benchmarkReportId,
      datasetId: params.datasetId,
      evidenceArtifactId: params.evidenceArtifactId,
      replaySessionId: params.replaySessionId,
      experimentId: params.experimentId,
      modelVersion: params.modelVersion,
      featureVersion: params.featureVersion,
      evaluationHash: simpleHash(evalPayload),
      championDecisionId: params.championDecisionId ?? null,
      researchReportId: params.researchReportId ?? null,
      timestamp: new Date().toISOString(),
      immutable: true as const,
    };
  }
}

export const defaultArtifactIntegration = new ArtifactIntegration();