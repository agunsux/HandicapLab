/**
 * HandicapLab — Baseline Validation Suite (EPIC 17)
 * ===================================================
 * Strongly-typed contracts for the Baseline Validation Suite.
 *
 * Builds ON TOP of the existing replay-lab and evidence-platform
 * without modifying any frozen modules.
 */

import type { BaselineId } from '../replay-lab/types';
import type { ReplayMetrics, ReplayOutcome, HistoricalMatch } from '../replay/types';

// ─── Architecture Constants ──────────────────────────────────────────────

export const BASELINE_VALIDATION_VERSION = '1.0.0' as const;

export const BV_ID_PREFIX = {
  SCENARIO: 'bvsc',
  RANKING: 'bvrnk',
  PROMOTION: 'bvprom',
  STABILITY: 'bvstab',
  REPORT: 'bvreport',
  ARTIFACT: 'bvart',
} as const;

// ─── EPIC 17.1 — Baseline Registry Extensions ───────────────────────────

export interface BaselineDescriptor {
  readonly id: BaselineId;
  readonly version: string;
  readonly description: string;
  readonly assumptions: readonly string[];
  readonly supportedMarkets: readonly string[];
  readonly requiresSeed: boolean;
  readonly category: 'model' | 'statistical' | 'heuristic' | 'market';
}

export const BUILTIN_BASELINE_DESCRIPTORS: readonly BaselineDescriptor[] = [
  { id: 'champion', version: '1.0.0', description: 'Current champion prediction engine', assumptions: ['Uses full feature set', 'Requires trained model'], supportedMarkets: ['ML', 'AH', 'OU'], requiresSeed: false, category: 'model' },
  { id: 'poisson', version: '1.0.0', description: 'Independent Poisson goals model', assumptions: ['Goals follow Poisson distribution', 'Home/away attack/defense strengths'], supportedMarkets: ['ML', 'OU'], requiresSeed: false, category: 'model' },
  { id: 'dixon_coles', version: '1.0.0', description: 'Dixon-Coles adjustment (low-score correlation)', assumptions: ['Poisson baseline + DC correction'], supportedMarkets: ['ML', 'OU'], requiresSeed: false, category: 'model' },
  { id: 'elo', version: '1.0.0', description: 'Elo rating system from odds-implied strength', assumptions: ['Elo ratings track team strength', 'Home advantage constant'], supportedMarkets: ['ML'], requiresSeed: false, category: 'statistical' },
  { id: 'closing_odds', version: '1.0.0', description: 'Market closing odds as probabilities', assumptions: ['Market is efficient at close', 'No biases in closing price'], supportedMarkets: ['ML', 'AH', 'OU'], requiresSeed: false, category: 'market' },
  { id: 'opening_odds', version: '1.0.0', description: 'Market opening odds as probabilities', assumptions: ['Market opening captures initial info'], supportedMarkets: ['ML', 'AH', 'OU'], requiresSeed: false, category: 'market' },
  { id: 'random', version: '1.0.0', description: 'Uniform random probabilities', assumptions: ['No predictive power', 'Baseline for minimum performance'], supportedMarkets: ['ML'], requiresSeed: true, category: 'heuristic' },
  { id: 'favorite', version: '1.0.0', description: 'Always backs the pre-match favorite', assumptions: ['Favorites win more often than not', 'Draw excluded'], supportedMarkets: ['ML'], requiresSeed: false, category: 'heuristic' },
  { id: 'underdog', version: '1.0.0', description: 'Always backs the pre-match underdog', assumptions: ['Underdogs provide positive EV'], supportedMarkets: ['ML'], requiresSeed: false, category: 'heuristic' },
  { id: 'flat_probability', version: '1.0.0', description: 'Constant probabilities (40/30/30)', assumptions: ['Home advantage worth ~10%'], supportedMarkets: ['ML'], requiresSeed: false, category: 'statistical' },
  { id: 'market_probability', version: '1.0.0', description: 'Market-implied probabilities (inverse)', assumptions: ['Market is weak-form efficient'], supportedMarkets: ['ML', 'AH', 'OU'], requiresSeed: false, category: 'market' },
];

