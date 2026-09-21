// ============================================================================
// PRODUCTION VALIDITY GATE (SEPARATE FROM SIGNAL STRENGTH)
// ============================================================================
// Location: src/lib/publishing/productionValidityGate.ts
//
// Invariant:
// VALID determines technical and operational publish eligibility:
//   VALID =
//     canonical fixture valid
//     AND supported league state (ACTIVE only)
//     AND real fixture data (no synthetic/mock)
//     AND real odds snapshot
//     AND odds fresh (<= 24h)
//     AND supported market (AH, OU, BTTS)
//     AND production model (sample >= 3 matches/team)
//     AND prediction provenance exists
//     AND prediction timestamp exists
//     AND no mock/synthetic data
//     AND contamination gate passed
//     AND provider/quota gate passed
//
// If ANY check fails: HELD / SHADOW / INVALID. Never publish.
// ============================================================================

import { getLeagueByKey, getLeagueByAfId } from '@/lib/config/multiLeagueRegistry';
import { CanonicalMarket } from '@/lib/daily-picks/types';
import { PublishState } from './types';

export interface ProductionValidityInput {
  canonicalMatchId: string;
  fixtureId: string;
  providerFixtureId?: string;
  homeTeam: string;
  awayTeam: string;
  leagueKey: string;
  leagueId?: number;
  competition?: string;
  kickoffUtc: string;
  market: string;
  selection: string;
  line?: number | null;
  marketOdds?: number;
  modelProbability?: number;
  fairOdds?: number;
  confidence?: number;
  oddsTimestampUtc?: string;
  predictionTimestampUtc?: string;
  modelVersion?: string;
  providerSources?: {
    fixtures?: string;
    odds?: string;
    statistics?: string;
  };
  sampleSizeHome?: number;
  sampleSizeAway?: number;
  quotaAllowed?: boolean;
}

export interface ProductionValidityResult {
  isValid: boolean;
  state: PublishState;
  validityStatus: 'VALID' | 'SHADOW' | 'HELD' | 'STALE' | 'INVALID';
  rejectionReason: string | null;
  checks: {
    canonicalFixtureValid: boolean;
    supportedLeagueState: boolean;
    realFixtureData: boolean;
    realOddsSnapshot: boolean;
    oddsFresh: boolean;
    supportedMarket: boolean;
    productionModel: boolean;
    provenanceExists: boolean;
    temporalAntiLeakagePassed: boolean;
    horizonValid: boolean;
    contaminationGatePassed: boolean;
    quotaGatePassed: boolean;
  };
}

export class ProductionValidityGate {
  private static readonly MAX_ODDS_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours max odds age
  private static readonly MAX_HORIZON_DAYS_MS = 21 * 24 * 60 * 60 * 1000; // 21 days ahead (calendar-aware for international breaks)

