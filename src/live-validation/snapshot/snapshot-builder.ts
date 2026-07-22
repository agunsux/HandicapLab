// EPIC 35.2 — Immutable Prediction Snapshot Builder
// Invokes the existing prediction engine (generatePrediction) WITHOUT
// modifying it, and freezes the full result into an append-only,
// chain-hashed snapshot. Snapshots can never be edited — only appended.

import * as crypto from 'crypto';
import { generatePrediction, type MatchInput, type PredictionOutput } from '../../services/probability.engine';
import { removeVig } from '../../lib/math/metrics';
import type {
  LiveFixture,
  FixtureOddsSet,
  MarketQuote,
  MarketRecommendation,
  PredictionSnapshotRecord,
  LiveMarketKind,
  LiveSelection,
} from '../types';

export interface ModelVersionInfo {
  modelVersion: string;
  featureVersion: string;
  calibrationVersion: string;
  researchManifestVersion: string;
  gitCommit: string;
}

export interface SnapshotBuildInput {
  fixture: LiveFixture;
  odds: FixtureOddsSet;
  versions: ModelVersionInfo;
  /** Deterministic timestamp of prediction generation (ISO) */
  now: string;
  /** Correlation id of the scheduler run */
  correlationId: string;
  /** Chain link to the previous snapshot (null = genesis) */
  previousSnapshot: { id: string; chainHash: string } | null;
  /** Minimum EV for a recommendation to become an actionable bet */
  minExpectedValue: number;
  schemaVersion: string;
  /** Deterministic id factory (injectable for replay tests) */
  idFactory?: () => string;
}

