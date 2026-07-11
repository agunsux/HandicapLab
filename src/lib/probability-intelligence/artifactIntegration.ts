/**
 * EPIC 18.10 — Calibration Artifact Integration
 * Creates immutable calibration artifacts fully traceable.
 */

import type { CalibrationArtifact, CalibratorId, MarketCalibrationProfile, ReliabilityCurve, CalibrationMetricsResult } from './types';
import { generatePIArtifactId } from './id';

export class CalibrationArtifactIntegration {
  createArtifact(params: {
    datasetId: string;
    experimentId: string;
    modelVersion: string;
    featureVersion: string;
    calibratorId: CalibratorId;
    calibrationProfile: MarketCalibrationProfile;
    reliabilityCurve: ReliabilityCurve;
    metrics: CalibrationMetricsResult;
  }): CalibrationArtifact {
    return {
      artifactId: generatePIArtifactId(),
      datasetId: params.datasetId,
      experimentId: params.experimentId,
      modelVersion: params.modelVersion,
      featureVersion: params.featureVersion,
      calibratorId: params.calibratorId,
      calibrationProfile: params.calibrationProfile,
      reliabilityCurve: params.reliabilityCurve,
      metrics: params.metrics,
      timestamp: new Date().toISOString(),
      immutable: true as const,
    };
  }
}

export const defaultCalibrationArtifactIntegration = new CalibrationArtifactIntegration();