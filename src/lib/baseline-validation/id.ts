/**
 * EPIC 17 — Baseline Validation ID Generator
 * Deterministic ID generation for validation artifacts.
 */

import { BV_ID_PREFIX } from './types';

const COUNTERS: Record<string, number> = {};

function generateBVId(prefix: string): string {
  if (!COUNTERS[prefix]) COUNTERS[prefix] = 0;
  COUNTERS[prefix]++;
  return `${prefix}_${String(COUNTERS[prefix]).padStart(6, '0')}`;
}

export function generateScenarioId(): string { return generateBVId(BV_ID_PREFIX.SCENARIO); }
export function generateRankingId(): string { return generateBVId(BV_ID_PREFIX.RANKING); }
export function generatePromotionId(): string { return generateBVId(BV_ID_PREFIX.PROMOTION); }
export function generateStabilityId(): string { return generateBVId(BV_ID_PREFIX.STABILITY); }
export function generateBVReportId(): string { return generateBVId(BV_ID_PREFIX.REPORT); }
export function generateArtifactId(): string { return generateBVId(BV_ID_PREFIX.ARTIFACT); }