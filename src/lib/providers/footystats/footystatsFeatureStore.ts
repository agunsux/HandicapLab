// ============================================================================
// FOOTYSTATS FEATURE STORE & TEMPORAL INTEGRITY GATE
// ============================================================================
// Location: src/lib/providers/footystats/footystatsFeatureStore.ts
//
// Invariants enforced (Section 6 & 7):
// 1. Feature namespace: `footystats_features`.
// 2. Strict point-in-time bifurcation: Pre-match indicators vs Post-match ground truth.
// 3. Temporal Integrity Gate: featureAsOfUtc <= predictionTimestampUtc strictly.
// 4. Any feature derived after kickoff or using full-season post-match aggregates
//    is flagged with TEMPORAL_LEAKAGE_VIOLATION and excluded from backtesting/modeling.
// 5. Complete provenance hash and retrievedAt timestamp on every feature vector.
// ============================================================================

import crypto from 'crypto';

export interface FootyStatsPreMatchFeatures {
  provider: 'FOOTYSTATS';
  match_id: number;
  canonical_match_id?: string;
  competition_id: number | string;
  season_id: string;
  kickoff_utc: string;
  retrieved_at_utc: string;
  source_endpoint: string;
  raw_record_hash: string;

  // Point-in-time pre-match features (leakage-safe)
  pre_match_home_ppg: number | null;
  pre_match_away_ppg: number | null;
  pre_match_team_a_overall_ppg: number | null;
  pre_match_team_b_overall_ppg: number | null;
  team_a_xg_prematch: number | null;
  team_b_xg_prematch: number | null;
  total_xg_prematch: number | null;
  btts_potential: number | null;
  avg_potential: number | null;
  o15_potential: number | null;
  o25_potential: number | null;
  o35_potential: number | null;
  o45_potential: number | null;
  u15_potential: number | null;
  u25_potential: number | null;
  u35_potential: number | null;
  u45_potential: number | null;
}

export interface FootyStatsPostMatchActuals {
  provider: 'FOOTYSTATS';
  match_id: number;
  home_goals: number | null;
  away_goals: number | null;
  total_goals: number | null;
  btts_actual: boolean | null;
  team_a_shots: number | null;
  team_b_shots: number | null;
  team_a_shots_on_target: number | null;
  team_b_shots_on_target: number | null;
  team_a_possession: number | null;
  team_b_possession: number | null;
  team_a_corners: number | null;
  team_b_corners: number | null;
  team_a_xg_postmatch: number | null;
  team_b_xg_postmatch: number | null;
}

export interface TemporalValidationResult {
  isValid: boolean;
  code: 'VALID' | 'TEMPORAL_LEAKAGE_VIOLATION';
  message: string;
  featureAsOfUtc: string;
  predictionTimestampUtc: string;
}

export class FootyStatsFeatureStore {
  /**
   * Extracts point-in-time pre-match features from a raw FootyStats match record.
   */
  public static extractPreMatchFeatures(rawMatch: any): FootyStatsPreMatchFeatures {
    const matchId = Number(rawMatch.id);
    const kickoffMs = Number(rawMatch.date_unix) * 1000;
    const kickoffUtc = new Date(kickoffMs).toISOString();
    const retrievedAtUtc = new Date().toISOString();
    const sourceEndpoint = '/league-matches';

    const parseNum = (v: any): number | null => {
      if (v === undefined || v === null || v === '' || isNaN(Number(v))) return null;
      return Number(v);
    };

    const rawPayload = JSON.stringify({
      id: rawMatch.id,
      date_unix: rawMatch.date_unix,
      pre_match_home_ppg: rawMatch.pre_match_home_ppg,
      pre_match_away_ppg: rawMatch.pre_match_away_ppg,
      team_a_xg_prematch: rawMatch.team_a_xg_prematch,
      team_b_xg_prematch: rawMatch.team_b_xg_prematch,
      btts_potential: rawMatch.btts_potential,
      o25_potential: rawMatch.o25_potential,
    });
    const rawRecordHash = crypto.createHash('sha256').update(rawPayload).digest('hex');

    return {
      provider: 'FOOTYSTATS',
      match_id: matchId,
      competition_id: rawMatch.competition_id ?? rawMatch.competition_name ?? 'UNKNOWN',
      season_id: String(rawMatch.season ?? 'UNKNOWN'),
      kickoff_utc: kickoffUtc,
      retrieved_at_utc: retrievedAtUtc,
      source_endpoint: sourceEndpoint,
      raw_record_hash: rawRecordHash,

      pre_match_home_ppg: parseNum(rawMatch.pre_match_home_ppg),
      pre_match_away_ppg: parseNum(rawMatch.pre_match_away_ppg),
      pre_match_team_a_overall_ppg: parseNum(rawMatch.pre_match_teamA_overall_ppg),
      pre_match_team_b_overall_ppg: parseNum(rawMatch.pre_match_teamB_overall_ppg),
      team_a_xg_prematch: parseNum(rawMatch.team_a_xg_prematch),
      team_b_xg_prematch: parseNum(rawMatch.team_b_xg_prematch),
      total_xg_prematch: parseNum(rawMatch.total_xg_prematch),
      btts_potential: parseNum(rawMatch.btts_potential),
      avg_potential: parseNum(rawMatch.avg_potential),
      o15_potential: parseNum(rawMatch.o15_potential),
      o25_potential: parseNum(rawMatch.o25_potential),
      o35_potential: parseNum(rawMatch.o35_potential),
      o45_potential: parseNum(rawMatch.o45_potential),
      u15_potential: parseNum(rawMatch.u15_potential),
      u25_potential: parseNum(rawMatch.u25_potential),
      u35_potential: parseNum(rawMatch.u35_potential),
      u45_potential: parseNum(rawMatch.u45_potential),
    };
  }

