// ============================================================================
// BTTS VALUE ENGINE v1 — EVIDENCE & SAMPLE SIZE VALUE GATE
// ============================================================================
// Location: src/lib/research/btts/valueGate.ts
//
// Invariants:
//   - Strict Sample Sufficiency: sample < MIN_PRODUCTION_SAMPLE NEVER yields 'VALUE'.
//   - Explicit Statuses: INSUFFICIENT_DATA | RESEARCH_ONLY | NO_VALUE | VALUE | INVALID.
//   - Anti-Lookahead: Any timing violation yields 'INVALID'.
//   - No cherry-picking: Configurable edge & EV sensitivity thresholds.
// ============================================================================

import { BttsValueStatus, BttsGateResult, BttsSelection } from './types';

export interface BttsGateEvaluationParams {
  canonicalMatchId: string;
  kickoffTimestamp: string;
  predictionTimestamp: string;
  featureCutoffTimestamp: string;
  closingOddsTimestamp: string;

  modelProbYes: number;
  modelProbNo: number;
  closingYesOdds: number;
  closingNoOdds: number;
  noVigProbYes: number;
  noVigProbNo: number;

  edgeYes: number;
  edgeNo: number;
  evYes: number;
  evNo: number;

  validationSampleSize: number; // e.g., 16 in Phase 1
  minSampleSizeRequired?: number; // default 100
  minEdge?: number; // default 0.03 (3 percentage points)
  minEv?: number; // default 0.03 (+3%)
  calibrationValidated?: boolean; // default false in Phase 1
}

export interface BttsGateEvaluationResult {
  status: BttsValueStatus;
  recommendedSide: BttsSelection | null;
  gates: BttsGateResult[];
  reason: string;
}

export class BttsValueGate {
  public static readonly DEFAULT_MIN_SAMPLE = 100;
  public static readonly DEFAULT_MIN_EDGE = 0.03; // 3%
  public static readonly DEFAULT_MIN_EV = 0.03; // +3%