export function sha256(payload: string): string {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function predictionIdempotencyKey(fixtureId: string, modelVersion: string): string {
  return `prediction:${fixtureId}:${modelVersion}`;
}

function findQuote(odds: FixtureOddsSet, market: LiveMarketKind): MarketQuote | null {
  return odds.quotes.find(q => q.market === market) ?? null;
}

/** Vig-removed implied probability of one side of a 2-way or 3-way quote. */
export function impliedProb(quote: MarketQuote, selection: LiveSelection): number {
  if (quote.market === 'moneyline' && quote.priceDraw !== null) {
    const fair = removeVig(quote.priceHome, quote.priceDraw, quote.priceAway);
    if (selection === 'home') return fair.homeProb;
    if (selection === 'draw') return fair.drawProb;
    return fair.awayProb;
  }
  const invHome = 1 / quote.priceHome;
  const invAway = 1 / quote.priceAway;
  const total = invHome + invAway;
  const homeSide = selection === 'home' || selection === 'over';
  return (homeSide ? invHome : invAway) / total;
}

function selectionOdds(quote: MarketQuote, selection: LiveSelection): number {
  if (selection === 'draw') return quote.priceDraw ?? 0;
  return selection === 'home' || selection === 'over' ? quote.priceHome : quote.priceAway;
}

/** Choose the better side of a market by expected value. */
function buildRecommendation(
  market: LiveMarketKind,
  quote: MarketQuote | null,
  modelProbs: Partial<Record<LiveSelection, number>>,
  minExpectedValue: number
): MarketRecommendation | null {
  if (!quote) return null;

  const candidates: LiveSelection[] =
    market === 'moneyline'
      ? ['home', 'draw', 'away']
      : market === 'over_under'
        ? ['over', 'under']
        : ['home', 'away'];

  let best: MarketRecommendation | null = null;
  for (const selection of candidates) {
    const modelProb = modelProbs[selection];
    const odds = selectionOdds(quote, selection);
    if (modelProb === undefined || odds <= 1.0) continue;

    const marketProb = impliedProb(quote, selection);
    const edge = modelProb - marketProb;
    const expectedValue = modelProb * odds - 1;

    const candidate: MarketRecommendation = {
      market,
      selection,
      line: quote.line,
      modelProb: Number(modelProb.toFixed(4)),
      marketProb: Number(marketProb.toFixed(4)),
      odds,
      edge: Number(edge.toFixed(4)),
      expectedValue: Number(expectedValue.toFixed(4)),
      action: expectedValue >= minExpectedValue ? 'bet' : 'no_bet',
    };

    if (!best || candidate.expectedValue > best.expectedValue) {
      best = candidate;
    }
  }
  return best;
}

/** Map live fixture + odds onto the frozen model's MatchInput contract. */
export function buildMatchInput(fixture: LiveFixture, odds: FixtureOddsSet): MatchInput {
  const ml = findQuote(odds, 'moneyline');
  const ah = findQuote(odds, 'asian_handicap');
  const ou = findQuote(odds, 'over_under');

  return {
    matchId: fixture.fixtureId,
    odds_home: ml?.priceHome ?? 2.0,
    odds_draw: ml?.priceDraw ?? 3.5,
    odds_away: ml?.priceAway ?? 2.0,
    ah_line: ah?.line ?? 0,
    ou_line: ou?.line ?? 2.5,
    btts_odds: 2.0,
    xg_home: 1.35,
    xg_away: 1.15,
    shots_home: 12,
    shots_away: 10,
    shots_on_target_home: 4,
    shots_on_target_away: 3.5,
    form_home: 0.5,
    form_away: 0.5,
  };
}

/** Build the complete immutable prediction snapshot for one fixture. */
export function buildPredictionSnapshot(input: SnapshotBuildInput): PredictionSnapshotRecord {
  const { fixture, odds, versions, now, correlationId, previousSnapshot } = input;
  const idFactory = input.idFactory ?? (() => crypto.randomUUID());

  const matchInput = buildMatchInput(fixture, odds);
  const modelOutput: PredictionOutput = generatePrediction(matchInput);

  const ah = buildRecommendation(
    'asian_handicap',
    findQuote(odds, 'asian_handicap'),
    { home: modelOutput.ah_home_prob, away: modelOutput.ah_away_prob },
    input.minExpectedValue
  );
  const ou = buildRecommendation(
    'over_under',
    findQuote(odds, 'over_under'),
    { over: modelOutput.ou_over_prob, under: modelOutput.ou_under_prob },
    input.minExpectedValue
  );
  const ml = buildRecommendation(
    'moneyline',
    findQuote(odds, 'moneyline'),
    { home: modelOutput.ml_home_prob, draw: modelOutput.ml_draw_prob, away: modelOutput.ml_away_prob },
    input.minExpectedValue
  );

  const bestEv = Math.max(
    ah?.expectedValue ?? -1,
    ou?.expectedValue ?? -1,
    ml?.expectedValue ?? -1
  );

  const inputHash = sha256(
    JSON.stringify({ matchInput, fixtureId: fixture.fixtureId, kickoff: fixture.kickoff })
  );

  const base: Omit<PredictionSnapshotRecord, 'chainHash'> = {
    id: idFactory(),
    fixture: { ...fixture },
    model: {
      modelVersion: versions.modelVersion,
      featureVersion: versions.featureVersion,
      calibrationVersion: versions.calibrationVersion,
      researchManifestVersion: versions.researchManifestVersion,
      gitCommit: versions.gitCommit,
      predictionTimestamp: now,
    },
    prediction: {
      homeProb: modelOutput.ml_home_prob,
      drawProb: modelOutput.ml_draw_prob,
      awayProb: modelOutput.ml_away_prob,
      expectedGoalsHome: modelOutput.expected_goals_home,
      expectedGoalsAway: modelOutput.expected_goals_away,
      asianHandicap: ah,
      overUnder: ou,
      moneyline: ml,
      confidence: modelOutput.final_confidence,
      expectedValue: Number(bestEv.toFixed(4)),
    },
    market: {
      predictionOdds: odds.quotes.map(q => ({ ...q })),
    },
    idempotencyKey: predictionIdempotencyKey(fixture.fixtureId, versions.modelVersion),
    inputHash,
    previousSnapshotId: previousSnapshot?.id ?? null,
    createdAt: now,
    createdBy: 'scheduler',
    schemaVersion: input.schemaVersion,
    correlationId,
  };

  const chainHash = sha256(
    `${previousSnapshot?.chainHash ?? 'genesis'}::${sha256(JSON.stringify(base))}`
  );

  return Object.freeze({ ...base, chainHash });
}
