// ============================================================================
// CANONICAL PROVIDER QUOTA POLICY
// ============================================================================
// Single source of truth for provider quota limits and priority gating.
//
// Contract:
//   - hardLimit  = provider contractual ceiling. Never exceed.
//   - softLimit  = application operating ceiling. At/above this only
//                  prediction-critical (P0) work may continue.
//
// API-Football Custom1500 : hard 1,500,000/day | soft 1,350,000/day
// OddsPapi          : hard       250/month | soft       200/month
//   (/v4/historical-odds and /v4/account are unmetered — see UNMETERED_ENDPOINTS)
//
// The soft limit is application policy; the hard limit is the provider contract.
// Every enforcement point (gateway, native client, request counter, scheduler)
// must route through this module.

export type Provider = 'apifootball' | 'oddspapi' | 'thestatsapi';
export type QuotaPeriodType = 'DAILY' | 'MONTHLY';

/**
 * Pressure modes used for priority gating.
 * QUOTA_EXHAUSTED means the hard limit has been reached.
 */
export type QuotaMode = 'NORMAL' | 'ECONOMY' | 'CRITICAL' | 'QUOTA_EXHAUSTED';

/** Operator-facing status labels (Epic §8, §11, §3). */
export type QuotaStatusLabel =
  | 'NORMAL'
  | 'ECONOMY'
  | 'CRITICAL'
  | 'QUOTA_EXHAUSTED'
  | 'ODDS_QUOTA_PROTECTION'
  | 'ODDS_QUOTA_EXHAUSTED'
  | 'DATA_UPDATE_PAUSED';

export interface ProviderQuotaPolicy {
  provider: Provider;
  period: QuotaPeriodType;
  /** Provider contractual ceiling. */
  hardLimit: number;
  /** Internal application operating ceiling (<= hardLimit). */
  softLimit: number;
  /** Percentage of the soft limit where ECONOMY rationing begins. */
  economyAtPctOfSoft: number;
}

/**
 * Priority bands (Epic §8, §36):
 *   P0 prediction-critical : settlement, prediction generation  (>= 90)
 *   P1 homepage / snapshots : T-60 snapshots, homepage freshness (>= 70)
 *   P2 historical enrichment: discovery, historical ingestion    (>= 40)
 *   P3 non-essential metadata: league evolution, metrics          (< 40)
 */
export const QUOTA_PRIORITY = {
  P0_SETTLEMENT: 100,
  P0_PREDICTION: 90,
  P1_SNAPSHOT: 80,
  P1_HOMEPAGE: 70,
  P2_DISCOVERY: 60,
  P2_HISTORICAL: 40,
  P3_LEAGUE_EVOLUTION: 20,
  P3_METRICS: 10,
} as const;

/** Minimum priority allowed per mode. */
export const MODE_MIN_PRIORITY: Record<QuotaMode, number> = {
  NORMAL: 0,
  ECONOMY: 40, // reject P3
  CRITICAL: 90, // only P0
  QUOTA_EXHAUSTED: Number.POSITIVE_INFINITY,
};

/**
 * Endpoints that do not consume the provider's metered allowance.
 * OddsPapi documents /v4/historical-odds and /v4/account as unmetered.
 */
export const UNMETERED_ENDPOINTS: Record<Provider, readonly string[]> = {
  apifootball: [],
  oddspapi: ['historical-odds', 'account'],
  thestatsapi: [],
};