// ─── EPIC 17.2 — Evaluation Protocol ─────────────────────────────────────

export interface BaselineEvaluationInput {
  readonly baselineId: BaselineId;
  readonly datasetId: string;
  readonly datasetFingerprint: string;
  readonly fixtures: readonly HistoricalMatch[];
  readonly walkForwardFolds: readonly { trainFixtureIds: readonly string[]; testFixtureIds: readonly string[] }[];
  readonly decisionRules: DecisionRules;
  readonly stakeSizing: StakeSizing;
}

export interface DecisionRules {
  readonly minOdds?: number;
  readonly maxOdds?: number;
  readonly minConfidence?: number;
  readonly minEdge?: number;
  readonly maxEdge?: number;
  readonly marketTypes: readonly string[];
}

export interface StakeSizing {
  readonly method: 'kelly' | 'flat' | 'percentage';
  readonly kellyMultiplier?: number;
  readonly flatStake?: number;
  readonly percentage?: number;
}

// ─── EPIC 17.3 — Research Scenario Engine ───────────────────────────────

export type ScenarioType =
  | 'single_season'
  | 'multi_season'
  | 'single_league'
  | 'multi_league'
  | 'home_only'
  | 'away_only'
  | 'favorites_only'
  | 'underdogs_only'
  | 'market_asian_handicap'
  | 'market_over_under'
  | 'market_moneyline'
  | 'min_odds_filter'
  | 'max_odds_filter'
  | 'confidence_filter'
  | 'ev_threshold';

export interface ScenarioConfig {
  readonly type: ScenarioType;
  readonly label: string;
  readonly seasonIds?: readonly string[];
  readonly leagueIds?: readonly string[];
  readonly minOdds?: number;
  readonly maxOdds?: number;
  readonly minConfidence?: number;
  readonly minExpectedValue?: number;
  readonly marketTypes?: readonly string[];
  readonly homeOnly?: boolean;
  readonly awayOnly?: boolean;
  readonly favoritesOnly?: boolean;
  readonly underdogsOnly?: boolean;
}

export interface ScenarioResult {
  readonly scenarioId: string;
  readonly config: ScenarioConfig;
  readonly baselineResults: readonly BaselineScenarioMetrics[];
  readonly generatedAt: string;
}

export interface BaselineScenarioMetrics {
  readonly baselineId: BaselineId;
  readonly metrics: ReplayMetrics;
  readonly detailed: EvaluationMetricsResult;
}

// ─── EPIC 17.4 — Evaluation Metrics Engine ──────────────────────────────

export interface EvaluationMetricsResult {
  readonly roi: number;
  readonly yield_: number;
  readonly netProfit: number;
  readonly expectedValue: number;
  readonly closingLineValue: number;
  readonly hitRate: number;
  readonly winRate: number;
  readonly lossRate: number;
  readonly pushRate: number;
  readonly brierScore: number;
  readonly logLoss: number;
  readonly calibrationError: number;
  readonly maxDrawdown: number;
  readonly profitFactor: number;
  readonly sharpeRatio: number;
  readonly sortinoRatio: number;
  readonly kellyGrowth: number;
  readonly averageOdds: number;
  readonly betFrequency: number;
  readonly expectedVsActual: number;
}

// ─── EPIC 17.5 — Statistical Comparison ─────────────────────────────────

export interface StatisticalComparisonResult {
  readonly baselineA: BaselineId;
  readonly baselineB: BaselineId;
  readonly metricName: string;
  readonly valueA: number;
  readonly valueB: number;
  readonly delta: number;
  readonly bootstrapCiLower: number;
  readonly bootstrapCiUpper: number;
  readonly pValue: number;
  readonly effectSize: number;
  readonly significant: boolean;
  readonly practicallySignificant: boolean;
  readonly confidenceLevel: number;
}

