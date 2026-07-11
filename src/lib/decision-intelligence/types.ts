/**
 * HandicapLab — Decision Intelligence Platform (EPIC 20)
 * =========================================================
 * Strongly-typed contracts for decision policies, pipeline, EV,
 * stake sizing, risk, portfolio, explainability, consistency,
 * attribution, artifacts, reporting, and champion decision gate.
 */

export const DECISION_INTELLIGENCE_VERSION = '1.0.0' as const;

export const DI_ID_PREFIX = {
  POLICY: 'dipol',
  DECISION: 'didec',
  EV: 'diev',
  STAKE: 'distake',
  RISK: 'dirisk',
  PORTFOLIO: 'diport',
  CONSISTENCY: 'dicons',
  ATTRIBUTION: 'diattr',
  REPORT: 'direp',
  ARTIFACT: 'diart',
  GATE: 'digate',
} as const;

// ─── EPIC 20.1 — Decision Policy Registry ───────────────────────────────

export type PolicyId = 'conservative' | 'balanced' | 'aggressive' | 'value_only' | 'high_confidence' | 'market_neutral' | 'research_mode' | 'simulation_mode';

export interface DecisionPolicy {
  readonly policyId: PolicyId;
  readonly version: string;
  readonly description: string;
  readonly minEdge: number;
  readonly minConfidence: number;
  readonly maxRiskPerBet: number;
  readonly marketRestrictions: readonly string[];
  readonly stakeSizingMethod: 'flat' | 'kelly' | 'fractional_kelly' | 'fixed_fraction' | 'confidence_weighted' | 'volatility_adjusted';
  readonly portfolioRules: readonly string[];
  readonly maxPortfolioExposure: number;
  readonly maxConcurrentBets: number;
}

// ─── EPIC 20.2 — Decision Pipeline ───────────────────────────────────────

export interface DecisionInput {
  readonly fixtureId: string;
  readonly market: string;
  readonly rawProbability: number;
  readonly calibratedProbability: number;
  readonly confidence: number;
  readonly homeOdds: number;
  readonly drawOdds: number | null;
  readonly awayOdds: number;
  readonly featureContributions: Record<string, number>;
  readonly bankroll: number;
  readonly currentExposure: number;
}

export interface DecisionStageLog {
  readonly stage: string;
  readonly passed: boolean;
  readonly input: Record<string, number | string>;
  readonly output: Record<string, number | string>;
  readonly message: string;
}

// ─── EPIC 20.3 — Expected Value Laboratory ───────────────────────────────

export interface EVResult {
  readonly fixtureId: string;
  readonly market: string;
  readonly rawProbability: number;
  readonly calibratedProbability: number;
  readonly homeOdds: number;
  readonly drawOdds: number | null;
  readonly awayOdds: number;
  readonly expectedValue: number;
  readonly expectedReturn: number;
  readonly riskAdjustedEv: number;
  readonly probabilityEdge: number;
  readonly marketEdge: number;
  readonly fairOdds: number;
  readonly valueMargin: number;
  readonly noBetMargin: number;
  readonly breakEvenProbability: number;
}

// ─── EPIC 20.4 — Stake Sizing Engine ─────────────────────────────────────

export interface StakeResult {
  readonly fixtureId: string;
  readonly method: string;
  readonly stake: number;
  readonly fraction: number;
  readonly maxStake: number;
  readonly confidenceWeight: number;
  readonly volatilityMultiplier: number;
}

// ─── EPIC 20.5 — Risk Intelligence ───────────────────────────────────────

export interface RiskProfile {
  readonly portfolioExposure: number;
  readonly marketExposure: Record<string, number>;
  readonly leagueExposure: Record<string, number>;
  readonly correlationRisk: number;
  readonly concentrationRisk: number;
  readonly volatility: number;
  readonly variance: number;
  readonly maxDrawdownProjection: number;
  readonly valueAtRisk: number;
  readonly conditionalVaR: number;
}

// ─── EPIC 20.6 — Portfolio Optimizer ─────────────────────────────────────

export interface PortfolioConstraint {
  readonly maxExposure: number;
  readonly maxMarketExposure: number;
  readonly maxLeagueExposure: number;
  readonly maxDailyBets: number;
  readonly maxDailyStake: number;
}

export interface PortfolioAllocation {
  readonly fixtureId: string;
  readonly recommendedStake: number;
  readonly allocationPct: number;
  readonly constrained: boolean;
}

// ─── EPIC 20.7 — Decision Explainability ─────────────────────────────────

export interface DecisionExplanation {
  readonly fixtureId: string;
  readonly recommended: boolean;
  readonly rawProbability: number;
  readonly calibratedProbability: number;
  readonly expectedValue: number;
  readonly confidence: number;
  readonly featureContribution: Record<string, number>;
  readonly riskScore: number;
  readonly stakeSize: number;
  readonly policyApplied: string;
  readonly decisionReason: string;
  readonly rejectedAlternatives: readonly string[];
  readonly evidenceLinks: readonly string[];
}

// ─── EPIC 20.8 — Decision Consistency Engine ─────────────────────────────

export interface ConsistencyResult {
  readonly dimension: string;
  readonly score: number;
  readonly driftDetected: boolean;
  readonly alert: string | null;
}

// ─── EPIC 20.9 — Performance Attribution ─────────────────────────────────

export interface AttributionResult {
  readonly factor: string;
  readonly contribution: number;
  readonly pct: number;
}

export interface AttributionReport {
  readonly attributionId: string;
  readonly results: readonly AttributionResult[];
  readonly generatedAt: string;
}

// ─── EPIC 20.10 — Decision Artifact Integration ─────────────────────────

export interface DecisionArtifact {
  readonly artifactId: string;
  readonly datasetId: string;
  readonly experimentId: string;
  readonly modelVersion: string;
  readonly decisionExplanation: DecisionExplanation;
  readonly timestamp: string;
  readonly immutable: true;
}

// ─── EPIC 20.11 — Decision Reporting ─────────────────────────────────────

export interface DecisionReport {
  readonly reportId: string;
  readonly generatedAt: string;
  readonly type: 'decision' | 'stake' | 'risk' | 'portfolio' | 'attribution' | 'consistency';
  readonly summary: string;
  readonly data: unknown;
}

// ─── EPIC 20.12 — Champion Decision Gate ─────────────────────────────────

export interface ChampionDecisionCriteria {
  readonly minExpectedValue: number;
  readonly minDecisionConsistency: number;
  readonly minStakeStability: number;
  readonly maxPortfolioRisk: number;
  readonly requireCalibrationPass: boolean;
  readonly requireFeatureValidation: boolean;
  readonly requireReplayValidation: boolean;
  readonly requireBaselineComparison: boolean;
}

export interface ChampionDecisionGateResult {
  readonly gate: string;
  readonly passed: boolean;
  readonly value: number;
  readonly threshold: number;
  readonly detail: string;
}

export interface ChampionDecisionGateDecision {
  readonly decisionId: string;
  readonly candidateBaselineId: string;
  readonly criteria: ChampionDecisionCriteria;
  readonly gates: readonly ChampionDecisionGateResult[];
  readonly passed: boolean;
  readonly decisionReport: string;
  readonly generatedAt: string;
}