export function isUnmeteredEndpoint(provider: Provider, endpoint: string): boolean {
  const normalized = endpoint.replace(/^\/+/, '').replace(/^v4\//, '');
  return UNMETERED_ENDPOINTS[provider].includes(normalized);
}

function envInt(names: string[]): number | undefined {
  for (const name of names) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') continue;
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

// Current production contract for the single authorized API-Football account.
// Pro plan ($19/month) = 7,500 requests/day (hard), internal operating ceiling
// 6,000/day (soft). This is the ONLY plan HandicapLab is authorized to use.
export const PRO_DAILY_HARD_LIMIT = 7500;
export const PRO_DAILY_SOFT_LIMIT = 6000;
export const PRO_SAFETY_RESERVE = PRO_DAILY_HARD_LIMIT - PRO_DAILY_SOFT_LIMIT;

// @deprecated Legacy plan constants retained for backward-compatible imports.
// They are NOT the default. Do not reintroduce the Custom1500 plan as a default.
export const CUSTOM1500_DAILY_HARD_LIMIT = 1500000;
export const CUSTOM1500_DAILY_SOFT_LIMIT = 1350000;
export const CUSTOM1500_SAFETY_RESERVE = 150000;

const DEFAULT_POLICIES: Record<Provider, Omit<ProviderQuotaPolicy, 'provider'>> = {
  apifootball: {
    period: 'DAILY',
    hardLimit: PRO_DAILY_HARD_LIMIT,
    softLimit: PRO_DAILY_SOFT_LIMIT,
    economyAtPctOfSoft: 80,
  },
  oddspapi: {
    period: 'MONTHLY',
    hardLimit: 250,
    softLimit: 200,
    economyAtPctOfSoft: 80,
  },
  thestatsapi: {
    period: 'DAILY',
    hardLimit: 1000,
    softLimit: 800,
    economyAtPctOfSoft: 80,
  },
};

const ENV_KEYS: Record<Provider, { hard: string[]; soft: string[] }> = {
  apifootball: {
    hard: ['API_FOOTBALL_DAILY_HARD_LIMIT', 'QUOTA_APIFOOTBALL_DAILY'],
    soft: ['API_FOOTBALL_DAILY_SOFT_LIMIT', 'API_FOOTBALL_OPERATIONAL_BUDGET'],
  },
  oddspapi: {
    hard: ['ODDSPAPI_HARD_LIMIT', 'QUOTA_ODDSPAPI_MONTHLY'],
    soft: ['ODDSPAPI_SOFT_LIMIT'],
  },
  thestatsapi: {
    hard: ['THESTATSAPI_DAILY_HARD_LIMIT', 'QUOTA_THESTATSAPI_DAILY'],
    soft: ['THESTATSAPI_DAILY_SOFT_LIMIT'],
  },
};

export function getProviderQuotaPolicy(provider: Provider): ProviderQuotaPolicy {
  const defaults = DEFAULT_POLICIES[provider];
  const envKeys = ENV_KEYS[provider];

  const hardLimit = envInt(envKeys.hard) ?? defaults.hardLimit;
  const rawSoft = envInt(envKeys.soft) ?? defaults.softLimit;
  const softLimit = Math.min(rawSoft, hardLimit);

  return {
    provider,
    period: defaults.period,
    hardLimit,
    softLimit,
    economyAtPctOfSoft: defaults.economyAtPctOfSoft,
  };
}

export interface QuotaPressure {
  mode: QuotaMode;
  /** Consumed+reserved as a percentage of the hard limit. */
  pctOfHard: number;
  /** Consumed+reserved as a percentage of the soft limit. */
  pctOfSoft: number;
  hardRemaining: number;
  softRemaining: number;
  /** True when the hard limit has been reached. */
  exhausted: boolean;
}

export function evaluateQuotaPressure(
  policy: ProviderQuotaPolicy,
  used: number,
  reserved = 0
): QuotaPressure {
  const allocated = Math.max(0, used) + Math.max(0, reserved);
  const pctOfHard = policy.hardLimit > 0 ? (allocated / policy.hardLimit) * 100 : 0;
  const pctOfSoft = policy.softLimit > 0 ? (allocated / policy.softLimit) * 100 : 0;

  let mode: QuotaMode = 'NORMAL';
  if (allocated >= policy.hardLimit) mode = 'QUOTA_EXHAUSTED';
  else if (allocated >= policy.softLimit) mode = 'CRITICAL';
  else if (pctOfSoft >= policy.economyAtPctOfSoft) mode = 'ECONOMY';

  return {
    mode,
    pctOfHard: round2(pctOfHard),
    pctOfSoft: round2(pctOfSoft),
    hardRemaining: Math.max(0, policy.hardLimit - allocated),
    softRemaining: Math.max(0, policy.softLimit - allocated),
    exhausted: allocated >= policy.hardLimit,
  };
}

export function isPriorityAllowed(mode: QuotaMode, priority: number): boolean {
  if (mode === 'QUOTA_EXHAUSTED') return false;
  return priority >= MODE_MIN_PRIORITY[mode];
}

/** Operator-facing label for a provider + mode pair. */
export function quotaStatusLabel(provider: Provider, mode: QuotaMode): QuotaStatusLabel {
  if (provider === 'oddspapi') {
    if (mode === 'QUOTA_EXHAUSTED') return 'ODDS_QUOTA_EXHAUSTED';
    if (mode === 'CRITICAL') return 'ODDS_QUOTA_PROTECTION';
    return mode;
  }
  return mode;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
