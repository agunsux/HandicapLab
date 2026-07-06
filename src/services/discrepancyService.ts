// Market Discrepancy & Drift Service
// Location: src/services/discrepancyService.ts

import { MarketRepository, MarketEdgeDb } from '../lib/data/marketRepository';
import { ModelRegistryRepository } from '../lib/data/modelRegistryRepository';
import { PredictionLedgerRepository } from '../lib/data/predictionLedgerRepository';
import { DriftDetector } from '../lib/engine/drift-detector';
import { supabase } from '../lib/supabase.server';

export class DiscrepancyService {
  /**
   * Compares model probabilities against current market odds books to identify discrepancies.
   * Ranks and saves findings in 'market_edges'.
   */
  public static async generateMarketEdges(matchId: string): Promise<boolean> {
    try {
      // 1. Fetch match info
      const { data: match, error: matchErr } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();

      if (matchErr || !match) {
        console.error('[DiscrepancyService] Match not found:', matchErr?.message);
        return false;
      }

      // 2. Fetch latest market books for match
      const books = await MarketRepository.getLatestMarketBooks(matchId);
      if (books.length === 0) return false;

      // 3. Fetch latest prediction ledger entries
      const { data: predictions, error: predErr } = await supabase
        .from('prediction_ledger_v3')
        .select('*')
        .eq('match_id', matchId);

      if (predErr || !predictions || predictions.length === 0) {
        console.warn('[DiscrepancyService] Predictions not found in ledger for match:', matchId);
        return false;
      }

      // Champion predictions
      const championModel = await ModelRegistryRepository.getChampionModel();
      const championId = championModel?.model_id || 'prematch-v1';
      const championPreds = predictions.filter(p => p.model_id === championId);

      if (championPreds.length === 0) return false;

      const edges: MarketEdgeDb[] = [];
      let rank = 1;

      // Group predictions by market
      for (const book of books) {
        const marketType = book.market_type; // 'ML', 'AH', 'OU'
        const bookmaker = book.bookmaker;

        const matchingPred = championPreds.find(p => p.market_type === marketType);
        if (!matchingPred) continue;

        const oddsList = book.market_odds || [];

        for (const o of oddsList) {
          const selection = o.selection;
          const decimalOdds = Number(o.decimal_odds);
          const impliedProb = Number(o.implied_probability);
          const fairProb = o.fair_probability ? Number(o.fair_probability) : impliedProb;

          // Model probability for this specific selection
          const modelProb = matchingPred.selection === selection ? matchingPred.calibrated_probability : (1.0 - matchingPred.calibrated_probability);

          const edgeRaw = modelProb * decimalOdds - 1.0;
          const expectedValue = edgeRaw;

          // Adjust edge by volatility and ECE drift factors
          const volatilityScore = 0.015; // baseline
          const edgeAdjusted = edgeRaw * (1.0 - volatilityScore);

          const rawKelly = expectedValue > 0 ? expectedValue / (decimalOdds - 1.0) : 0.0;
          const recommendedStake = rawKelly * 0.25; // Quarter-Kelly

          const marketEfficiency = 1.0 - (impliedProb - fairProb);

          edges.push({
            match_id: matchId,
            market: marketType,
            selection,
            bookmaker,
            line: book.line || null,
            model_probability: modelProb,
            market_probability: impliedProb,
            edge_raw: edgeRaw,
            edge_adjusted: edgeAdjusted,
            expected_value: expectedValue,
            kelly_fraction: rawKelly,
            confidence_score: matchingPred.explainability_json?.metrics?.confidence_score || 75.0,
            market_efficiency: marketEfficiency,
            volatility_score: volatilityScore,
            recommended_stake: recommendedStake,
            signal_rank: rank++,
            explanation_json: matchingPred.explainability_json
          });
        }
      }

      // Sort by EV descending
      edges.sort((a, b) => b.expected_value - a.expected_value);

      // Re-assign ranks
      edges.forEach((edge, index) => {
        edge.signal_rank = index + 1;
      });

      // Save edges to DB
      await MarketRepository.saveMarketEdges(edges);
      return true;
    } catch (e: any) {
      console.error('[DiscrepancyService] generateMarketEdges failed:', e.message);
      return false;
    }
  }

  /**
   * Evaluates feature and performance drift for a model version.
   */
  public static async monitorDrift(
    modelVersion: string,
    expectedFeatures: number[],
    actualFeatures: number[]
  ): Promise<boolean> {
    const drift = DriftDetector.calculatePSI(expectedFeatures, actualFeatures);

    const isCritical = drift.status === 'ACTION_REQUIRED';

    const { error } = await supabase.from('drift_detection_logs').insert({
      metric_name: 'feature_drift_psi',
      target_identifier: modelVersion,
      drift_value: drift.psi,
      critical_flag: isCritical,
      details: { status: drift.status }
    });

    if (error) {
      console.error('[DiscrepancyService] monitorDrift error:', error.message);
      return false;
    }

    return true;
  }
}
