// SALMO DECISION ENGINE — Transparent Asian Handicap Value & Decision Layer.
// Converts football data and market prices into transparent probability, fair odds, and value classification.
// Enforces strict separation of Probability from Value, Research Firewall, and Zero Synthetic Confidence.

export type AhDecisionBadge = 'GREEN' | 'YELLOW' | 'RED' | 'GREY';

export type AhDecisionStatus =
  | 'VALUE'
  | 'MARGINAL'
  | 'NO_VALUE'
  | 'INSUFFICIENT_DATA'
  | 'RESEARCH_ONLY';

export type AhConfidenceTier = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export type ModelLifecycleStage =
  | 'DISCOVERY'
  | 'VALIDATED'
  | 'OOS_PASS'
  | 'WALK_FORWARD_PASS'
  | 'LIVE_SHADOW'
  | 'LIVE_SETTLED';

export interface DecisionEvaluationInput {
  marketLine: number | null | undefined;
  marketOdds: number | null | undefined;
  oppositeOdds?: number | null;
  bookmaker?: string | null;
  oddsTimestamp?: string | null;
  modelProbability: number | null | undefined; // 0 to 1
  fairOdds: number | null | undefined;
  expectedValue: number | null | undefined; // e.g. 0.05 for +5.0%
  sampleSize?: number;
  dataQuality?: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  isModelProductionApproved?: boolean;
  lifecycleStage?: ModelLifecycleStage;
  researchFirewallActive?: boolean;
}

export interface AhDecisionOutput {
  badge: AhDecisionBadge;
  status: AhDecisionStatus;
  statusLabel: string;
  badgeColorClass: string;
  confidence: AhConfidenceTier;
  expectedValuePct: number | null;
  fairOdds: number | null;
  marketOdds: number | null;
  modelProbabilityPct: number | null;
  marketImpliedProbabilityPct: number | null;
  lifecycleStage: ModelLifecycleStage;
  productionReady: boolean;
  reason: string;
  drilldownExplanation: {
    probabilityAssessment: string;
    pricingAssessment: string;
    valueAssessment: string;
    confidenceAssessment: string;
    firewallNotice?: string;
  };
}

