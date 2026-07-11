/**
 * EPIC 19 — Feature Intelligence ID Generator
 */

import { FI_ID_PREFIX } from './types';

const COUNTERS: Record<string, number> = {};

function generateFIId(prefix: string): string {
  if (!COUNTERS[prefix]) COUNTERS[prefix] = 0;
  COUNTERS[prefix]++;
  return `${prefix}_${String(COUNTERS[prefix]).padStart(6, '0')}`;
}

export function generateFeatureId(): string { return generateFIId(FI_ID_PREFIX.FEATURE); }
export function generateLineageId(): string { return generateFIId(FI_ID_PREFIX.LINEAGE); }
export function generateImportanceId(): string { return generateFIId(FI_ID_PREFIX.IMPORTANCE); }
export function generateAblationId(): string { return generateFIId(FI_ID_PREFIX.ABLATION); }
export function generateFStabilityId(): string { return generateFIId(FI_ID_PREFIX.STABILITY); }
export function generateRedundancyId(): string { return generateFIId(FI_ID_PREFIX.REDUNDANCY); }
export function generateFDriftId(): string { return generateFIId(FI_ID_PREFIX.DRIFT); }
export function generateGovernanceId(): string { return generateFIId(FI_ID_PREFIX.GOVERNANCE); }
export function generateQualityId(): string { return generateFIId(FI_ID_PREFIX.QUALITY); }
export function generateFIReportId(): string { return generateFIId(FI_ID_PREFIX.REPORT); }
export function generateFIArtifactId(): string { return generateFIId(FI_ID_PREFIX.ARTIFACT); }