  /**
   * Extracts post-match ground truth and actual stats for target settlement and evaluation.
   */
  public static extractPostMatchActuals(rawMatch: any): FootyStatsPostMatchActuals {
    const parseNum = (v: any): number | null => {
      if (v === undefined || v === null || v === '' || isNaN(Number(v))) return null;
      return Number(v);
    };

    const hGoals = parseNum(rawMatch.homeGoalCount);
    const aGoals = parseNum(rawMatch.awayGoalCount);
    const btts = (hGoals !== null && aGoals !== null) ? (hGoals > 0 && aGoals > 0) : null;

    return {
      provider: 'FOOTYSTATS',
      match_id: Number(rawMatch.id),
      home_goals: hGoals,
      away_goals: aGoals,
      total_goals: parseNum(rawMatch.totalGoalCount) ?? (hGoals !== null && aGoals !== null ? hGoals + aGoals : null),
      btts_actual: btts,
      team_a_shots: parseNum(rawMatch.team_a_shots),
      team_b_shots: parseNum(rawMatch.team_b_shots),
      team_a_shots_on_target: parseNum(rawMatch.team_a_shotsOnTarget),
      team_b_shots_on_target: parseNum(rawMatch.team_b_shotsOnTarget),
      team_a_possession: parseNum(rawMatch.team_a_possession),
      team_b_possession: parseNum(rawMatch.team_b_possession),
      team_a_corners: parseNum(rawMatch.team_a_corners),
      team_b_corners: parseNum(rawMatch.team_b_corners),
      team_a_xg_postmatch: parseNum(rawMatch.team_a_xg),
      team_b_xg_postmatch: parseNum(rawMatch.team_b_xg),
    };
  }

  /**
   * Evaluates temporal integrity of a feature against prediction timestamp.
   * Invariant: featureAsOfUtc <= predictionTimestampUtc
   */
  public static validateTemporalIntegrity(
    featureAsOfUtc: string,
    predictionTimestampUtc: string,
    fieldName: string = 'feature'
  ): TemporalValidationResult {
    const asOfMs = new Date(featureAsOfUtc).getTime();
    const predMs = new Date(predictionTimestampUtc).getTime();

    if (isNaN(asOfMs) || isNaN(predMs)) {
      return {
        isValid: false,
        code: 'TEMPORAL_LEAKAGE_VIOLATION',
        message: `Invalid timestamp encountered in temporal audit for ${fieldName}`,
        featureAsOfUtc,
        predictionTimestampUtc,
      };
    }

    if (asOfMs > predMs) {
      return {
        isValid: false,
        code: 'TEMPORAL_LEAKAGE_VIOLATION',
        message: `Temporal leakage: ${fieldName} as-of timestamp (${featureAsOfUtc}) occurs after prediction timestamp (${predictionTimestampUtc})`,
        featureAsOfUtc,
        predictionTimestampUtc,
      };
    }

    return {
      isValid: true,
      code: 'VALID',
      message: 'Feature satisfies point-in-time temporal integrity.',
      featureAsOfUtc,
      predictionTimestampUtc,
    };
  }

  /**
   * Audits whether a specific feature field contains future leakage.
   * Full season aggregates (like home_ppg or season-end stats) used pre-kickoff
   * violate anti-lookahead rules.
   */
  public static auditFieldForLookahead(fieldName: string): { isSafePreMatch: boolean; reason: string } {
    const unsafePostMatchFields = [
      'home_ppg',
      'away_ppg',
      'team_a_xg',
      'team_b_xg',
      'total_xg',
      'team_a_shots',
      'team_b_shots',
      'team_a_shotsOnTarget',
      'team_b_shotsOnTarget',
      'team_a_possession',
      'team_b_possession',
      'team_a_corners',
      'team_b_corners',
      'homeGoalCount',
      'awayGoalCount',
      'totalGoalCount',
      'btts',
    ];

    if (unsafePostMatchFields.includes(fieldName)) {
      return {
        isSafePreMatch: false,
        reason: `LEAKAGE_HAZARD: '${fieldName}' is a post-match outcome or full-season aggregate. Prohibited as pre-match model feature.`,
      };
    }

    return {
      isSafePreMatch: true,
      reason: `SAFE: '${fieldName}' is recorded pre-match or point-in-time safe.`,
    };
  }
}
