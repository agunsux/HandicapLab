/**
 * 21.10 — Champion Validation
 * Validates: minimum fixtures, CLV, ROI, edge, consistency, calibration, stability.
 * Returns PASS, WATCH, or FAIL.
 */

import type { ChampionValidationResult, ChampionValidationGate, ChampionStatus, DashboardMetrics } from './types';
import { generateValidationId } from './id';

export class ShadowChampionValidator {
  validate(metrics: DashboardMetrics, gates: { minFixtures: number; minClv: number; minRoi: number; minEdge: number; minConsistency: number; minCalibration: number; minStability: number }): ChampionValidationResult {
    const results: ChampionValidationGate[] = [
      { gate: 'Minimum Fixtures', value: metrics.totalPredictions, threshold: gates.minFixtures, passed: metrics.totalPredictions >= gates.minFixtures },
      { gate: 'CLV Threshold', value: metrics.clv, threshold: gates.minClv, passed: metrics.clv >= gates.minClv },
      { gate: 'ROI Threshold', value: metrics.roi, threshold: gates.minRoi, passed: metrics.roi >= gates.minRoi },
      { gate: 'Edge Threshold', value: metrics.averageEdge, threshold: gates.minEdge, passed: metrics.averageEdge >= gates.minEdge },
      { gate: 'Calibration Threshold', value: metrics.calibration, threshold: gates.minCalibration, passed: metrics.calibration <= gates.minCalibration },
    ];

    const failed = results.filter((r) => !r.passed).length;
    const total = results.length;
    let status: ChampionStatus;
    if (failed === 0) status = 'PASS';
    else if (failed <= Math.ceil(total / 3)) status = 'WATCH';
    else status = 'FAIL';

    return { validationId: generateValidationId(), status, gates: results, message: `Champion status: ${status} (${total - failed}/${total} gates passed)`, generatedAt: new Date().toISOString() };
  }
}

export const defaultShadowChampionValidator = new ShadowChampionValidator();