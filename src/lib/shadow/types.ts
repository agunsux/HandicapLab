/**
 * HandicapLab — Live Shadow Research Platform (EPIC 21)
 * =======================================================
 * Strongly-typed contracts for live shadow research — the platform that
 * executes predictions against LIVE fixtures without placing bets.
 *
 * Every prediction becomes immutable evidence. No orphan artifacts allowed.
 */

export const SHADOW_PLATFORM_VERSION = '1.0.0' as const;

export const SH_ID_PREFIX = {
  FIXTURE: 'shfix',
  SNAPSHOT: 'shsnap',
  ODDS: 'shodds',
  EVENT: 'shevent',
  RESULT: 'shres',
  EVALUATION: 'sheval',
  LEDGER: 'shledger',
  DASHBOARD: 'shdash',
  DRIFT: 'shdrift',
  VALIDATION: 'shval',
  REPORT: 'shrep',
  ARTIFACT: 'shart',
} as const;

// ─── 21.1 Live Fixture Queue ────────────────────────────────────────────

export type FixtureStatus = 'scheduled' | 'locked' | 'prediction_generated' | 'kickoff' | 'halftime' | 'finished' | 'cancelled' | 'postponed';

export interface ShadowFixture {
  readonly fixtureId: string;
  readonly externalId: string;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly competition: string;
  readonly season: string;
  readonly kickoff: string;
  readonly status: FixtureStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly provider: string;
}

export interface FixtureQueueState {
  readonly fixtures: readonly ShadowFixture[];
  readonly pendingCount: number;
  readonly lockedCount: number;
  readonly predictedCount: number;
  readonly finishedCount: number;
}

// ─── 21.2 Prediction Snapshot Engine ────────────────────────────────────

export interface PredictionSnapshot {
  readonly snapshotId: string;
  readonly fixtureId: string;
  readonly timestamp: string;
  readonly provider: string;
  readonly market: string;
  readonly homeOdds: number;
  readonly drawOdds: number | null;
  readonly awayOdds: number;
  readonly predictedHomeProb: number;
  readonly predictedDrawProb: number;
  readonly predictedAwayProb: number;
  readonly fairOdds: number;
  readonly expectedValue: number;
  readonly recommendedStake: number;
  readonly decisionPolicy: string;
  readonly featureValues: Record<string, number>;
  readonly calibrationVersion: string;
  readonly modelVersion: string;
  readonly experimentVersion: string;
  readonly researchManifest: string;
  readonly immutable: true;
}

// ─── 21.3 Odds Snapshot Timeline ────────────────────────────────────────

export interface OddsPoint {
  readonly timestamp: string;
  readonly homeOdds: number;
  readonly drawOdds: number | null;
  readonly awayOdds: number;
  readonly market: string;
  readonly provider: string;
}

export interface OddsTimeline {
  readonly fixtureId: string;
  readonly opening: OddsPoint | null;
  readonly current: OddsPoint | null;
  readonly closing: OddsPoint | null;
  readonly allPoints: readonly OddsPoint[];
  readonly openingClv: number;
  readonly currentClv: number;
  readonly marketMovement: number;
  readonly steamMovement: number;
}

// ─── 21.4 Live Market Monitor ───────────────────────────────────────────

export type MarketEventType = 'sharp_movement' | 'drift' | 'steam' | 'reversal' | 'bookmaker_disagreement' | 'consensus_change' | 'volatility';

export interface MarketEvent {
  readonly eventId: string;
  readonly fixtureId: string;
  readonly type: MarketEventType;
  readonly market: string;
  readonly timestamp: string;
  readonly beforeOdds: number;
  readonly afterOdds: number;
  readonly magnitude: number;
  readonly confidence: number;
  readonly description: string;
}

// ─── 21.5 Match Result Collector ────────────────────────────────────────

export interface MatchResult {
  readonly resultId: string;
  readonly fixtureId: string;
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly winner: 'home' | 'away' | 'draw' | null;
  readonly ahResult: string;
  readonly ouResult: string;
  readonly btts: boolean;
  readonly corners: number[];
  readonly cards: number[];
  readonly xg: number[] | null;
  readonly status: string;
  readonly collectedAt: string;
}

// ─── 21.6 Live Evaluation Engine ────────────────────────────────────────