  /**
   * Evaluates end-to-end production validity.
   */
  public static evaluate(input: ProductionValidityInput): ProductionValidityResult {
    const nowMs = Date.now();
    const reasons: string[] = [];

    // 1. Canonical fixture check
    const canonicalFixtureValid = Boolean(
      input.canonicalMatchId &&
      input.canonicalMatchId.length >= 8 &&
      input.fixtureId &&
      input.homeTeam?.trim().length > 0 &&
      input.awayTeam?.trim().length > 0
    );
    if (!canonicalFixtureValid) reasons.push('CANONICAL_FIXTURE_INVALID');

    // 2. League Production Status (ACTIVE only can publish; SHADOW holds)
    const league = getLeagueByKey(input.leagueKey) || (input.leagueId ? getLeagueByAfId(input.leagueId) : null);
    const isLeagueActive = league?.production_status === 'ACTIVE';
    const isLeagueShadow = league?.production_status === 'SHADOW';
    if (!isLeagueActive) {
      if (isLeagueShadow) {
        reasons.push(`SHADOW_LEAGUE: League ${input.leagueKey} is held in SHADOW mode (reason: ${league?.non_active_reason})`);
      } else {
        reasons.push(`UNSUPPORTED_LEAGUE: League ${input.leagueKey} has status ${league?.production_status || 'UNKNOWN'}`);
      }
    }

    // 3. Real Fixture Data & Contamination Protection (no synthetic/mock)
    const homeLower = (input.homeTeam || '').toLowerCase();
    const awayLower = (input.awayTeam || '').toLowerCase();
    const fixtureLower = (input.fixtureId || '').toLowerCase();
    const isSynthetic =
      homeLower.includes('test_') ||
      awayLower.includes('test_') ||
      homeLower.includes('mock') ||
      awayLower.includes('mock') ||
      homeLower.includes('synthetic') ||
      awayLower.includes('synthetic') ||
      fixtureLower.includes('synthetic') ||
      fixtureLower.includes('dummy');

    const realFixtureData = !isSynthetic;
    const contaminationGatePassed = !isSynthetic;
    if (isSynthetic) reasons.push('SYNTHETIC_DATA_PROHIBITED');

    // 4. Real Odds Snapshot
    const realOddsSnapshot = Boolean(
      typeof input.marketOdds === 'number' &&
      input.marketOdds > 1.0 &&
      input.marketOdds < 100.0 &&
      input.oddsTimestampUtc
    );
    if (!realOddsSnapshot) reasons.push('REAL_ODDS_SNAPSHOT_MISSING');

    // 5. Odds Freshness (<= 24h old and before kickoff)
    let oddsFresh = false;
    if (input.oddsTimestampUtc) {
      const oddsMs = new Date(input.oddsTimestampUtc).getTime();
      const ageMs = nowMs - oddsMs;
      oddsFresh = !isNaN(oddsMs) && ageMs >= 0 && ageMs <= this.MAX_ODDS_AGE_MS;
      if (!oddsFresh) reasons.push('STALE_ODDS: Odds snapshot older than 24 hours or in future');
    }

    // 6. Supported Market (strictly AH, OU, ML, BTTS)
    const upperMarket = (input.market || '').toUpperCase();
    const isForbiddenMoneyline = upperMarket === '1X2' || upperMarket === 'MONEYLINE';
    const supportedMarket = ['AH', 'OU', 'ML', 'BTTS'].includes(upperMarket) && !isForbiddenMoneyline;
    if (isForbiddenMoneyline) {
      reasons.push('MONEYLINE_UNSUPPORTED: Ambiguous 1X2 / MONEYLINE format is rejected. Use explicit schema ML with line: null.');
    } else if (!supportedMarket) {
      reasons.push(`UNSUPPORTED_MARKET: ${input.market} is not a production market`);
    }

    // 7. Production Model Engine & Sample History (>= 3 matches per team)
    const homeSample = input.sampleSizeHome ?? 0;
    const awaySample = input.sampleSizeAway ?? 0;
    const productionModel = homeSample >= 3 && awaySample >= 3;
    if (!productionModel) {
      reasons.push(`INSUFFICIENT_MODEL: Home sample=${homeSample}, Away sample=${awaySample} (minimum 3 required)`);
    }

    // 8. Prediction Provenance
    const provenanceExists = Boolean(
      input.predictionTimestampUtc &&
      input.modelVersion &&
      input.providerSources?.fixtures &&
      input.providerSources?.odds
    );
    if (!provenanceExists) reasons.push('PREDICTION_PROVENANCE_MISSING');

    // 9. Temporal Anti-Leakage Invariant: oddsTime <= predTime < kickTime
    let temporalAntiLeakagePassed = false;
    if (input.kickoffUtc && input.predictionTimestampUtc) {
      const kickMs = new Date(input.kickoffUtc).getTime();
      const predMs = new Date(input.predictionTimestampUtc).getTime();
      const oddsMs = input.oddsTimestampUtc ? new Date(input.oddsTimestampUtc).getTime() : 0;

      if (!isNaN(kickMs) && !isNaN(predMs)) {
        const predBeforeKick = predMs < kickMs;
        const oddsBeforePred = !input.oddsTimestampUtc || (oddsMs <= predMs);
        temporalAntiLeakagePassed = predBeforeKick && oddsBeforePred;
        if (!predBeforeKick) reasons.push('TEMPORAL_LEAKAGE: Prediction timestamp is at or after kickoff');
        if (!oddsBeforePred) reasons.push('TEMPORAL_LEAKAGE: Odds timestamp is after prediction timestamp');
      }
    }

    // 10. Horizon Validity: now < kickoff <= now + 7 days
    let horizonValid = false;
    if (input.kickoffUtc) {
      const kickMs = new Date(input.kickoffUtc).getTime();
      const diffToKick = kickMs - nowMs;
      horizonValid = diffToKick > 0 && diffToKick <= this.MAX_HORIZON_DAYS_MS;
      if (diffToKick <= 0) reasons.push('FIXTURE_PAST_KICKOFF');
      else if (diffToKick > this.MAX_HORIZON_DAYS_MS) reasons.push('OUTSIDE_HORIZON');
    }

    // 11. Quota Gate
    const quotaGatePassed = input.quotaAllowed !== false;
    if (!quotaGatePassed) reasons.push('QUOTA_LIMIT_EXCEEDED');

    // Synthesis of publish state
    const allChecksPass =
      canonicalFixtureValid &&
      isLeagueActive &&
      realFixtureData &&
      realOddsSnapshot &&
      oddsFresh &&
      supportedMarket &&
      productionModel &&
      provenanceExists &&
      temporalAntiLeakagePassed &&
      horizonValid &&
      contaminationGatePassed &&
      quotaGatePassed;

    let state: PublishState;
    let validityStatus: 'VALID' | 'SHADOW' | 'HELD' | 'STALE' | 'INVALID';

    if (allChecksPass) {
      state = 'VALID';
      validityStatus = 'VALID';
    } else if (isLeagueShadow) {
      state = 'SHADOW';
      validityStatus = 'SHADOW';
    } else if (!oddsFresh) {
      state = 'STALE';
      validityStatus = 'STALE';
    } else if (isSynthetic || !supportedMarket || isForbiddenMoneyline) {
      state = 'INVALID';
      validityStatus = 'INVALID';
    } else {
      state = 'HELD';
      validityStatus = 'HELD';
    }

    return {
      isValid: allChecksPass,
      state,
      validityStatus,
      rejectionReason: reasons.length > 0 ? reasons.join('; ') : null,
      checks: {
        canonicalFixtureValid,
        supportedLeagueState: isLeagueActive,
        realFixtureData,
        realOddsSnapshot,
        oddsFresh,
        supportedMarket,
        productionModel,
        provenanceExists,
        temporalAntiLeakagePassed,
        horizonValid,
        contaminationGatePassed,
        quotaGatePassed,
      },
    };
  }
}
