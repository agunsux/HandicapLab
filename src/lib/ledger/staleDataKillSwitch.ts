// ============================================================================
// STALE DATA KILL SWITCH & FRESHNESS GATE
// ============================================================================
// Location: src/lib/ledger/staleDataKillSwitch.ts
//
// Invariants enforced (Section C & J):
// 1. Kickoff gate: Any match where kickoffUtc <= nowUtc MUST NEVER appear as an
//    active or upcoming Daily Pick.
// 2. Anti-lookahead temporal check: predictionTimestampUtc < kickoffUtc strictly.
//    Any prediction created after kickoff is rejected with TEMPORAL_LEAKAGE_VIOLATION.
// 3. Real odds check: Odds <= 1.0 or NaN rejected with INVALID_ODDS.
// 4. Synthetic/Mock provider check: Providers/bookmakers matching 'synthetic' or
//    'mock' rejected with SYNTHETIC_ODDS_REJECTED.
// 5. Postponed/Cancelled matches removed or marked appropriately.
// ============================================================================

export interface ActiveFeedEligibilityResult {
  isActive: boolean;
  state: 'ACTIVE' | 'SETTLEMENT_PENDING' | 'POSTPONED' | 'CANCELLED' | 'ABANDONED' | 'REJECTED' | 'SETTLED' | 'STALE' | string;
  reason?: string;
}

export class StaleDataKillSwitch {
  public static readonly ALLOWED_ACTIVE_STATUSES = [
    'QUALIFIED',
    'PUBLISHED',
    'ACTIVE',
    'POTENTIAL_WINNING_BET',
    'PENDING',
  ];

  /**
   * Evaluates whether a prediction is eligible to be presented on the active
   * Daily Picks surface at reference time `nowMs`.
   */
  public static evaluateActiveFeedEligibility(
    prediction: any,
    nowMs: number = Date.now()
  ): ActiveFeedEligibilityResult {
    if (!prediction) {
      return {
        isActive: false,
        state: 'REJECTED',
        reason: 'NULL_OR_UNDEFINED_PREDICTION',
      };
    }

    const kickoffStr = prediction.kickoffUtc || prediction.kickoffTimestamp;
    const predStr = prediction.predictionTimestampUtc || prediction.predictionTimestamp;

    if (!kickoffStr) {
      return {
        isActive: false,
        state: 'REJECTED',
        reason: 'MISSING_KICKOFF_TIMESTAMP',
      };
    }

    const kickMs = new Date(kickoffStr).getTime();
    if (isNaN(kickMs)) {
      return {
        isActive: false,
        state: 'REJECTED',
        reason: 'INVALID_KICKOFF_TIMESTAMP',
      };
    }

    // 1. Temporal Leakage Gate (Anti-Lookahead)
    if (predStr) {
      const predMs = new Date(predStr).getTime();
      if (!isNaN(predMs) && predMs >= kickMs) {
        return {
          isActive: false,
          state: 'REJECTED',
          reason: 'TEMPORAL_LEAKAGE_VIOLATION: prediction created at or after kickoff',
        };
      }
    }

    // 2. Real Odds Gate
    const odds = prediction.marketOdds ?? prediction.odds;
    if (odds === undefined || odds === null || isNaN(Number(odds)) || Number(odds) <= 1.0) {
      return {
        isActive: false,
        state: 'REJECTED',
        reason: 'INVALID_ODDS: market odds must be strictly greater than 1.0',
      };
    }

    // 3. Synthetic/Mock Odds Rejection Gate
    const provider = (prediction.oddsProvider || prediction.provider || '').toLowerCase();
    const bookmaker = (prediction.bookmaker || '').toLowerCase();
    if (
      provider.includes('synthetic') ||
      provider.includes('mock') ||
      bookmaker.includes('synthetic') ||
      bookmaker.includes('mock')
    ) {
      return {
        isActive: false,
        state: 'REJECTED',
        reason: 'SYNTHETIC_ODDS_REJECTED: synthetic or mock odds provider not allowed in production',
      };
    }

    // 4. Fixture Lifecycle State Gate
    const fixtureStatus = (prediction.fixtureStatus || '').toUpperCase().trim();
    if (fixtureStatus === 'POSTPONED' || fixtureStatus === 'PST') {
      return {
        isActive: false,
        state: 'POSTPONED',
        reason: 'FIXTURE_POSTPONED: match postponed',
      };
    }
    if (fixtureStatus === 'CANCELLED' || fixtureStatus === 'CANC') {
      return {
        isActive: false,
        state: 'CANCELLED',
        reason: 'FIXTURE_CANCELLED: match cancelled',
      };
    }
    if (fixtureStatus === 'ABANDONED' || fixtureStatus === 'ABD') {
      return {
        isActive: false,
        state: 'ABANDONED',
        reason: 'FIXTURE_ABANDONED: match abandoned',
      };
    }

    // 5. Prediction Status Gate
    const status = (prediction.status || '').toUpperCase().trim();
    if (status === 'REJECTED' || status === 'VOID' || status === 'CANCELLED') {
      return {
        isActive: false,
        state: status,
        reason: `PREDICTION_STATUS_${status}`,
      };
    }
    if (status === 'SETTLED') {
      return {
        isActive: false,
        state: 'SETTLED',
        reason: 'PREDICTION_ALREADY_SETTLED',
      };
    }
    if (status && !this.ALLOWED_ACTIVE_STATUSES.includes(status)) {
      return {
        isActive: false,
        state: status,
        reason: `INELIGIBLE_STATUS: ${status}`,
      };
    }

    // 6. Hard Kickoff Passed Kill Switch (Section C)
    if (kickMs <= nowMs) {
      return {
        isActive: false,
        state: 'SETTLEMENT_PENDING',
        reason: 'KICKOFF_PASSED: match has kicked off; moved to settlement pending',
      };
    }

    // 7. Freshness SLA Gate
    if (
      prediction.freshnessAgeSeconds !== undefined &&
      prediction.freshnessSlaSeconds !== undefined &&
      prediction.freshnessAgeSeconds > prediction.freshnessSlaSeconds
    ) {
      return {
        isActive: false,
        state: 'STALE',
        reason: 'FIXTURE_STALE_EXCEEDED_SLA',
      };
    }

    return {
      isActive: true,
      state: 'ACTIVE',
    };
  }

  /**
   * Convenience helper to filter an array of predictions down to only those
   * that pass all active feed eligibility gates.
   */
  public static filterActiveDailyPicks<T extends Record<string, any>>(
    predictions: T[],
    nowMs: number = Date.now()
  ): T[] {
    return predictions.filter((pred) => this.evaluateActiveFeedEligibility(pred, nowMs).isActive);
  }
}
