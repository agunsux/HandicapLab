// EPIC 35 — Live Validation Platform — Configuration
// All thresholds are configurable (EPIC 35.7 requirement).
// Nothing here retrains or tunes models — thresholds only gate DETECTION.

export interface SchedulerConfig {
  /** How far ahead of kickoff fixtures are picked up (hours) */
  lookAheadHours: number;
  /** Minimum minutes before kickoff a prediction must exist */
  minLeadMinutes: number;
  /** Max attempts per fixture per run */
  maxRetries: number;
  /** Per-fixture timeout for prediction generation (ms) */
  timeoutMs: number;
}

export interface DriftThresholds {
  /** PSI >= warning → 'warning' severity */
  psiWarning: number;
  /** PSI >= critical → 'critical' severity */
  psiCritical: number;
  referenceWindowDays: number;
  currentWindowDays: number;
  /** Minimum samples per window before drift is evaluated */
  minSamples: number;
}

export interface AlertThresholds {
  /** Fire when 30d ROI drops below this value */
  minRoi30d: number;
  /** Fire when 30d average CLV is negative beyond this value */
  minClv30d: number;
  /** Fire when 30d ECE exceeds this value */
  maxEce30d: number;
  /** Fire when 30d Brier exceeds this value */
  maxBrier30d: number;
  /** Fire when 30d max drawdown (units) exceeds this value */
  maxDrawdown30d: number;
  /** Fire when daily prediction volume falls outside [min, max] */
  minDailyPredictions: number;
  maxDailyPredictions: number;
  /** Suppress a repeated rule for this many hours */
  cooldownHours: number;
}

export interface OddsTrackingConfig {
  /** Odds shortening ratio between phases considered a steam move */
  steamThreshold: number;
}

export interface LiveValidationConfig {
  scheduler: SchedulerConfig;
  drift: DriftThresholds;
  alerts: AlertThresholds;
  odds: OddsTrackingConfig;
  /** Flat stake per validated bet, in units */
  stakeUnits: number;
  /** Only recommendations with EV above this are treated as bets */
  minExpectedValue: number;
  /** Schema version stamped on every record */
  schemaVersion: string;
}

export const DEFAULT_LIVE_VALIDATION_CONFIG: LiveValidationConfig = {
  scheduler: {
    lookAheadHours: 24,
    minLeadMinutes: 30,
    maxRetries: 3,
    timeoutMs: 30_000,
  },
  drift: {
    psiWarning: 0.1,
    psiCritical: 0.25,
    referenceWindowDays: 60,
    currentWindowDays: 14,
    minSamples: 30,
  },
  alerts: {
    minRoi30d: -0.05,
    minClv30d: -0.01,
    maxEce30d: 0.06,
    maxBrier30d: 0.25,
    maxDrawdown30d: 15,
    minDailyPredictions: 1,
    maxDailyPredictions: 200,
    cooldownHours: 12,
  },
  odds: {
    steamThreshold: 0.05,
  },
  stakeUnits: 1,
  minExpectedValue: 0.02,
  schemaVersion: 'lv-1.0.0',
};

/** Merge a partial override onto the defaults (deep, one level per section). */
export function resolveConfig(partial?: Partial<LiveValidationConfig>): LiveValidationConfig {
  if (!partial) return DEFAULT_LIVE_VALIDATION_CONFIG;
  return {
    ...DEFAULT_LIVE_VALIDATION_CONFIG,
    ...partial,
    scheduler: { ...DEFAULT_LIVE_VALIDATION_CONFIG.scheduler, ...partial.scheduler },
    drift: { ...DEFAULT_LIVE_VALIDATION_CONFIG.drift, ...partial.drift },
    alerts: { ...DEFAULT_LIVE_VALIDATION_CONFIG.alerts, ...partial.alerts },
    odds: { ...DEFAULT_LIVE_VALIDATION_CONFIG.odds, ...partial.odds },
  };
}
