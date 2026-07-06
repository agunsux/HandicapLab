// Odds Ingestion Service
// Location: src/services/oddsIngestionService.ts

import { MarketRepository, MarketBookDb } from '../lib/data/marketRepository';
import { MarketMath } from '../lib/engine/market-math';
import { MicrostructureAnalyzer } from '../lib/engine/microstructure-analyzer';

export interface OddsSnapshotInput {
  matchId: string;
  bookmaker: string;
  marketType: 'ML' | 'AH' | 'OU';
  line?: number | null;
  odds: Record<string, number>; // e.g. { home: 1.95, away: 1.95 }
  source: string;
  timestamp: string;
}

export class OddsIngestionService {
  /**
   * Processes and records an odds snapshot bookmaker feed.
   */
  public static async ingestSnapshot(input: OddsSnapshotInput): Promise<string | null> {
    // 1. Calculate implied probabilities and remove overround using Proportional and Shin methods
    const proportionalResult = MarketMath.removeMarginProportional(input.odds);
    const shinResult = MarketMath.removeMarginShin(input.odds);

    const overround = proportionalResult.overround;
    const spread = MicrostructureAnalyzer.calculateSpread(input.odds);

    // 2. Setup the book record
    const bookRecord: MarketBookDb = {
      match_id: input.matchId,
      bookmaker: input.bookmaker,
      market_type: input.marketType,
      line: input.line || null,
      source: input.source,
      timestamp: input.timestamp
    };

    // 3. Setup selections payload
    const oddsPayload = Object.keys(input.odds).map(selection => {
      return {
        selection,
        decimal_odds: input.odds[selection],
        implied_probability: proportionalResult.impliedProbabilities[selection] || 0.0,
        fair_probability: shinResult.fairProbabilities[selection] || proportionalResult.fairProbabilities[selection] || 0.0
      };
    });

    // 4. Save book & selections to DB
    const bookId = await MarketRepository.saveMarketBook(bookRecord, oddsPayload);
    if (!bookId) {
      return null;
    }

    // 5. Update closing lines (continuously records the latest lines)
    for (const selection of Object.keys(input.odds)) {
      await MarketRepository.saveClosingLine({
        match_id: input.matchId,
        bookmaker: input.bookmaker,
        market_type: input.marketType,
        selection,
        line: input.line || null,
        closing_odds: input.odds[selection],
        closing_timestamp: input.timestamp
      });
    }

    // 6. Record microstructure spread/overround logs
    await MarketRepository.saveMicrostructureLog({
      match_id: input.matchId,
      market_type: input.marketType,
      bookmaker: input.bookmaker,
      spread,
      overround,
      sharp_price_lead_latency_sec: null, // Calculated during backtests or live timeline analysis
      timestamp: input.timestamp
    });

    return bookId;
  }
}