// ─── EPIC 17.6 — Ranking Engine ─────────────────────────────────────────

export interface RankingCriteria {
  readonly statisticalSignificance: number;  // weight
  readonly roi: number;
  readonly clv: number;
  readonly calibration: number;
  readonly stability: number;
  readonly drawdown: number;
  readonly sampleSize: number;
}

export interface RankingEntry {
  readonly baselineId: BaselineId;
  readonly compositeScore: number;
  readonly breakdown: Record<string, number>;
  readonly rank: number;
}

export interface RankingReport {
  readonly rankingId: string;
  readonly criteria: RankingCriteria;
  readonly entries: readonly RankingEntry[];
  readonly generatedAt: string;
}

// ─── EPIC 17.7 — Champion Validation ────────────────────────────────────

export interface ChampionPromotionCriteria {
  readonly minRoiCiLower: number;
  readonly minClv: number;
  readonly maxEce: number;
  readonly minSampleSize: number;
  readonly requireWalkForwardSuccess: boolean;
  readonly requireNoLeakage: boolean;
  readonly minIntegrityScore: number;
  readonly maxDrawdownPct: number;
}

export interface PromotionGatesResult {
  readonly gate: string;
  readonly passed: boolean;
  readonly value: number;
  readonly threshold: number;
  readonly detail: string;
}

export interface ChampionPromotionDecision {
  readonly promotionId: string;
  readonly candidateBaselineId: BaselineId;
  readonly sessionId: string;
  readonly criteria: ChampionPromotionCriteria;
  readonly gates: readonly PromotionGatesResult[];
  readonly passed: boolean;
  readonly recommended: boolean;
  readonly decisionReport: string;
  readonly generatedAt: string;
}

// ─── EPIC 17.8 — Stability Analysis ─────────────────────────────────────

export interface StabilityDimension {
  readonly dimension: string;
  readonly segments: readonly StabilitySegment[];
  readonly stabilityScore: number;
  readonly degradationDetected: boolean;
}

export interface StabilitySegment {
  readonly label: string;
  readonly roi: number;
  readonly brierScore: number;
  readonly sampleSize: number;
}

export interface StabilityReport {
  readonly stabilityId: string;
  readonly baselineId: BaselineId;
  readonly dimensions: readonly StabilityDimension[];
  readonly overallStabilityScore: number;
  readonly generatedAt: string;
}

// ─── EPIC 17.9 — Benchmark Report ───────────────────────────────────────

export interface BenchmarkReport {
  readonly reportId: string;
  readonly generatedAt: string;
  readonly executiveSummary: string;
  readonly datasets: readonly string[];
  readonly replaySessions: readonly string[];
  readonly baselines: readonly BaselineId[];
  readonly evaluationMetrics: readonly BaselineScenarioMetrics[];
  readonly confidenceIntervals: readonly StatisticalComparisonResult[];
  readonly calibration: Record<string, number>;
  readonly ranking: RankingReport | null;
  readonly championDecision: ChampionPromotionDecision | null;
  readonly scenarioResults: readonly ScenarioResult[];
  readonly evidenceLinks: readonly string[];
  readonly datasetFingerprints: readonly string[];
  readonly modelVersions: readonly string[];
  readonly recommendations: readonly string[];
}

// ─── EPIC 17.10 — Research Artifact Integration ─────────────────────────

export interface ValidationArtifact {
  readonly artifactId: string;
  readonly benchmarkReportId: string;
  readonly datasetId: string;
  readonly evidenceArtifactId: string;
  readonly replaySessionId: string;
  readonly experimentId: string;
  readonly modelVersion: string;
  readonly featureVersion: string;
  readonly evaluationHash: string;
  readonly championDecisionId: string | null;
  readonly researchReportId: string | null;
  readonly timestamp: string;
  readonly immutable: true;
}