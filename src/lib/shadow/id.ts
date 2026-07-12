/**
 * EPIC 21 — Shadow Research ID Generator
 */

import { SH_ID_PREFIX } from './types';

const COUNTERS: Record<string, number> = {};

function generateSHId(prefix: string): string {
  if (!COUNTERS[prefix]) COUNTERS[prefix] = 0;
  COUNTERS[prefix]++;
  return `${prefix}_${String(COUNTERS[prefix]).padStart(6, '0')}`;
}

export function generateFixtureId(): string { return generateSHId(SH_ID_PREFIX.FIXTURE); }
export function generateSnapshotId(): string { return generateSHId(SH_ID_PREFIX.SNAPSHOT); }
export function generateOddsId(): string { return generateSHId(SH_ID_PREFIX.ODDS); }
export function generateEventId(): string { return generateSHId(SH_ID_PREFIX.EVENT); }
export function generateResultId(): string { return generateSHId(SH_ID_PREFIX.RESULT); }
export function generateEvaluationId(): string { return generateSHId(SH_ID_PREFIX.EVALUATION); }
export function generateLedgerId(): string { return generateSHId(SH_ID_PREFIX.LEDGER); }
export function generateDashboardId(): string { return generateSHId(SH_ID_PREFIX.DASHBOARD); }
export function generateDriftId(): string { return generateSHId(SH_ID_PREFIX.DRIFT); }
export function generateValidationId(): string { return generateSHId(SH_ID_PREFIX.VALIDATION); }
export function generateSHReportId(): string { return generateSHId(SH_ID_PREFIX.REPORT); }
export function generateSHArtifactId(): string { return generateSHId(SH_ID_PREFIX.ARTIFACT); }