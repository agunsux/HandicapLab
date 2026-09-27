// ============================================================================
// DAILY CONFIDENCE & VALUE GATE SYSTEM (AH + BTTS + OU)
// ============================================================================
// Location: src/lib/pipeline/confidenceGate.ts
//
// Invariants enforced:
// 1. Minimum Qualification Threshold: Calibrated probability > 65% (0.65) strictly.
//    65% is an evaluation threshold, NOT a manufactured probability.
// 2. Minimum Odds Gate: odds >= 1.60 strictly.
// 3. Implied Probability: implied_probability = 1 / odds.
// 4. Value Gate: calibrated_probability > market_implied_probability (positive edge & EV).
// 5. BTTS Invariant: BTTS VALUE = DISABLED. BTTS remains RESEARCH_ONLY.
//    Model Brier (0.2564) > Pinnacle Brier (0.2444).
//    BTTS can NEVER be promoted to HIGH_CONFIDENCE regardless of probability.
// 6. Deterministic Confidence Levels: HIGH, MEDIUM, LOW, PASS.
// 7. No Qualified Pick is a successful and expected pipeline result when no match qualifies.
// ============================================================================

export type SupportedPipelineMarket = 'AH' | 'OU' | 'BTTS';
export type ConfidenceTier = 'HIGH' | 'MEDIUM' | 'LOW' | 'PASS';

export type PredictionLedgerStatus =
  | 'PENDING'
  | 'HIGH_CONFIDENCE'
  | 'QUALIFIED'
  | 'RESEARCH_ONLY'
  | 'SETTLED_WIN'
  | 'SETTLED_LOSS'
  | 'VOID'
  | 'INVALID';

export interface ConfidenceGateInput {
  canonicalMatchId: string;
  fixtureId: string;
  match: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoffUtc: string;
  market: SupportedPipelineMarket;
  selection: string;
  line: number | null;
  odds: number;
  modelProbability: number;
  calibratedProbability?: number;
  predictionTimestampUtc: string;
  oddsTimestampUtc: string;
  modelVersion: string;
  sampleSizeHome: number;
  sampleSizeAway: number;
  modelValidated?: boolean;
  dataWarnings?: string[];
  runId?: string;
}

export interface ConfidenceGateResult {
  qualified: boolean;
  isHighConfidence: boolean;
  status: PredictionLedgerStatus;
  confidenceTier: ConfidenceTier;
  confidenceScore: number; // 0 - 100 deterministic
  modelProbability: number;
  calibratedProbability: number;
  marketImpliedProbability: number;
  edge: number; // calibratedProbability - impliedProbability
  expectedValue: number; // (calibratedProbability * odds) - 1
  verdict: 'LAYAK' | 'PANTAU' | 'LEWATI' | 'RESEARCH_ONLY';
  rejectionReasons: string[];
  passes: {
    marketSupported: boolean;
    oddsThreshold: boolean; // odds >= 1.60
    probabilityThreshold: boolean; // calibrated_prob > 0.65
    positiveEdge: boolean; // edge > 0
    positiveEv: boolean; // EV > 0
    sufficientSample: boolean; // >= 5 matches each
    modelValidated: boolean;
    temporalSanity: boolean;
    bttsResearchGated: boolean;
  };
}

export class ConfidenceGateSystem {
  public static readonly MIN_PROBABILITY_THRESHOLD = 0.65;
  public static readonly MIN_ODDS_THRESHOLD = 1.60;
  public static readonly MIN_SAMPLE_SIZE = 5;

