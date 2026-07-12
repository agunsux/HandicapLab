/**
 * 21.9 — Drift Detection
 * Detects feature, probability, market, decision, calibration, and performance drift.
 */

import type { DriftReport, DriftAlert, DriftDimension } from './types';
import { generateDriftId } from './id';

export class ShadowDriftDetector {
  detect(alerts: { dimension: DriftDimension; severity: 'low' | 'medium' | 'high'; confidence: number; value: number; threshold: number; recommendedAction: string }[]): DriftReport {
    const finalAlerts: DriftAlert[] = alerts.map((a) => ({
      dimension: a.dimension,
      severity: a.severity,
      confidence: Math.round(a.confidence * 100) / 100,
      value: Math.round(a.value * 10000) / 10000,
      threshold: a.threshold,
      recommendedAction: a.recommendedAction,
    }));

    return {
      driftId: generateDriftId(),
      generatedAt: new Date().toISOString(),
      alerts: finalAlerts,
      overallDrift: finalAlerts.some((a) => a.severity === 'high'),
    };
  }
}

export const defaultShadowDriftDetector = new ShadowDriftDetector();