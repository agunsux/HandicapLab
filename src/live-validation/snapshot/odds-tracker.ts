// EPIC 35.3 — Odds Tracking
// Captures opening → prediction-time → closing odds as append-only,
// chain-hashed snapshots and derives CLV, line movement, steam movement
// and market efficiency. Pure observation — nothing feeds back into models.

import * as crypto from 'crypto';
import type {
  FixtureOddsSet,
  LiveMarketKind,
  MarketMovement,
  MarketQuote,
  OddsPhase,
  OddsSnapshotRecordLV,
  PredictionSnapshotRecord,
} from '../types';
import type { LiveValidationStore } from '../store/types';
import { sha256, impliedProb } from './snapshot-builder';

export interface OddsCaptureResult {
  captured: number;
  fixtureId: string;
  phase: OddsPhase;
}

export class OddsTracker {
  constructor(
    private store: LiveValidationStore,
    private options: {
      steamThreshold: number;
      schemaVersion: string;
      idFactory?: () => string;
    }
  ) {}

  private newId(): string {
    return this.options.idFactory ? this.options.idFactory() : crypto.randomUUID();
  }

  /** Capture a full odds set for a fixture at a given phase. Append-only. */
  async capture(
    odds: FixtureOddsSet,
    phase: OddsPhase,
    correlationId: string
  ): Promise<OddsCaptureResult> {
    let previous = await this.store.getLastOddsSnapshot(odds.fixtureId);
    let captured = 0;

    for (const quote of odds.quotes) {
      const base: Omit<OddsSnapshotRecordLV, 'chainHash'> = {
        id: this.newId(),
        fixtureId: odds.fixtureId,
        phase,
        quote: { ...quote },
        capturedAt: odds.capturedAt,
        previousSnapshotId: previous?.id ?? null,
        createdAt: odds.capturedAt,
        createdBy: 'odds-tracker',
        schemaVersion: this.options.schemaVersion,
        correlationId,
      };
      const record: OddsSnapshotRecordLV = {
        ...base,
        chainHash: sha256(
          `${previous?.chainHash ?? 'genesis'}::${sha256(JSON.stringify(base))}`
        ),
      };
      await this.store.appendOddsSnapshot(record);
      previous = record;
      captured++;
    }

    return { captured, fixtureId: odds.fixtureId, phase };
  }

  /** Derive movement analytics for one fixture+market across phases. */
  async computeMovement(
    fixtureId: string,
    market: LiveMarketKind,
    line: number,
    recommendedSelection: 'home' | 'draw' | 'away' | 'over' | 'under' | null,
    oddsTaken: number | null
  ): Promise<MarketMovement> {
    const opening = await this.store.getOddsByPhase(fixtureId, market, line, 'opening');
    const prediction = await this.store.getOddsByPhase(fixtureId, market, line, 'prediction');
    const closing = await this.store.getOddsByPhase(fixtureId, market, line, 'closing');

    const sideOdds = (q: MarketQuote | undefined, sel: string | null): number | null => {
      if (!q || !sel) return null;
      if (sel === 'draw') return q.priceDraw;
      return sel === 'home' || sel === 'over' ? q.priceHome : q.priceAway;
    };

    const openingOdds = sideOdds(opening?.quote, recommendedSelection ?? 'home');
    const predictionOdds = sideOdds(prediction?.quote, recommendedSelection ?? 'home');
    const closingOdds = sideOdds(closing?.quote, recommendedSelection ?? 'home');

    // CLV: positive when the odds we took beat the closing price
    const taken = oddsTaken ?? predictionOdds;
    const clv =
      taken !== null && closingOdds !== null && closingOdds > 1.0
        ? Number((taken / closingOdds - 1).toFixed(4))
        : null;

    // Line movement: implied prob shift for ML, line shift proxy for AH/OU
    let lineMovement: number | null = null;
    if (opening && closing && recommendedSelection) {
      const pOpen = impliedProb(opening.quote, recommendedSelection);
      const pClose = impliedProb(closing.quote, recommendedSelection);
      lineMovement = Number((pClose - pOpen).toFixed(4));
    }

    // Steam: odds shortened beyond threshold between opening and closing
    let steamMove = false;
    if (openingOdds !== null && closingOdds !== null && openingOdds > 1.0) {
      steamMove = (openingOdds - closingOdds) / openingOdds > this.options.steamThreshold;
    }

    // Market efficiency: 1 - overround of the closing quote
    let marketEfficiency: number | null = null;
    const effQuote = closing?.quote ?? prediction?.quote ?? null;
    if (effQuote) {
      const overround =
        1 / effQuote.priceHome +
        1 / effQuote.priceAway +
        (effQuote.priceDraw ? 1 / effQuote.priceDraw : 0);
      marketEfficiency = Number((1 - (overround - 1)).toFixed(4));
    }

    return {
      fixtureId,
      market,
      line,
      openingOdds,
      predictionOdds,
      closingOdds,
      clv,
      lineMovement,
      steamMove,
      marketEfficiency,
    };
  }

  /** Movement analytics for every recommended market of one prediction. */
  async movementForPrediction(snapshot: PredictionSnapshotRecord): Promise<MarketMovement[]> {
    const recs = [
      snapshot.prediction.asianHandicap,
      snapshot.prediction.overUnder,
      snapshot.prediction.moneyline,
    ];
    const results: MarketMovement[] = [];
    for (const rec of recs) {
      if (!rec) continue;
      results.push(
        await this.computeMovement(
          snapshot.fixture.fixtureId,
          rec.market,
          rec.line,
          rec.selection,
          rec.odds
        )
      );
    }
    return results;
  }
}
