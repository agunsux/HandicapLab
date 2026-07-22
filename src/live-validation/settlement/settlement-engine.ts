// EPIC 35.4 — Automatic Settlement Engine
// When official results become available: detect completion, retrieve the
// final score, resolve outcomes (incl. Asian quarter-lines), compute
// profit/loss, ROI and CLV, and append immutable settlement records.
//
// Settlement is idempotent: one settlement per prediction+market, ever.

import * as crypto from 'crypto';
import type {
  LiveMarketKind,
  LiveSelection,
  PredictionSnapshotRecord,
  SettlementOutcome,
  SettlementRecordLV,
  SettlementRunReport,
  MarketRecommendation,
} from '../types';
import type { LiveValidationStore } from '../store/types';
import type { LiveValidationConfig } from '../config';
import type { Clock } from '../scheduler/prediction-scheduler';

/** Result source contract — returns final scores for finished fixtures. */
export interface LiveResultSource {
  getResult(fixtureId: string): Promise<{ homeScore: number; awayScore: number } | null>;
}

export function settlementIdempotencyKey(predictionId: string, market: LiveMarketKind): string {
  return `settlement:${predictionId}:${market}`;
}

/** Resolve a single (half-integer or integer) line to a win fraction. */
function resolveSimpleLine(
  market: LiveMarketKind,
  line: number,
  selection: LiveSelection,
  homeScore: number,
  awayScore: number
): number {
  const goalDiff = homeScore - awayScore;
  const totalGoals = homeScore + awayScore;

  switch (market) {
    case 'moneyline': {
      if (selection === 'home') return homeScore > awayScore ? 1 : 0;
      if (selection === 'away') return awayScore > homeScore ? 1 : 0;
      return homeScore === awayScore ? 1 : 0;
    }
    case 'asian_handicap': {
      const adjusted = selection === 'home' ? goalDiff + line : -goalDiff + line;
      if (adjusted > 0) return 1;
      if (adjusted === 0) return 0.5; // push
      return 0;
    }
    case 'over_under': {
      if (selection === 'over') {
        if (totalGoals > line) return 1;
        if (totalGoals === line) return 0.5;
        return 0;
      }
      if (totalGoals < line) return 1;
      if (totalGoals === line) return 0.5;
      return 0;
    }
  }
}

/** Resolve outcome, supporting Asian quarter-lines by splitting the stake. */
export function resolveOutcome(
  market: LiveMarketKind,
  line: number,
  selection: LiveSelection,
  homeScore: number,
  awayScore: number
): { outcome: SettlementOutcome; winFraction: number } {
  const isQuarterLine =
    (market === 'asian_handicap' || market === 'over_under') &&
    Math.abs((line * 4) % 2) === 1; // .25 / .75 lines

  let winFraction: number;
  if (isQuarterLine) {
    const lower = line - 0.25;
    const upper = line + 0.25;
    const a = resolveSimpleLine(market, lower, selection, homeScore, awayScore);
    const b = resolveSimpleLine(market, upper, selection, homeScore, awayScore);
    winFraction = (a + b) / 2;
  } else {
    winFraction = resolveSimpleLine(market, line, selection, homeScore, awayScore);
  }

  let outcome: SettlementOutcome;
  if (winFraction === 1) outcome = 'win';
  else if (winFraction === 0.75) outcome = 'half_win';
  else if (winFraction === 0.5) outcome = 'push';
  else if (winFraction === 0.25) outcome = 'half_loss';
  else outcome = 'loss';

  return { outcome, winFraction };
}

/** Units returned (incl. stake) for a stake at given odds and win fraction.
 *  winFraction semantics: 1 win, 0.5 push, 0 loss, 0.75/0.25 half outcomes. */
export function computeReturn(stake: number, odds: number, winFraction: number): number {
  if (winFraction === 1) return stake * odds;
  if (winFraction === 0.5) return stake; // push refunds stake
  if (winFraction === 0.75) return stake / 2 + (stake / 2) * odds; // half win
  if (winFraction === 0.25) return stake / 2; // half loss
  return 0;
}

export class SettlementEngine {
  constructor(
    private deps: {
      store: LiveValidationStore;
      results: LiveResultSource;
      config: LiveValidationConfig;
      clock?: Clock;
      idFactory?: () => string;
    }
  ) {}