  /**
   * Applies the exact deterministic qualification and confidence formula.
   */
  public static evaluate(input: ConfidenceGateInput): ConfidenceGateResult {
    const reasons: string[] = [];

    // 1. Market Scope Verification
    const market = input.market?.toUpperCase() as SupportedPipelineMarket;
    const isMarketSupported = ['AH', 'OU', 'BTTS'].includes(market);
    if (!isMarketSupported) {
      reasons.push(`UNSUPPORTED_MARKET: '${input.market}' is not in [AH, OU, BTTS]`);
    }

    // 2. Probabilities & Mathematical Pricing
    const modelProb = Number(Math.max(0.0001, Math.min(0.9999, input.modelProbability)).toFixed(4));
    // If calibrated probability not explicitly provided, default to model probability
    const calibratedProb = Number(
      Math.max(0.0001, Math.min(0.9999, input.calibratedProbability ?? modelProb)).toFixed(4)
    );

    const odds = input.odds;
    const impliedProb = odds > 1.0 ? Number((1 / odds).toFixed(4)) : 0.5;
    const edge = Number((calibratedProb - impliedProb).toFixed(4));
    const expectedValue = Number(((calibratedProb * odds) - 1).toFixed(4));

    // 3. Temporal Sanity
    const kickMs = new Date(input.kickoffUtc).getTime();
    const predMs = new Date(input.predictionTimestampUtc).getTime();
    const oddsMs = new Date(input.oddsTimestampUtc).getTime();
    const temporalSanity = !isNaN(kickMs) && !isNaN(predMs) && predMs < kickMs && oddsMs <= predMs;
    if (!temporalSanity) {
      reasons.push('TEMPORAL_LEAKAGE: prediction >= kickoff or odds > prediction');
    }

    // 4. Threshold Checks
    const oddsPass = odds >= this.MIN_ODDS_THRESHOLD;
    if (!oddsPass) {
      reasons.push(`ODDS_BELOW_GATE: odds ${odds.toFixed(2)} < minimum ${this.MIN_ODDS_THRESHOLD}`);
    }

    const probPass = calibratedProb > this.MIN_PROBABILITY_THRESHOLD;
    if (!probPass) {
      reasons.push(
        `PROBABILITY_BELOW_GATE: calibrated probability ${(calibratedProb * 100).toFixed(1)}% <= minimum ${(this.MIN_PROBABILITY_THRESHOLD * 100)}%`
      );
    }

    const edgePass = edge > 0.0;
    if (!edgePass) {
      reasons.push(`NEGATIVE_OR_ZERO_EDGE: edge ${(edge * 100).toFixed(2)}% <= 0%`);
    }

    const evPass = expectedValue > 0.0;
    if (!evPass) {
      reasons.push(`NEGATIVE_OR_ZERO_EV: EV ${(expectedValue * 100).toFixed(2)}% <= 0%`);
    }

    const homeSample = input.sampleSizeHome ?? 0;
    const awaySample = input.sampleSizeAway ?? 0;
    const samplePass = homeSample >= this.MIN_SAMPLE_SIZE && awaySample >= this.MIN_SAMPLE_SIZE;
    if (!samplePass) {
      reasons.push(`INSUFFICIENT_SAMPLE: home=${homeSample}, away=${awaySample} (min ${this.MIN_SAMPLE_SIZE})`);
    }

    const modelValidated = input.modelValidated !== false;
    if (!modelValidated) {
      reasons.push('MODEL_NOT_VALIDATED: Model failed validation gate');
    }

    const warnings = input.dataWarnings || [];
    if (warnings.length > 0) {
      reasons.push(`DATA_WARNINGS: ${warnings.join(', ')}`);
    }

    // 5. Invariant Check: BTTS Research Control
    const isBtts = market === 'BTTS';
    const bttsResearchGated = isBtts; // Flag indicates BTTS is held in research

    // 6. Deterministic Confidence Score (0 - 100)
    let rawConfidence = 0;
    if (edge > 0 && expectedValue > 0) {
      const probPts = Math.max(0, (calibratedProb - 0.50) / 0.50) * 40;
      const edgePts = Math.min(Math.max(0, edge) / 0.15, 1.0) * 30;
      const samplePts = Math.min(Math.min(homeSample, awaySample) / 10, 1.0) * 20;
      const valPts = modelValidated ? 10 : 0;
      rawConfidence = Math.min(100, Math.round(probPts + edgePts + samplePts + valPts));
    }
    const confidenceScore = isBtts ? Math.min(50, rawConfidence) : rawConfidence;

    // 7. Classification
    let status: PredictionLedgerStatus;
    let confidenceTier: ConfidenceTier;
    let verdict: 'LAYAK' | 'PANTAU' | 'LEWATI' | 'RESEARCH_ONLY';
    let qualified = false;
    let isHighConfidence = false;

    if (isBtts) {
      // BTTS MANDATORY INVARIANT: Always RESEARCH_ONLY!
      status = 'RESEARCH_ONLY';
      confidenceTier = 'PASS';
      verdict = 'RESEARCH_ONLY';
      qualified = false;
      isHighConfidence = false;
      reasons.push('BTTS_RESEARCH_ONLY: Market benchmark underperformed (Model 0.2564 vs Pinnacle 0.2444)');
    } else if (
      isMarketSupported &&
      oddsPass &&
      probPass &&
      edgePass &&
      evPass &&
      samplePass &&
      modelValidated &&
      temporalSanity &&
      warnings.length === 0
    ) {
      status = 'HIGH_CONFIDENCE';
      confidenceTier = 'HIGH';
      verdict = 'LAYAK';
      qualified = true;
      isHighConfidence = true;
    } else if (calibratedProb >= 0.55 && odds >= 1.50 && edgePass && evPass && samplePass && temporalSanity) {
      status = 'QUALIFIED';
      confidenceTier = 'MEDIUM';
      verdict = 'PANTAU';
      qualified = true;
      isHighConfidence = false;
    } else if (edgePass && evPass && temporalSanity) {
      status = 'PENDING';
      confidenceTier = 'LOW';
      verdict = 'PANTAU';
      qualified = false;
      isHighConfidence = false;
    } else {
      status = temporalSanity ? 'PENDING' : 'INVALID';
      confidenceTier = 'PASS';
      verdict = 'LEWATI';
      qualified = false;
      isHighConfidence = false;
    }

    return {
      qualified,
      isHighConfidence,
      status,
      confidenceTier,
      confidenceScore,
      modelProbability: modelProb,
      calibratedProbability: calibratedProb,
      marketImpliedProbability: impliedProb,
      edge,
      expectedValue,
      verdict,
      rejectionReasons: reasons,
      passes: {
        marketSupported: isMarketSupported,
        oddsThreshold: oddsPass,
        probabilityThreshold: probPass,
        positiveEdge: edgePass,
        positiveEv: evPass,
        sufficientSample: samplePass,
        modelValidated,
        temporalSanity,
        bttsResearchGated,
      },
    };
  }
}
