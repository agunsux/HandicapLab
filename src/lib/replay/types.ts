/**
 * HandicapLab Replay Engine — Core Types
 * =========================================
 * Pure type definitions with zero production code dependencies.
 *
 * The Prediction Engine imports NOTHING from this module.
 * This module imports NOTHING from the Prediction Engine.
 * Integration happens ONLY through the provider interfaces.
 */

import { PredictionLedgerV3Record, PredictionSettlementV3Record } from '../data/predictionLedgerRepository';
import type { DatasetProvenance } from '../evidence-platform/types';

// ─── Match Data ──────────────────────────────────────────────────────────

export interface HistoricalFixture {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string; // ISO 8601
  leagueId: string;
  season: string;
  round?: string;
  status: 'scheduled' | 'finished' | 'postponed' | 'cancelled';
}

export interface HistoricalOdds {
  fixtureId: string;
  market: string;
  line?: number;
  openingHomeOdds?: number;
  openingDrawOdds?: number;
  openingAwayOdds?: number;
  closingHomeOdds?: number;
  closingDrawOdds?: number;
  closingAwayOdds?: number;
  homeOdds?: number;
  drawOdds?: number;
  awayOdds?: number;
  timestamp: string;
}

export interface HistoricalResult {
  fixtureId: string;
  homeGoals: number;
  awayGoals: number;
  status: 'finished' | 'postponed' | 'cancelled';
}

export interface HistoricalMatch {
  fixture: HistoricalFixture;
  odds: HistoricalOdds[];
  result?: HistoricalResult;
}

// ─── Replay Execution ────────────────────────────────────────────────────

export interface ReplayConfig {
  leagueId?: string;
  season?: string;
  startDate?: string;
  endDate?: string;
  marketTypes?: string[];
  kellyMultiplier?: number;
  maxMatches?: number;
}

export interface ReplayPredictionOutput {
  matchId: string;
  marketType: string;
  selection: string;
  homeProbability: number;
  drawProbability: number;
  awayProbability: number;
  expectedValue: number;
  kellyFraction: number;
  stake: number;
}

export interface ReplayOutcome {
  matchId: string;
  marketType: string;
  selection: string;
  predictedProbability: number;
  actualResult: number; // 1 = won, 0.5 = void, 0 = lost
  profitLoss: number;
  brierScore: number;
  logLoss: number;
  clv: number;
}

export interface ReplayMetrics {
  totalMatches: number;
  totalPredictions: number;
  won: number;
  lost: number;
  voided: number;
  roi: number;
  brierScore: number;
  logLoss: number;
  avgClv: number;
  winRate: number;
  totalStake: number;
  totalProfit: number;
}

export interface ReplayResult {
  id: string;
  config: ReplayConfig;
  context: ReplayContext;
  metrics: ReplayMetrics;
  outcomes: ReplayOutcome[];
  validationReport: ReplayValidationReport;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

export interface ReplayContext {
  executionId: string;
  correlationId: string;
  provider: string;
  leagueId?: string;
  season?: string;
  startDate?: string;
  endDate?: string;
  /**
   * Optional dataset provenance carried through replay for full auditability
   * (Historical Evidence Platform, Phase 4). Backward-compatible: existing
   * callers that omit this continue to work unchanged.
   */
  provenance?: DatasetProvenance;
}

export interface ReplayValidationReport {
  totalFixtures: number;
  validFixtures: number;
  invalidFixtures: number;
  missingOdds: number;
  missingResults: number;
  validationErrors: ReplayValidationError[];
}

export interface ReplayValidationError {
  fixtureId: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}