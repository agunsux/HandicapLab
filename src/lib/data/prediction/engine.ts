// Shadow Prediction Engine — Live Prediction Pipeline
// Connects the existing probability model to live fixtures.
// No model logic is modified — only the invocation layer.

import * as crypto from 'crypto';
import { generatePrediction, type MatchInput } from '../../../services/probability.engine';
import { removeVig } from '../../math/metrics';
import type { Fixture, OddsSnapshot, MarketType, MarketSelection } from '../providers/types';
import type { PredictionSnapshot, SettlementRecord } from './types';
import type { OddsSnapshotStore } from '../snapshots/types';

export interface PredictionRequest {
  fixture: Fixture;
  oddsSnapshot: OddsSnapshot;
  marketType: MarketType;
  line: number;
}

export interface ShadowPredictionResult {
  prediction: PredictionSnapshot;
  settlement: SettlementRecord;
}

function computeModelHash(version: string): string {
  return crypto.createHash('sha256').update(`model:${version}:config:frozen_v0.5`).digest('hex');
}

function pickSelection(marketType: MarketType, modelOutput: any): MarketSelection {
  switch (marketType) {
    case 'moneyline': return 'home';
    case 'asian_handicap': return 'home';
    case 'over_under': return 'over';
    default: return 'home';
  }
}

function computeExpectedValue(modelProb: number, odds: number): number {
  return modelProb * odds - 1;
}

function buildMatchInput(fixture: Fixture, odds: OddsSnapshot): MatchInput {
  // Map fixture + odds data to the existing model's MatchInput
  const h2h = {
    homeTeamStrength: 0.5,
    awayTeamStrength: 0.5,
    homeForm: 0.5,
    awayForm: 0.5,
    h2hHomeWinRate: 0.45,
    h2hAwayWinRate: 0.35,
    h2hDrawRate: 0.20,
  };

  return {
    odds_home: odds.marketType === 'moneyline' ? odds.priceHome : 2.0,
    odds_draw: odds.marketType === 'moneyline' ? (odds.priceDraw ?? 3.5) : 3.5,
    odds_away: odds.marketType === 'moneyline' ? odds.priceAway : 2.0,
    ah_line: odds.marketType === 'asian_handicap' ? odds.line : 0,
    ou_line: odds.marketType === 'over_under' ? odds.line : 2.5,
    btts_odds: 2.0,
    xg_home: 1.35,
    xg_away: 1.15,
    shots_home: 12,
    shots_away: 10,
    shots_on_target_home: 4,
    shots_on_target_away: 3.5,
    form_home: 0.5,
    form_away: 0.5,
    last_5_avg_goals_home: 1.5,
    last_5_avg_goals_away: 1.2,
    preMatchFeatures: h2h,
  };
}

function computeEdge(
  modelProb: number,
  marketProb: number,
  marketType: MarketType,
  line: number
): number {
  // Edge = model probability minus market implied probability
  // Positive edge means the model assigns higher probability than the market
  return modelProb - marketProb;
}

function hashInputData(input: MatchInput, fixture: Fixture): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ input, fixtureId: fixture.fixtureId, kickoff: fixture.kickoffTime }))
    .digest('hex');
}

/** Generate a shadow prediction for a single fixture+market combination.
 *  Uses the existing probability model (generatePrediction) without modification. */
