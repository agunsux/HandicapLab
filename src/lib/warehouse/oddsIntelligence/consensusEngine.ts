import { MarketConsensus, OddsSnapshot } from './types';

export class ConsensusEngine {
  /**
   * Generates a market consensus from a collection of bookmaker odds.
   * Assumes oddsList is grouped by selection (e.g. all 'Home' odds).
   */
  public static calculateConsensus(
    fixtureId: string,
    marketId: string,
    selection: string,
    timestamp: string,
    snapshots: OddsSnapshot[]
  ): MarketConsensus {
    if (!snapshots || snapshots.length === 0) {
      return {
        fixture_id: fixtureId,
        market_id: marketId,
        selection,
        timestamp,
        best_odds: 0,
        average_odds: 0,
        median_odds: 0,
        weighted_average_odds: 0,
        consensus_probability: 0,
        bookmaker_count: 0,
        provider_count: 0,
        freshness_seconds: 0,
        confidence_score: 0
      };
    }

    // Filter valid odds
    const validSnapshots = snapshots.filter(s => s.decimal_odds > 1.0);
    const oddsValues = validSnapshots.map(s => s.decimal_odds).sort((a, b) => a - b);
    
    const count = oddsValues.length;
    if (count === 0) throw new Error('No valid odds for consensus');

    const bestOdds = oddsValues[count - 1]; // Max odds
    const sumOdds = oddsValues.reduce((a, b) => a + b, 0);
    const averageOdds = sumOdds / count;
    
    // Median
    const mid = Math.floor(count / 2);
    const medianOdds = count % 2 !== 0 
      ? oddsValues[mid] 
      : (oddsValues[mid - 1] + oddsValues[mid]) / 2;

    // Weighted Average (giving more weight to sharp bookies if we had metadata, for now simple avg)
    const weightedAverageOdds = averageOdds; 

    // Implied prob from median
    const consensusProbability = 1 / medianOdds;

    // Confidence Score (based on dispersion and count)
    // High count + low variance = High confidence
    const variance = oddsValues.reduce((sq, n) => sq + Math.pow(n - averageOdds, 2), 0) / count;
    const standardDeviation = Math.sqrt(variance);
    // Score out of 100
    const confidenceScore = Math.min(100, Math.max(0, 100 - (standardDeviation * 50) + (count * 2)));

    return {
      fixture_id: fixtureId,
      market_id: marketId,
      selection,
      timestamp,
      best_odds: bestOdds,
      average_odds: averageOdds,
      median_odds: medianOdds,
      weighted_average_odds: weightedAverageOdds,
      consensus_probability: consensusProbability,
      bookmaker_count: count,
      provider_count: new Set(validSnapshots.map(s => s.source_id)).size,
      freshness_seconds: 0, // Computed by Replay Engine relative to a timestamp
      confidence_score: confidenceScore
    };
  }
}
