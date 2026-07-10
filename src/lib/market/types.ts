/**
 * HandicapLab Market Framework — Core Types
 * ===========================================
 * The ProbabilityEngine produces a goal distribution (score matrix).
 * Each MarketTranslator converts that into market-specific probabilities.
 *
 * Adding a new market (Correct Score, Double Chance, etc.)
 * requires ONLY a new translator — no engine changes.
 */

export interface GoalDistribution {
  homeLambda: number;
  awayLambda: number;
  scoreMatrix: number[][];
  expectedGoals: number;
}

export interface MarketTranslationInput {
  goalDistribution: GoalDistribution;
  line?: number;
}

export interface MarketTranslationOutput {
  marketType: string;
  homeProbability: number;
  drawProbability: number | null;
  awayProbability: number;
  fairOdds: { home: number; draw: number | null; away: number };
  metadata?: Record<string, number>;
}

export interface SettlementInput {
  marketType: string;
  selection: string;
  line?: number;
  homeGoals: number;
  awayGoals: number;
}

export type SettlementResult = 'won' | 'lost' | 'void' | 'half_won' | 'half_lost';

export interface MarketDefinition {
  id: string;
  name: string;
  description: string;
  hasDraw: boolean;
  supportsLine: boolean;
  settlementRules: string;
}

export interface MarketMetadata {
  translatorVersion: string;
  timestamp: string;
  confidence: number;
}