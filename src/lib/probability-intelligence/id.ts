/**
 * EPIC 18 — Probability Intelligence ID Generator
 */

import { PI_ID_PREFIX } from './types';

const COUNTERS: Record<string, number> = {};

function generatePIId(prefix: string): string {
  if (!COUNTERS[prefix]) COUNTERS[prefix] = 0;
  COUNTERS[prefix]++;
  return `${prefix}_${String(COUNTERS[prefix]).padStart(6, '0')}`;
}

export function generateCalibratorId(): string { return generatePIId(PI_ID_PREFIX.CALIBRATOR); }
export function generateReliabilityId(): string { return generatePIId(PI_ID_PREFIX.RELIABILITY); }
export function generateCrossValId(): string { return generatePIId(PI_ID_PREFIX.CROSSVAL); }
export function generateDriftId(): string { return generatePIId(PI_ID_PREFIX.DRIFT); }
export function generateExplainId(): string { return generatePIId(PI_ID_PREFIX.EXPLAIN); }
export function generatePIReportId(): string { return generatePIId(PI_ID_PREFIX.REPORT); }
export function generatePIArtifactId(): string { return generatePIId(PI_ID_PREFIX.ARTIFACT); }
export function generatePIDashboardId(): string { return generatePIId(PI_ID_PREFIX.DASHBOARD); }
export function generateCalGateId(): string { return generatePIId(PI_ID_PREFIX.CALGATE); }