/**
 * EPIC 20 — Decision Intelligence ID Generator
 */

import { DI_ID_PREFIX } from './types';

const COUNTERS: Record<string, number> = {};

function generateDIId(prefix: string): string {
  if (!COUNTERS[prefix]) COUNTERS[prefix] = 0;
  COUNTERS[prefix]++;
  return `${prefix}_${String(COUNTERS[prefix]).padStart(6, '0')}`;
}

export function generatePolicyId(): string { return generateDIId(DI_ID_PREFIX.POLICY); }
export function generateDecisionId(): string { return generateDIId(DI_ID_PREFIX.DECISION); }
export function generateEVId(): string { return generateDIId(DI_ID_PREFIX.EV); }
export function generateStakeId(): string { return generateDIId(DI_ID_PREFIX.STAKE); }
export function generateRiskId(): string { return generateDIId(DI_ID_PREFIX.RISK); }
export function generatePortfolioId(): string { return generateDIId(DI_ID_PREFIX.PORTFOLIO); }
export function generateConsistencyId(): string { return generateDIId(DI_ID_PREFIX.CONSISTENCY); }
export function generateAttributionId(): string { return generateDIId(DI_ID_PREFIX.ATTRIBUTION); }
export function generateDIReportId(): string { return generateDIId(DI_ID_PREFIX.REPORT); }
export function generateDIArtifactId(): string { return generateDIId(DI_ID_PREFIX.ARTIFACT); }
export function generateGateId(): string { return generateDIId(DI_ID_PREFIX.GATE); }