export interface LiveEvaluationResult {
  readonly fixtureId: string;
  readonly market: string;
  readonly predictedProbability: number;
  readonly marketProbability: number;
  readonly closingOddsProbability: number;
  readonly actualResult: number;
  readonly correct: boolean;
  readonly roi: number;
  readonly yield_: number;
  readonly clv: number;
  readonly brierScore: number;
  readonly logLoss: number;
  readonly calibrationError: number;
  readonly expectedValueRealized: number;
  readonly kellyEfficiency: number;
  readonly edgeRealization: number;
  readonly decisionCorrect: boolean;
}

// ─── 21.7 Daily Research Ledger ─────────────────────────────────────────

export interface ResearchEntry {
  readonly entryId: string;
  readonly fixtureId: string;
  readonly snapshotId: string;
  readonly market: string;
  readonly predictedProb: number;
  readonly marketOdds: number;
  readonly stake: number;
  readonly actualResult: number;
  readonly profit: number;
  readonly closingOdds: number;
  readonly clv: number;
  readonly calibrationVersion: string;
  readonly policyUsed: string;
  readonly decisionTrace: readonly string[];
  readonly researchArtifactIds: readonly string[];
  readonly created_at: string;
  readonly immutable: true;
}

// ─── 21.8 Live Performance Dashboard Engine ────────────────────────────

export interface DashboardMetrics {
  readonly totalPredictions: number;
  readonly roi: number;
  readonly yield_: number;
  readonly clv: number;
  readonly winRate: number;
  readonly expectedValue: number;
  readonly calibration: number;
  readonly brierScore: number;
  readonly sharpeRatio: number;
  readonly kellyGrowth: number;
  readonly maxDrawdown: number;
  readonly averageEdge: number;
}

export interface DashboardBreakdown {
  readonly byRecommendation: Record<string, number>;
  readonly byLeague: Record<string, number>;
  readonly byMarket: Record<string, number>;
  readonly byPolicy: Record<string, number>;
}

export interface DashboardReport {
  readonly dashboardId: string;
  readonly generatedAt: string;
  readonly period: 'today' | 'week' | 'month' | 'season' | 'overall';
  readonly metrics: DashboardMetrics;
  readonly breakdown: DashboardBreakdown;
}

// ─── 21.9 Drift Detection ───────────────────────────────────────────────

export type DriftDimension = 'feature' | 'probability' | 'market' | 'decision' | 'calibration' | 'performance';

export interface DriftAlert {
  readonly dimension: DriftDimension;
  readonly severity: 'low' | 'medium' | 'high';
  readonly confidence: number;
  readonly value: number;
  readonly threshold: number;
  readonly recommendedAction: string;
}

export interface DriftReport {
  readonly driftId: string;
  readonly generatedAt: string;
  readonly alerts: readonly DriftAlert[];
  readonly overallDrift: boolean;
}

// ─── 21.10 Champion Validation ──────────────────────────────────────────

export type ChampionStatus = 'PASS' | 'WATCH' | 'FAIL';

export interface ChampionValidationGate {
  readonly gate: string;
  readonly value: number;
  readonly threshold: number;
  readonly passed: boolean;
}

export interface ChampionValidationResult {
  readonly validationId: string;
  readonly status: ChampionStatus;
  readonly gates: readonly ChampionValidationGate[];
  readonly message: string;
  readonly generatedAt: string;
}

// ─── 21.11 Research Reporting ───────────────────────────────────────────

export type ShadowReportType = 'daily' | 'weekly' | 'monthly' | 'research' | 'executive' | 'model' | 'decision' | 'calibration' | 'clv' | 'portfolio';

export interface ShadowReport {
  readonly reportId: string;
  readonly generatedAt: string;
  readonly type: ShadowReportType;
  readonly summary: string;
  readonly metrics: DashboardMetrics;
  readonly data: unknown;
}

// ─── 21.12 Artifact Integration ─────────────────────────────────────────

export interface ShadowArtifact {
  readonly artifactId: string;
  readonly fixtureId: string;
  readonly snapshotId: string;
  readonly evaluationId: string | null;
  readonly ledgerEntryId: string | null;
  readonly evidenceLink: string;
  readonly replayLink: string;
  readonly baselineLink: string;
  readonly probabilityLink: string;
  readonly featureLink: string;
  readonly decisionLink: string;
  readonly timestamp: string;
  readonly immutable: true;
}