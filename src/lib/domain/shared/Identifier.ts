/**
 * HandicapLab Domain-Driven Design — Shared Kernel: Identifiers
 *
 * Canonical identifier generation for all domain entities.
 * Consistent prefix-based ID generation with zero-padded sequence numbers.
 * Fully backward compatible with existing src/lib/registry/identifiers.ts
 */

/** Standard ID prefixes for all domain entity types */
export const ID_PREFIX = {
  COMPETITION: 'comp',
  SEASON: 'seas',
  LEAGUE: 'lea',
  FIXTURE: 'fxt',
  TEAM: 'team',
  PLAYER: 'plyr',
  VENUE: 'ven',
  ODDS: 'odd',
  MARKET: 'mkt',
  PREDICTION: 'pred',
  PROBABILITY: 'prob',
  CALIBRATION: 'cal',
  FEATURE: 'feat',
  DECISION: 'dec',
  POLICY: 'pol',
  STAKE: 'stk',
  PORTFOLIO: 'port',
  RESEARCH: 'res',
  REPLAY: 'repl',
  EVIDENCE: 'evd',
  EXPERIMENT: 'exp',
  MODEL: 'mdl',
  PROVIDER: 'prov',
  RESULT: 'rslt',
  PERFORMANCE: 'perf',
  DRIFT: 'drft',
  RISK: 'risk',
  REPORT: 'rep',
  ARTIFACT: 'art',
  EVENT: 'evt',
} as const;

export type IdPrefix = (typeof ID_PREFIX)[keyof typeof ID_PREFIX];

const COUNTERS: Record<string, number> = {};

/**
 * Generate a unique ID with the given prefix.
 * Sequence numbers are zero-padded to 6 digits for natural sorting.
 */
export function generateId(prefix: IdPrefix): string {
  if (!COUNTERS[prefix]) COUNTERS[prefix] = 0;
  COUNTERS[prefix]++;
  return `${prefix}_${String(COUNTERS[prefix]).padStart(6, '0')}`;
}

/**
 * Reset all counters (for testing only).
 */
export function resetCounters(): void {
  for (const key of Object.keys(COUNTERS)) {
    delete COUNTERS[key];
  }
}

/**
 * Parse a canonical ID into its prefix and sequence components.
 */
export function parseId(id: string): { prefix: string; sequence: number } | null {
  const match = id.match(/^(\w+)_(\d{6})$/);
  if (!match) return null;
  return { prefix: match[1], sequence: parseInt(match[2], 10) };
}

/**
 * Check if an ID string follows the canonical format.
 */
export function isValidId(id: string): boolean {
  return /^\w+_\d{6}$/.test(id);
}

/**
 * Extract the entity type prefix from a canonical ID.
 */
export function getIdPrefix(id: string): IdPrefix | null {
  const parsed = parseId(id);
  if (!parsed) return null;
  return parsed.prefix as IdPrefix;
}