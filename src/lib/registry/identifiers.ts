/**
 * HandicapLab Centralized ID Generator
 * =======================================================
 * Consistent prefix-based ID generation for all registry entities.
 *
 * Default: counter-based auto-increment with zero-padded sequence numbers.
 * Custom suffixes are appended to the prefix for semantic disambiguation.
 */

const COUNTERS: Record<string, number> = {};

/**
 * Generate a unique ID with the given prefix.
 * Sequence numbers are zero-padded to 6 digits for natural sorting.
 */
export function generateId(prefix: string): string {
  if (!COUNTERS[prefix]) COUNTERS[prefix] = 0;
  COUNTERS[prefix]++;
  return `${prefix}_${String(COUNTERS[prefix]).padStart(6, '0')}`;
}

/**
 * Standard ID prefixes for all registry entity types.
 */
export const ID_PREFIX = {
  EXPERIMENT: 'exp',
  MODEL: 'mdl',
  FEATURE: 'feat',
  DATASET: 'ds',
  VALIDATION: 'val',
  PENCHMARK: 'bench',
  REPORT: 'rep',
  EXECUTION: 'exec',
  REPLAY: 'repl',
} as const;

export type IdPrefix = (typeof ID_PREFIX)[keyof typeof ID_PREFIX];