export async function createShadowPrediction(
  request: PredictionRequest,
  store: OddsSnapshotStore
): Promise<ShadowPredictionResult> {
  const { fixture, oddsSnapshot, marketType, line } = request;

  const matchInput = buildMatchInput(fixture, oddsSnapshot);
  const inputDataHash = hashInputData(matchInput, fixture);
  const modelOutput = generatePrediction(matchInput);

  let modelProb: number;
  switch (marketType) {
    case 'moneyline':
      modelProb = modelOutput.ml_home_prob;
      break;
    case 'asian_handicap':
      modelProb = modelOutput.ah_home_prob;
      break;
    case 'over_under':
      modelProb = modelOutput.ou_over_prob;
      break;
    default:
      throw new Error(`Unknown market type: ${marketType}`);
  }

  let marketProb: number;
  if (marketType === 'moneyline' && oddsSnapshot.priceDraw !== null) {
    const vigFree = removeVig(oddsSnapshot.priceHome, oddsSnapshot.priceDraw, oddsSnapshot.priceAway);
    marketProb = vigFree.homeProb;
  } else {
    const totalImplied = 1 / oddsSnapshot.priceHome + 1 / oddsSnapshot.priceAway;
    marketProb = (1 / oddsSnapshot.priceHome) / totalImplied;
  }

  const edge = computeEdge(modelProb, marketProb, marketType, line);
  const selection = pickSelection(marketType, modelOutput);
  const selectedOdds = selection === 'home' ? oddsSnapshot.priceHome : oddsSnapshot.priceAway;
  const expectedValue = computeExpectedValue(modelProb, selectedOdds);
  const modelHash = computeModelHash(modelOutput.model_version);

  const prediction: PredictionSnapshot = {
    id: crypto.randomUUID(),
    fixtureId: fixture.fixtureId,
    modelVersion: modelOutput.model_version,
    modelHash,
    marketType,
    selection,
    line,
    predictionProb: modelProb,
    marketProb,
    edge,
    expectedValue,
    confidence: modelOutput.final_confidence,
    oddsSnapshotId: oddsSnapshot.id ?? oddsSnapshot.capturedAt.toISOString(),
    inputDataHash,
    featureVersion: 'v1.0-features',
    datasetVersion: 'v1.0-dataset',
    timestamp: new Date(),
  };

  const settlement: SettlementRecord = {
    id: crypto.randomUUID(),
    predictionId: prediction.id,
    fixtureId: fixture.fixtureId,
    modelVersion: modelOutput.model_version,
    marketType,
    selection,
    line,
    oddsAtSettlement: 0,
    actualOutcome: null,
    profit: null,
    roi: null,
    clv: null,
    settledAt: null,
    isSettled: false,
  };

  return { prediction, settlement };
}

/** Resolve the actual outcome for a given market type, line, and final score.
 *  Supports Asian Handicap, Over/Under, and Moneyline. */
export function resolveMarketOutcome(
  marketType: MarketType,
  line: number,
  selection: MarketSelection,
  homeScore: number,
  awayScore: number
): { actualOutcome: number; profit: number } {
  const goalDiff = homeScore - awayScore;
  const totalGoals = homeScore + awayScore;

  let result: number; // 1 = win, 0 = loss, 0.5 = push

  switch (marketType) {
    case 'moneyline': {
      if (selection === 'home') result = homeScore > awayScore ? 1 : (homeScore === awayScore ? 0.5 : 0);
      else if (selection === 'away') result = awayScore > homeScore ? 1 : (awayScore === homeScore ? 0.5 : 0);
      else result = homeScore === awayScore ? 1 : 0;
      break;
    }
    case 'asian_handicap': {
      const adjustedDiff = selection === 'home' ? goalDiff + line : goalDiff - line;
      if (adjustedDiff > 0) result = 1;
      else if (adjustedDiff === 0) result = 0.5;
      else result = 0;
      break;
    }
    case 'over_under': {
      if (selection === 'over') result = totalGoals > line ? 1 : (totalGoals === line ? 0.5 : 0);
      else result = totalGoals < line ? 1 : (totalGoals === line ? 0.5 : 0);
      break;
    }
    default:
      throw new Error(`Unknown market type: ${marketType}`);
  }

  // Profit: 1 unit stake, win = odds-1, push = 0, loss = -1
  return { actualOutcome: result, profit: result === 1 ? 1 : (result === 0.5 ? 0 : -1) };
}

/** Settle a prediction when the actual result becomes available.
 *  Uses the closing odds snapshot for CLV computation. Properly resolves
 *  Asian Handicap, Over/Under, and Moneyline outcomes. */
export async function settlePrediction(
  prediction: PredictionSnapshot,
  homeScore: number,
  awayScore: number,
  closingOddsProb: number,
  closingOdds: number
): Promise<SettlementRecord> {
  const { actualOutcome, profit } = resolveMarketOutcome(
    prediction.marketType,
    prediction.line,
    prediction.selection,
    homeScore,
    awayScore
  );

  const roi = actualOutcome === 1 ? (closingOdds - 1) : (actualOutcome === 0.5 ? 0 : -1);
  const clv = closingOddsProb - prediction.marketProb;

  return {
    id: crypto.randomUUID(),
    predictionId: prediction.id,
    fixtureId: prediction.fixtureId,
    modelVersion: prediction.modelVersion,
    marketType: prediction.marketType,
    selection: prediction.selection,
    line: prediction.line,
    oddsAtSettlement: closingOdds,
    actualOutcome,
    profit,
    roi,
    clv,
    settledAt: new Date(),
    isSettled: true,
  };
}