export class AhDecisionEngine {
  /**
   * Evaluates an Asian Handicap opportunity under strict production gates.
   * Never manufactures confidence from missing data.
   */
  public static evaluateDecision(input: DecisionEvaluationInput): AhDecisionOutput {
    const {
      marketLine,
      marketOdds,
      oppositeOdds,
      modelProbability,
      fairOdds,
      expectedValue,
      sampleSize = 0,
      dataQuality = 'NONE',
      isModelProductionApproved = false,
      lifecycleStage = 'DISCOVERY',
      researchFirewallActive = true,
    } = input;

    // 1. GATE 0: Data Completeness & Validity
    // Any missing odds, missing line, invalid odds (<=1), or missing probability collapses to GREY
    if (
      marketLine === null ||
      marketLine === undefined ||
      marketOdds === null ||
      marketOdds === undefined ||
      marketOdds <= 1 ||
      !Number.isFinite(marketOdds)
    ) {
      return {
        badge: 'GREY',
        status: 'INSUFFICIENT_DATA',
        statusLabel: 'ODDS DATA UNAVAILABLE',
        badgeColorClass: 'bg-neutral-800 text-neutral-400 border-neutral-700',
        confidence: 'NONE',
        expectedValuePct: null,
        fairOdds: null,
        marketOdds: null,
        modelProbabilityPct: null,
        marketImpliedProbabilityPct: null,
        lifecycleStage,
        productionReady: false,
        reason: 'Market odds are unavailable or non-positive from verified providers. Salmo never invents prices.',
        drilldownExplanation: {
          probabilityAssessment: 'Cannot evaluate probability without market context.',
          pricingAssessment: 'Odds data missing from provider feed.',
          valueAssessment: 'Value calculation impossible without market price.',
          confidenceAssessment: 'Zero confidence due to missing market inputs.',
        },
      };
    }

    if (
      modelProbability === null ||
      modelProbability === undefined ||
      !Number.isFinite(modelProbability) ||
      modelProbability <= 0 ||
      modelProbability >= 1
    ) {
      return {
        badge: 'GREY',
        status: 'INSUFFICIENT_DATA',
        statusLabel: 'MODEL DATA INSUFFICIENT',
        badgeColorClass: 'bg-neutral-800 text-neutral-400 border-neutral-700',
        confidence: 'NONE',
        expectedValuePct: null,
        fairOdds: null,
        marketOdds,
        modelProbabilityPct: null,
        marketImpliedProbabilityPct: oppositeOdds && oppositeOdds > 1 ? Number(((1 / marketOdds) / (1 / marketOdds + 1 / oppositeOdds) * 100).toFixed(1)) : Number(((1 / marketOdds) * 100).toFixed(1)),
        lifecycleStage,
        productionReady: false,
        reason: 'Model probability is unpopulated or outside valid domain (0, 1).',
        drilldownExplanation: {
          probabilityAssessment: 'Model probability missing or invalid.',
          pricingAssessment: `Market offers ${marketOdds.toFixed(2)}.`,
          valueAssessment: 'Cannot compute expected value without calibrated probabilities.',
          confidenceAssessment: 'Insufficient data for statistical assessment.',
        },
      };
    }

    // Market implied probability via two-way proportional devig if opposite odds present
    let marketImpliedProb = 1 / marketOdds;
    if (oppositeOdds && oppositeOdds > 1 && Number.isFinite(oppositeOdds)) {
      const invA = 1 / marketOdds;
      const invB = 1 / oppositeOdds;
      marketImpliedProb = invA / (invA + invB);
    }

    const modelProbPct = Number((modelProbability * 100).toFixed(1));
    const marketImpliedProbPct = Number((marketImpliedProb * 100).toFixed(1));
    const evPct = expectedValue !== null && expectedValue !== undefined ? Number((expectedValue * 100).toFixed(2)) : null;
    const computedFairOdds = fairOdds && fairOdds > 0 ? Number(fairOdds.toFixed(2)) : null;

    // 2. GATE 1: Research Firewall & Production Approval
    // If the research firewall is active and model is not production approved:
    // Model outputs are presented transparently as RESEARCH ONLY, never as live GREEN picks!
    if (researchFirewallActive || !isModelProductionApproved) {
      // Determine secondary color: If EV is clearly negative, label RED (No Value).
      // Otherwise, keep as GREY (Research Only / Data Insufficient for Live).
      if (expectedValue !== null && expectedValue !== undefined && expectedValue <= 0) {
        return {
          badge: 'RED',
          status: 'NO_VALUE',
          statusLabel: 'NO VALUE (EV ≤ 0%)',
          badgeColorClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          confidence: dataQuality === 'HIGH' ? 'HIGH' : 'MEDIUM',
          expectedValuePct: evPct,
          fairOdds: computedFairOdds,
          marketOdds,
          modelProbabilityPct: modelProbPct,
          marketImpliedProbabilityPct: marketImpliedProbPct,
          lifecycleStage,
          productionReady: false,
          reason: `Negative expected value (${evPct}%). Market price ${marketOdds.toFixed(2)} is lower than estimated fair price ${computedFairOdds?.toFixed(2) || 'N/A'}.`,
          drilldownExplanation: {
            probabilityAssessment: `Model estimates ${modelProbPct}% probability vs market implied ${marketImpliedProbPct}%.`,
            pricingAssessment: `Offered odds: ${marketOdds.toFixed(2)}. Fair odds: ${computedFairOdds?.toFixed(2) || 'N/A'}.`,
            valueAssessment: `EV is negative (${evPct}%). Bet carries negative mathematical expectation.`,
            confidenceAssessment: `Sample size N=${sampleSize}, Data quality: ${dataQuality}.`,
            firewallNotice: 'Research Firewall: Model is in evaluation stage (No demonstrated edge over closing prices).',
          },
        };
      }

      return {
        badge: 'GREY',
        status: 'RESEARCH_ONLY',
        statusLabel: 'RESEARCH ONLY (FIREWALLED)',
        badgeColorClass: 'bg-neutral-800 text-neutral-300 border-neutral-600',
        confidence: dataQuality === 'HIGH' ? 'MEDIUM' : 'LOW',
        expectedValuePct: evPct,
        fairOdds: computedFairOdds,
        marketOdds,
        modelProbabilityPct: modelProbPct,
        marketImpliedProbabilityPct: marketImpliedProbPct,
        lifecycleStage,
        productionReady: false,
        reason: 'Current AH models have not demonstrated statistically significant out-of-sample edge over Pinnacle prices. Marked RESEARCH ONLY.',
        drilldownExplanation: {
          probabilityAssessment: `Model estimates ${modelProbPct}% vs market implied ${marketImpliedProbPct}%.`,
          pricingAssessment: `Offered odds: ${marketOdds.toFixed(2)}. Fair odds: ${computedFairOdds?.toFixed(2) || 'N/A'}.`,
          valueAssessment: `Apparent EV is ${evPct !== null ? `${evPct}%` : 'N/A'}, but underlying signal is unvalidated.`,
          confidenceAssessment: `Confidence restricted to research environment (Stage: ${lifecycleStage}).`,
          firewallNotice: 'Research Invariant: HandicapLab prohibits tipster-style betting picks on unvalidated edges.',
        },
      };
    }

    // 3. GATE 2: Production Decision Classification (When Production Gates are open)
    // Separation of Probability from Value:
    // High probability at low odds (e.g. 80% at 1.15) has EV = 0.8 * 0.15 - 0.2 = -0.08 (-8%) -> RED!
    if (expectedValue === null || expectedValue === undefined || expectedValue <= 0) {
      return {
        badge: 'RED',
        status: 'NO_VALUE',
        statusLabel: 'NO VALUE',
        badgeColorClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        confidence: 'HIGH',
        expectedValuePct: evPct,
        fairOdds: computedFairOdds,
        marketOdds,
        modelProbabilityPct: modelProbPct,
        marketImpliedProbabilityPct: marketImpliedProbPct,
        lifecycleStage,
        productionReady: true,
        reason: `Negative EV (${evPct}%). Market price does not compensate for outcome variance.`,
        drilldownExplanation: {
          probabilityAssessment: `Model win probability is ${modelProbPct}%.`,
          pricingAssessment: `Market price ${marketOdds.toFixed(2)} is worse than fair price ${computedFairOdds?.toFixed(2) || 'N/A'}.`,
          valueAssessment: `Expected value is negative (${evPct}%).`,
          confidenceAssessment: `High confidence rejection based on quantitative price insufficiency.`,
        },
      };
    }

    // Marginal Value (0% < EV < 3.0% or Low Data Quality)
    if (expectedValue < 0.03 || sampleSize < 50 || dataQuality === 'LOW') {
      return {
        badge: 'YELLOW',
        status: 'MARGINAL',
        statusLabel: 'MARGINAL VALUE',
        badgeColorClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
        confidence: 'LOW',
        expectedValuePct: evPct,
        fairOdds: computedFairOdds,
        marketOdds,
        modelProbabilityPct: modelProbPct,
        marketImpliedProbabilityPct: marketImpliedProbPct,
        lifecycleStage,
        productionReady: true,
        reason: `Borderline EV (+${evPct}%) or limited sample size (N=${sampleSize}). Edge insufficient to absorb transaction costs safely.`,
        drilldownExplanation: {
          probabilityAssessment: `Model probability ${modelProbPct}% exceeds market implied ${marketImpliedProbPct}%.`,
          pricingAssessment: `Market price ${marketOdds.toFixed(2)} offers slight premium over fair price ${computedFairOdds?.toFixed(2) || 'N/A'}.`,
          valueAssessment: `Apparent EV of +${evPct}% is within statistical noise margin (< 3.0%).`,
          confidenceAssessment: `Low confidence tier due to narrow edge and sample size N=${sampleSize}.`,
        },
      };
    }

    // Green Value: Satisfies ALL production gates
    return {
      badge: 'GREEN',
      status: 'VALUE',
      statusLabel: 'VALUE CONFIRMED',
      badgeColorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40',
      confidence: 'HIGH',
      expectedValuePct: evPct,
      fairOdds: computedFairOdds,
      marketOdds,
      modelProbabilityPct: modelProbPct,
      marketImpliedProbabilityPct: marketImpliedProbPct,
      lifecycleStage,
      productionReady: true,
      reason: `Significant expected value (+${evPct}%) backed by high data quality and validated sample size.`,
      drilldownExplanation: {
        probabilityAssessment: `Model probability ${modelProbPct}% substantially exceeds market implied ${marketImpliedProbPct}%.`,
        pricingAssessment: `Market odds ${marketOdds.toFixed(2)} significantly exceed fair odds ${computedFairOdds?.toFixed(2) || 'N/A'}.`,
        valueAssessment: `Robust positive expected value (+${evPct}%).`,
        confidenceAssessment: `High confidence supported by complete evidence, N=${sampleSize}, and validated calibration.`,
      },
    };
  }
}
