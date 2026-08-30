// HandicapLab Real Fixture & Prediction Validation Gate (EPIC 61)
// Non-negotiable invariant: REAL DATA ONLY.
// Any fixture or prediction failing these checks is strictly rejected from public UI.

import { normalizeToCanonicalMarket, CanonicalMarket } from '../markets/marketRegistry';

export interface RawPredictionCandidate {
  id?: string;
  fixtureId?: string | number | null;
  providerFixtureId?: string | number | null;
  providerSource?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  kickoffTime?: string | Date | null;
  status?: string | null;
  market?: string | null;
  line?: number | null;
  odds?: number | null;
  fairProbability?: number | null;
  modelVersion?: string | null;
  isSynthetic?: boolean | null;
}

export type RejectionReason =
  | 'FIXTURE_ALREADY_PLAYED'
  | 'MOCK_OR_MISSING_PROVIDER_ID'
  | 'INVALID_OR_MISSING_KICKOFF'
  | 'INVALID_STATUS'
  | 'INVALID_MARKET'
  | 'MISSING_REAL_ODDS'
  | 'MISSING_TEAMS'
  | 'MISSING_MODEL_OUTPUT';

export interface ValidationResult {
  isValid: boolean;
  canonicalMarket?: CanonicalMarket;
  rejectionReason?: RejectionReason;
  details?: string;
}

/**
 * Validates a prediction candidate against all Stage C data quality gates.
 * Uses UTC-safe time comparisons and strict provider identity checks.
 */
export function validateUpcomingPrediction(
  candidate: RawPredictionCandidate,
  nowUtc: Date = new Date()
): ValidationResult {
  // 1. Check Market Type
  const canonicalMarket = normalizeToCanonicalMarket(candidate.market);
  if (!canonicalMarket) {
    const marketStr = candidate.market || 'UNKNOWN';
    console.warn(`[PREDICTION_REJECTED] reason=INVALID_MARKET market=${marketStr} fixtureId=${candidate.fixtureId}`);
    return {
      isValid: false,
      rejectionReason: 'INVALID_MARKET',
      details: `Market '${marketStr}' is unsupported or deprecated. Supported: AH, OU, BTTS.`,
    };
  }

  // 2. Check Provider Identity & Synthetic flags
  const rawId = String(candidate.providerFixtureId || candidate.fixtureId || '').trim();
  const isSynthetic =
    candidate.isSynthetic === true ||
    rawId.toLowerCase().startsWith('mock-') ||
    rawId.toLowerCase().startsWith('synth-') ||
    rawId.toLowerCase().startsWith('demo-') ||
    rawId === '' ||
    rawId === 'undefined' ||
    rawId === 'null';

  if (isSynthetic) {
    console.warn(`[PREDICTION_REJECTED] reason=MOCK_OR_MISSING_PROVIDER_ID fixtureId=${rawId}`);
    return {
      isValid: false,
      rejectionReason: 'MOCK_OR_MISSING_PROVIDER_ID',
      details: `Fixture '${rawId}' is synthetic, mock, or missing stable provider ID.`,
    };
  }

  // 3. Check Teams
  const home = (candidate.homeTeam || '').trim();
  const away = (candidate.awayTeam || '').trim();
  if (!home || !away || home.toLowerCase() === away.toLowerCase()) {
    console.warn(`[PREDICTION_REJECTED] reason=MISSING_TEAMS fixtureId=${rawId} home=${home} away=${away}`);
    return {
      isValid: false,
      rejectionReason: 'MISSING_TEAMS',
      details: 'Home team and away team names must be distinct, non-empty strings.',
    };
  }

  // 4. Check Kickoff Time (UTC-safe future comparison)
  if (!candidate.kickoffTime) {
    console.warn(`[PREDICTION_REJECTED] reason=INVALID_OR_MISSING_KICKOFF fixtureId=${rawId}`);
    return {
      isValid: false,
      rejectionReason: 'INVALID_OR_MISSING_KICKOFF',
      details: 'Kickoff timestamp is missing or null.',
    };
  }

  const kickoffDate = new Date(candidate.kickoffTime);
  if (isNaN(kickoffDate.getTime())) {
    console.warn(`[PREDICTION_REJECTED] reason=INVALID_OR_MISSING_KICKOFF fixtureId=${rawId} raw=${candidate.kickoffTime}`);
    return {
      isValid: false,
      rejectionReason: 'INVALID_OR_MISSING_KICKOFF',
      details: `Invalid date format: ${candidate.kickoffTime}`,
    };
  }

  if (kickoffDate.getTime() <= nowUtc.getTime()) {
    console.warn(
      `[PREDICTION_REJECTED] reason=FIXTURE_ALREADY_PLAYED fixtureId=${rawId} kickoff=${kickoffDate.toISOString()} now=${nowUtc.toISOString()}`
    );
    return {
      isValid: false,
      rejectionReason: 'FIXTURE_ALREADY_PLAYED',
      details: `Kickoff (${kickoffDate.toISOString()}) is in the past relative to current time (${nowUtc.toISOString()}).`,
    };
  }

  // 5. Check Fixture Status
  const status = (candidate.status || 'NS').trim().toUpperCase();
  const validUpcomingStatuses = ['NS', 'SCHEDULED', 'TIMED', 'NOT_STARTED', 'TBD'];
  const invalidStatuses = ['FT', 'AET', 'PEN', 'FINISHED', 'POSTPONED', 'CANC', 'CANCELLED', 'SUSP', 'INT', 'ABANDONED', 'ARCHIVED'];

  if (invalidStatuses.includes(status) || !validUpcomingStatuses.includes(status)) {
    console.warn(`[PREDICTION_REJECTED] reason=INVALID_STATUS fixtureId=${rawId} status=${status}`);
    return {
      isValid: false,
      rejectionReason: 'INVALID_STATUS',
      details: `Fixture status '${status}' does not indicate an active scheduled upcoming match.`,
    };
  }

  // 6. Check Odds / Probability sanity (No fabricated zero or NaN values)
  if (candidate.odds !== undefined && candidate.odds !== null) {
    if (isNaN(candidate.odds) || candidate.odds <= 1.0) {
      console.warn(`[PREDICTION_REJECTED] reason=MISSING_REAL_ODDS fixtureId=${rawId} odds=${candidate.odds}`);
      return {
        isValid: false,
        rejectionReason: 'MISSING_REAL_ODDS',
        details: `Odds value ${candidate.odds} is invalid or non-positive.`,
      };
    }
  }

  // Gate Passed!
  return {
    isValid: true,
    canonicalMarket,
  };
}
