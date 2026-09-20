// ============================================================================
// DATA QUALITY, MODEL SAMPLE & MARKET GATES
// ============================================================================
// Location: src/lib/validation/multiLeagueGates.ts
//
// Authoritative multi-league qualification gates:
// 1. Data Quality Gate (fixtures, non-synthetic, team resolution)
// 2. Model Sample Gate (3+ matches history per team, fail-closed)
// 3. Market Gate (AH / OU / BTTS line availability, Pinnacle sharp reference)
// 4. Point-in-Time Temporal Invariant (oddsTimestamp <= predTimestamp < kickoff)
// ============================================================================

export interface TeamSampleInfo {
  teamName: string;
  matchesPlayed: number;
  hasSufficientSample: boolean;
}

export interface ModelSampleGateResult {
  passed: boolean;
  validationStatus: 'MODEL_VALID' | 'INSUFFICIENT_MODEL';
  verdict: 'ACTIONABLE' | 'LEWATI';
  actionable: boolean;
  edge: number;
  expectedValue: number;
  sampleSizeHome: number;
  sampleSizeAway: number;
  rejectionReason: string | null;
}

export interface DataQualityGateResult {
  passed: boolean;
  reasons: string[];
  canonicalIdGenerated: boolean;
  isSynthetic: boolean;
  hasKickoff: boolean;
  kickoffValid: boolean;
}

export interface MarketGateResult {
  passed: boolean;
  marketType: 'AH' | 'OU' | 'BTTS';
  hasPinnacleOdds: boolean;
  lineValid: boolean;
  oddsTimestampValid: boolean;
  rejectionReason: string | null;
}

export class MultiLeagueGates {
  /**
   * Evaluates fixture integrity against Data Quality rules.
   * Asserts ZERO synthetic fixtures, valid kickoff, and canonical identity generation.
   */
  public static evaluateDataQuality(fixture: {
    fixtureId?: string;
    providerFixtureId?: string;
    homeTeam?: string;
    awayTeam?: string;
    kickoffUtc?: string;
    competitionId?: number;
    season?: string;
  }): DataQualityGateResult {
    const reasons: string[] = [];

    if (!fixture.homeTeam || fixture.homeTeam.trim().length === 0) {
      reasons.push('MISSING_HOME_TEAM');
    }
    if (!fixture.awayTeam || fixture.awayTeam.trim().length === 0) {
      reasons.push('MISSING_AWAY_TEAM');
    }
    if (!fixture.kickoffUtc) {
      reasons.push('MISSING_KICKOFF');
    }

    let kickoffValid = false;
    if (fixture.kickoffUtc) {
      const ms = new Date(fixture.kickoffUtc).getTime();
      kickoffValid = !isNaN(ms) && ms > 0;
      if (!kickoffValid) reasons.push('INVALID_KICKOFF_TIMESTAMP');
    }

    const homeLower = (fixture.homeTeam || '').toLowerCase();
    const awayLower = (fixture.awayTeam || '').toLowerCase();
    const idLower = (fixture.fixtureId || '').toLowerCase();
    const isSynthetic =
      homeLower.includes('test_') ||
      awayLower.includes('test_') ||
      homeLower.includes('mock') ||
      awayLower.includes('mock') ||
      homeLower.includes('synthetic') ||
      awayLower.includes('synthetic') ||
      idLower.includes('synthetic') ||
      idLower.includes('dummy');

    if (isSynthetic) {
      reasons.push('SYNTHETIC_DATA_PROHIBITED');
    }

    const canonicalIdGenerated = Boolean(
      fixture.fixtureId && fixture.fixtureId.length >= 8
    );
    if (!canonicalIdGenerated) {
      reasons.push('CANONICAL_ID_MISSING');
    }

    return {
      passed: reasons.length === 0,
      reasons,
      canonicalIdGenerated,
      isSynthetic,
      hasKickoff: Boolean(fixture.kickoffUtc),
      kickoffValid,
    };
  }

  /**
   * Evaluates team sample sufficiency for fixture-specific model prediction.
   * Requires minimum 3 matches per team strictly prior to the prediction timestamp.
   * If insufficient, fails closed with INSUFFICIENT_MODEL / LEWATI / actionable=false.
   */
  public static evaluateModelSample(params: {
    homeMatchesPlayed: number;
    awayMatchesPlayed: number;
    homeTeam: string;
    awayTeam: string;
  }): ModelSampleGateResult {
    const { homeMatchesPlayed, awayMatchesPlayed, homeTeam, awayTeam } = params;

    const homeOk = homeMatchesPlayed >= 3;
    const awayOk = awayMatchesPlayed >= 3;

    if (!homeOk || !awayOk) {
      const reason = `INSUFFICIENT_MODEL: Home(${homeTeam})=${homeMatchesPlayed} matches, Away(${awayTeam})=${awayMatchesPlayed} matches (minimum 3 required).`;
      return {
        passed: false,
        validationStatus: 'INSUFFICIENT_MODEL',
        verdict: 'LEWATI',
        actionable: false,
        edge: 0,
        expectedValue: 0,
        sampleSizeHome: homeMatchesPlayed,
        sampleSizeAway: awayMatchesPlayed,
        rejectionReason: reason,
      };
    }

    return {
      passed: true,
      validationStatus: 'MODEL_VALID',
      verdict: 'ACTIONABLE',
      actionable: true,
      edge: 0, // Computed by ValueEngine upon Pinnacle odds arrival
      expectedValue: 0,
      sampleSizeHome: homeMatchesPlayed,
      sampleSizeAway: awayMatchesPlayed,
      rejectionReason: null,
    };
  }

