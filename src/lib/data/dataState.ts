// ============================================================================
// CANONICAL DATA STATE
// ============================================================================
// Every user-facing number must be labelled with one of these states.
// Never display stale data as live, and never substitute mock data.
//
//   REAL                — freshly computed from provider/database evidence
//   CACHED              — served from cache within its TTL
//   STALE               — real data, but older than its freshness budget
//   INSUFFICIENT_DATA   — real data exists but sample size is too small
//   DATA_UNAVAILABLE    — no real data exists for this metric
//   DATA_UPDATE_PAUSED  — quota protection active; ingestion intentionally paused

export type DataState =
  | 'REAL'
  | 'CACHED'
  | 'STALE'
  | 'INSUFFICIENT_DATA'
  | 'DATA_UNAVAILABLE'
  | 'DATA_UPDATE_PAUSED';

export interface DataStateMeta {
  state: DataState;
  reason?: string;
  asOf?: string;
  sampleSize?: number;
  ageMs?: number;
}

export interface DeriveDataStateInput {
  /** Whether any real data value exists. */
  hasData: boolean;
  /** Sample size backing the value (observations, bets, fixtures, ...). */
  sampleSize?: number;
  /** Minimum sample size required for a claim (default 30). */
  minSample?: number;
  /** Age of the data in ms (optional). */
  ageMs?: number;
  /** Freshness budget in ms (optional; required to ever return STALE). */
  maxAgeMs?: number;
  /** True when the value came from a cache hit. */
  fromCache?: boolean;
  /** Provider/quota status that may pause updates. */
  providerStatus?: 'OK' | 'PROVIDER_UNAVAILABLE' | 'QUOTA_EXHAUSTED' | 'QUOTA_INFRA_UNAVAILABLE';
}

export const DEFAULT_MIN_SAMPLE = 30;

export function deriveDataState(input: DeriveDataStateInput): DataState {
  const {
    hasData,
    sampleSize,
    minSample = DEFAULT_MIN_SAMPLE,
    ageMs,
    maxAgeMs,
    fromCache,
    providerStatus = 'OK',
  } = input;

  // Quota protection is surfaced even when cached data can still be served:
  // the data is real but its updates are intentionally paused.
  if (providerStatus === 'QUOTA_EXHAUSTED' || providerStatus === 'QUOTA_INFRA_UNAVAILABLE') {
    return 'DATA_UPDATE_PAUSED';
  }

  if (!hasData) return 'DATA_UNAVAILABLE';
  if (providerStatus === 'PROVIDER_UNAVAILABLE') return 'STALE';

  if (sampleSize !== undefined && sampleSize < minSample) return 'INSUFFICIENT_DATA';

  if (ageMs !== undefined && maxAgeMs !== undefined && ageMs > maxAgeMs) return 'STALE';

  if (fromCache) return 'CACHED';

  return 'REAL';
}

/** Human-readable label for UI badges. */
export const DATA_STATE_LABEL: Record<DataState, string> = {
  REAL: 'REAL DATA',
  CACHED: 'CACHED',
  STALE: 'STALE',
  INSUFFICIENT_DATA: 'INSUFFICIENT DATA',
  DATA_UNAVAILABLE: 'DATA UNAVAILABLE',
  DATA_UPDATE_PAUSED: 'DATA UPDATE PAUSED',
};

/** Tailwind-ish tone tokens for consistent UI rendering. */
export const DATA_STATE_TONE: Record<DataState, 'positive' | 'neutral' | 'warning' | 'negative'> = {
  REAL: 'positive',
  CACHED: 'neutral',
  STALE: 'warning',
  INSUFFICIENT_DATA: 'warning',
  DATA_UNAVAILABLE: 'negative',
  DATA_UPDATE_PAUSED: 'warning',
};

export function isDisplayableDataState(state: DataState): boolean {
  return state !== 'DATA_UNAVAILABLE';
}