  private now(): Date {
    return this.deps.clock ? this.deps.clock() : new Date();
  }

  private newId(): string {
    return this.deps.idFactory ? this.deps.idFactory() : crypto.randomUUID();
  }

  /** Settle all unsettled predictions whose fixtures have final results. */
  async run(): Promise<SettlementRunReport> {
    const { store } = this.deps;
    const runId = this.newId();
    const startedAt = this.now().toISOString();

    const report: SettlementRunReport = {
      runId,
      startedAt,
      finishedAt: startedAt,
      candidates: 0,
      settled: 0,
      duplicatesSkipped: 0,
      failures: [],
      success: true,
    };

    const predictions = await store.listPredictions();

    for (const prediction of predictions) {
      const recs = this.activeRecommendations(prediction);
      if (recs.length === 0) continue;

      const pendingMarkets: MarketRecommendation[] = [];
      for (const rec of recs) {
        if (!(await store.hasSettlementForPrediction(prediction.id, rec.market))) {
          pendingMarkets.push(rec);
        } else {
          report.duplicatesSkipped++;
        }
      }
      if (pendingMarkets.length === 0) continue;

      report.candidates++;

      try {
        const result = await this.deps.results.getResult(prediction.fixture.fixtureId);
        if (!result) continue; // not finished yet — settle on a later run

        for (const rec of pendingMarkets) {
          await this.settleMarket(prediction, rec, result, runId);
          report.settled++;
        }
      } catch (err) {
        report.success = false;
        report.failures.push({
          predictionId: prediction.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    report.finishedAt = this.now().toISOString();
    return report;
  }

  /** Recommendations with action === 'bet' are the validated positions. */
  private activeRecommendations(prediction: PredictionSnapshotRecord): MarketRecommendation[] {
    return [
      prediction.prediction.asianHandicap,
      prediction.prediction.overUnder,
      prediction.prediction.moneyline,
    ].filter((r): r is MarketRecommendation => r !== null && r.action === 'bet');
  }

  private async settleMarket(
    prediction: PredictionSnapshotRecord,
    rec: MarketRecommendation,
    result: { homeScore: number; awayScore: number },
    correlationId: string
  ): Promise<void> {
    const { store, config } = this.deps;
    const idempotencyKey = settlementIdempotencyKey(prediction.id, rec.market);

    // Idempotency — never settle the same prediction+market twice
    if (await store.getSettlementByIdempotencyKey(idempotencyKey)) return;

    const { outcome, winFraction } = resolveOutcome(
      rec.market,
      rec.line,
      rec.selection,
      result.homeScore,
      result.awayScore
    );

    const stake = config.stakeUnits;
    const unitsReturned = computeReturn(stake, rec.odds, winFraction);
    const profit = Number((unitsReturned - stake).toFixed(4));

    const closing = await store.getOddsByPhase(
      prediction.fixture.fixtureId,
      rec.market,
      rec.line,
      'closing'
    );
    let closingOdds: number | null = null;
    if (closing) {
      const q = closing.quote;
      closingOdds =
        rec.selection === 'draw'
          ? q.priceDraw
          : rec.selection === 'home' || rec.selection === 'over'
            ? q.priceHome
            : q.priceAway;
    }
    const clv =
      closingOdds !== null && closingOdds > 1.0
        ? Number((rec.odds / closingOdds - 1).toFixed(4))
        : null;

    const settledAt = this.now().toISOString();
    const record: SettlementRecordLV = {
      id: this.newId(),
      predictionId: prediction.id,
      fixtureId: prediction.fixture.fixtureId,
      league: prediction.fixture.league,
      market: rec.market,
      selection: rec.selection,
      line: rec.line,
      stake,
      oddsTaken: rec.odds,
      closingOdds,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      outcome,
      unitsReturned: Number(unitsReturned.toFixed(4)),
      profit,
      roi: Number((profit / stake).toFixed(4)),
      clv,
      settledAt,
      idempotencyKey,
      createdAt: settledAt,
      createdBy: 'settlement-engine',
      schemaVersion: config.schemaVersion,
      correlationId,
    };

    await store.appendSettlement(record);
  }
}