  /**
   * Evaluates all statistical and temporal gates for a BTTS prediction.
   */
  public static evaluate(params: BttsGateEvaluationParams): BttsGateEvaluationResult {
    const minSample = params.minSampleSizeRequired ?? this.DEFAULT_MIN_SAMPLE;
    const minEdge = params.minEdge ?? this.DEFAULT_MIN_EDGE;
    const minEv = params.minEv ?? this.DEFAULT_MIN_EV;
    const isCalibrated = params.calibrationValidated ?? false;

    const kickoffMs = Date.parse(params.kickoffTimestamp);
    const predMs = Date.parse(params.predictionTimestamp);
    const featMs = Date.parse(params.featureCutoffTimestamp);
    const oddsMs = Date.parse(params.closingOddsTimestamp);

    const gates: BttsGateResult[] = [];

    // 1. GATE: Temporal Anti-Lookahead
    const predBeforeKickoff = Number.isFinite(predMs) && Number.isFinite(kickoffMs) && predMs <= kickoffMs;
    const featBeforeKickoff = Number.isFinite(featMs) && Number.isFinite(kickoffMs) && featMs <= kickoffMs;
    const oddsBeforeKickoff = Number.isFinite(oddsMs) && Number.isFinite(kickoffMs) && oddsMs < kickoffMs;

    const temporalPassed = predBeforeKickoff && featBeforeKickoff && oddsBeforeKickoff;
    gates.push({
      gateName: 'TEMPORAL_ANTI_LOOKAHEAD',
      passed: temporalPassed,
      actualValue: `pred<kickoff: ${predBeforeKickoff}, feat<=kickoff: ${featBeforeKickoff}, odds<kickoff: ${oddsBeforeKickoff}`,
      requiredThreshold: 'All timestamps < kickoff',
      detail: temporalPassed
        ? 'Zero lookahead leakage: all features and odds observed prior to kickoff.'
        : 'CRITICAL FAILURE: Feature or odds timestamp occurred at or after kickoff.',
    });

    if (!temporalPassed) {
      return {
        status: 'INVALID',
        recommendedSide: null,
        gates,
        reason: 'CRITICAL: Lookahead violation detected in prediction inputs.',
      };
    }

    // 2. GATE: Odds Validity & Positive Numbers
    const oddsValid =
      params.closingYesOdds > 1.01 &&
      params.closingNoOdds > 1.01 &&
      params.modelProbYes > 0 &&
      params.modelProbYes < 1;

    gates.push({
      gateName: 'ODDS_VALIDITY',
      passed: oddsValid,
      actualValue: `Yes=${params.closingYesOdds}, No=${params.closingNoOdds}`,
      requiredThreshold: 'Odds > 1.01 and 0 < Prob < 1',
      detail: oddsValid ? 'Market odds and model probabilities strictly positive.' : 'Invalid odds or probabilities.',
    });

    if (!oddsValid) {
      return {
        status: 'INVALID',
        recommendedSide: null,
        gates,
        reason: 'Invalid odds or numerical probabilities.',
      };
    }

    // 3. GATE: Sample Size Sufficiency
    const samplePassed = params.validationSampleSize >= minSample;
    gates.push({
      gateName: 'SAMPLE_SIZE_SUFFICIENCY',
      passed: samplePassed,
      actualValue: params.validationSampleSize,
      requiredThreshold: minSample,
      detail: samplePassed
        ? `Sufficient statistical sample size (${params.validationSampleSize} >= ${minSample}).`
        : `Sample size (${params.validationSampleSize}) is below statistical minimum (${minSample}). Statistical edge cannot be proven.`,
    });

    // 4. GATE: Calibration Status
    gates.push({
      gateName: 'CALIBRATION_VALIDATION',
      passed: isCalibrated,
      actualValue: isCalibrated ? 'VALIDATED' : 'UNVALIDATED',
      requiredThreshold: 'VALIDATED',
      detail: isCalibrated
        ? 'Model probabilities validated via out-of-sample calibration curve.'
        : 'Model calibration is unvalidated. High confidence / commercial value cannot be claimed.',
    });

    // 5. GATE: Edge & Expected Value
    const yesHasValue = params.edgeYes >= minEdge && params.evYes >= minEv;
    const noHasValue = params.edgeNo >= minEdge && params.evNo >= minEv;

    let candidateSide: BttsSelection | null = null;
    let candidateEdge = 0;
    let candidateEv = 0;

    if (yesHasValue && noHasValue) {
      // Pick higher edge
      candidateSide = params.edgeYes >= params.edgeNo ? 'YES' : 'NO';
      candidateEdge = params.edgeYes >= params.edgeNo ? params.edgeYes : params.edgeNo;
      candidateEv = params.edgeYes >= params.edgeNo ? params.evYes : params.evNo;
    } else if (yesHasValue) {
      candidateSide = 'YES';
      candidateEdge = params.edgeYes;
      candidateEv = params.evYes;
    } else if (noHasValue) {
      candidateSide = 'NO';
      candidateEdge = params.edgeNo;
      candidateEv = params.evNo;
    }

    const valueGatePassed = candidateSide !== null;
    gates.push({
      gateName: 'EDGE_AND_EV_THRESHOLD',
      passed: valueGatePassed,
      actualValue: candidateSide
        ? `${candidateSide}: Edge=${(candidateEdge * 100).toFixed(1)}%, EV=${(candidateEv * 100).toFixed(1)}%`
        : `Yes(Edge=${(params.edgeYes * 100).toFixed(1)}%, EV=${(params.evYes * 100).toFixed(1)}%), No(Edge=${(params.edgeNo * 100).toFixed(1)}%, EV=${(params.evNo * 100).toFixed(1)}%)`,
      requiredThreshold: `Edge >= ${(minEdge * 100).toFixed(1)}% AND EV >= ${(minEv * 100).toFixed(1)}%`,
      detail: valueGatePassed
        ? `Positive expected edge identified on BTTS ${candidateSide}.`
        : 'Neither BTTS YES nor BTTS NO provides sufficient edge over no-vig market price.',
    });

    // Determine Final Status
    if (!samplePassed) {
      return {
        status: 'INSUFFICIENT_DATA',
        recommendedSide: null,
        gates,
        reason: `INSUFFICIENT DATA: Validation sample (${params.validationSampleSize} fixtures) is below statistical threshold (${minSample}). Cannot establish statistical edge.`,
      };
    }

    if (!isCalibrated) {
      return {
        status: 'RESEARCH_ONLY',
        recommendedSide: candidateSide,
        gates,
        reason: 'RESEARCH ONLY: Probabilities generated but out-of-sample calibration curve is unvalidated.',
      };
    }

    if (!valueGatePassed) {
      return {
        status: 'NO_VALUE',
        recommendedSide: null,
        gates,
        reason: 'NO VALUE: Model probability does not clear minimum edge and EV thresholds against market price.',
      };
    }

    // All gates passed!
    return {
      status: 'VALUE',
      recommendedSide: candidateSide,
      gates,
      reason: `VALUE: Validated edge on BTTS ${candidateSide} with EV = +${(candidateEv * 100).toFixed(1)}%.`,
    };
  }
}