  /**
   * Asserts Temporal Anti-Leakage Invariant:
   * oddsTimestamp <= predictionTimestamp < kickoffTimestamp
   */
  public static verifyPointInTimeInvariant(params: {
    kickoffUtc: string;
    predictionTimestampUtc: string;
    oddsTimestampUtc?: string;
  }): { valid: boolean; error?: string } {
    const tKick = new Date(params.kickoffUtc).getTime();
    const tPred = new Date(params.predictionTimestampUtc).getTime();

    if (isNaN(tKick) || isNaN(tPred)) {
      return { valid: false, error: 'INVALID_TIMESTAMPS' };
    }

    if (tPred >= tKick) {
      return {
        valid: false,
        error: `LOOK_AHEAD_LEAKAGE: prediction timestamp (${params.predictionTimestampUtc}) must be strictly before kickoff (${params.kickoffUtc})`,
      };
    }

    if (params.oddsTimestampUtc) {
      const tOdds = new Date(params.oddsTimestampUtc).getTime();
      if (!isNaN(tOdds) && tOdds > tPred) {
        return {
          valid: false,
          error: `LOOK_AHEAD_LEAKAGE: odds timestamp (${params.oddsTimestampUtc}) cannot be after prediction timestamp (${params.predictionTimestampUtc})`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Evaluates supported market lines (AH, OU, BTTS only).
   * Moneyline (1X2) is rejected by design.
   */
  public static evaluateMarketSupport(params: {
    marketType: 'AH' | 'OU' | 'BTTS' | '1X2' | 'MONEYLINE';
    line?: number;
    homeOdds?: number;
    awayOdds?: number;
    overOdds?: number;
    underOdds?: number;
    yesOdds?: number;
    noOdds?: number;
    isPinnacle?: boolean;
  }): MarketGateResult {
    const { marketType, isPinnacle = true } = params;

    // Disallow Moneyline recommendations
    if (marketType === '1X2' || marketType === 'MONEYLINE') {
      return {
        passed: false,
        marketType: 'AH',
        hasPinnacleOdds: false,
        lineValid: false,
        oddsTimestampValid: false,
        rejectionReason: 'MONEYLINE_UNSUPPORTED: Product policy restricts recommendations strictly to AH, OU, BTTS.',
      };
    }

    if (!isPinnacle) {
      const targetMarket: 'AH' | 'OU' | 'BTTS' = marketType === 'OU' ? 'OU' : marketType === 'BTTS' ? 'BTTS' : 'AH';
      return {
        passed: false,
        marketType: targetMarket,
        hasPinnacleOdds: false,
        lineValid: false,
        oddsTimestampValid: false,
        rejectionReason: 'PINNACLE_UNAVAILABLE: Model requires sharp Pinnacle prices as reference market.',
      };
    }

    if (marketType === 'AH') {
      const validOdds = Boolean(params.homeOdds && params.awayOdds && params.homeOdds > 1.0 && params.awayOdds > 1.0);
      const lineValid = typeof params.line === 'number';
      return {
        passed: validOdds && lineValid,
        marketType: 'AH',
        hasPinnacleOdds: validOdds,
        lineValid,
        oddsTimestampValid: true,
        rejectionReason: validOdds && lineValid ? null : 'INVALID_AH_MARKET_LINES',
      };
    }

    if (marketType === 'OU') {
      const validOdds = Boolean(params.overOdds && params.underOdds && params.overOdds > 1.0 && params.underOdds > 1.0);
      const lineValid = typeof params.line === 'number' && params.line > 0;
      return {
        passed: validOdds && lineValid,
        marketType: 'OU',
        hasPinnacleOdds: validOdds,
        lineValid,
        oddsTimestampValid: true,
        rejectionReason: validOdds && lineValid ? null : 'INVALID_OU_MARKET_LINES',
      };
    }

    if (marketType === 'BTTS') {
      const validOdds = Boolean(params.yesOdds && params.noOdds && params.yesOdds > 1.0 && params.noOdds > 1.0);
      return {
        passed: validOdds,
        marketType: 'BTTS',
        hasPinnacleOdds: validOdds,
        lineValid: true,
        oddsTimestampValid: true,
        rejectionReason: validOdds ? null : 'INVALID_BTTS_MARKET_LINES',
      };
    }

    return {
      passed: false,
      marketType: 'AH',
      hasPinnacleOdds: false,
      lineValid: false,
      oddsTimestampValid: false,
      rejectionReason: 'UNKNOWN_MARKET_TYPE',
    };
  }
}

