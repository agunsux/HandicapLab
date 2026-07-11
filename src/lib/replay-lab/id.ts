/**
 * HandicapLab — Replay Laboratory ID Generator
 * =============================================
 * Additive ID prefixes for the Replay Laboratory that integrate
 * with the existing centralized ID system (src/lib/registry/identifiers).
 *
 * Pure function: deterministic for identical counter state.
 */

import { RL_ID_PREFIX } from './types';

const COUNTERS: Record<string, number> = {};

/** Generate a replay-lab ID with the given prefix. */
export function generateRLId(prefix: string): string {
  if (!COUNTERS[prefix]) COUNTERS[prefix] = 0;
  COUNTERS[prefix]++;
  return `${prefix}_${String(COUNTERS[prefix]).padStart(6, '0')}`;
}

export function generateSessionId(): string {
  return generateRLId(RL_ID_PREFIX.SESSION);
}

export function generateJobId(): string {
  return generateRLId(RL_ID_PREFIX.JOB);
}

export function generateFoldId(): string {
  return generateRLId(RL_ID_PREFIX.FOLD);
}

export function generateSnapshotId(): string {
  return generateRLId(RL_ID_PREFIX.SNAPSHOT);
}

export function generateComparisonId(): string {
  return generateRLId(RL_ID_PREFIX.COMPARISON);
}

export function generateLineageId(): string {
  return generateRLId(RL_ID_PREFIX.LINEAGE);
}

export function generateBootstrapId(): string {
  return generateRLId(RL_ID_PREFIX.BOOTSTRAP);
}

export function generateReportId(): string {
  return generateRLId(RL_ID_PREFIX.REPORT);
}

export function generateDashboardId(): string {
  return generateRLId(RL_ID_PREFIX.DASHBOARD);
}

/** Predictable seed-based shuffle for deterministic order. */
export function seededShuffle<T>(array: readonly T[], seed: number): T[] {
  const result = [...array];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Hash a string to a 64-char hex digest (pure JS, no crypto dependency). */
export function simpleHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 ^= h2;
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}