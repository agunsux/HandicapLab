import { supabase } from '../supabase.server';
import { ProbabilityEngine } from '../engines/probability-engine';
import { EdgeScanner } from '../engines/edge-scanner';

export interface ReplayComparisonResult {
  original: {
    probability_home: number;
    probability_draw: number;
    probability_away: number;
    confidence_score: number;
    recommendation_label: string;
    odds: number | null;
  };
  replayed: {
    probability_home: number;
    probability_draw: number;
    probability_away: number;
    confidence_score: number;
    recommendation_label: string;
    odds: number | null;
  };
  diffs: {
    pHomeDiff: number;
    pDrawDiff: number;
    pAwayDiff: number;
    confidenceDiff: number;
    recommendationChanged: boolean;
  };
}

export class ReplayEngine {
  /**
   * Fetches the complete audit history/snapshot of a prediction by UUID.
   */
  static async getPredictionHistory(predictionUuid: string): Promise<any> {
    const { data: snapshot, error: snapErr } = await supabase
      .from('prediction_snapshots')
      .select('*')
      .eq('prediction_uuid', predictionUuid)
      .maybeSingle();

    if (snapErr || !snapshot) {
      throw new Error(`Failed to fetch prediction snapshot: ${snapErr?.message || 'Not found'}`);
    }

    const { data: features, error: featErr } = await supabase
      .from('prediction_snapshot_features')
      .select('*')
      .eq('snapshot_id', snapshot.snapshot_id);

    const { data: version, error: verErr } = await supabase
      .from('prediction_model_versions')
      .select('*')
      .eq('prediction_uuid', predictionUuid)
      .maybeSingle();

    const { data: settlement, error: settleErr } = await supabase
      .from('prediction_settlements')
      .select('*')
      .eq('prediction_uuid', predictionUuid)
      .maybeSingle();

    return {
      snapshot,
      features: features || [],
      version: version || null,
      settlement: settlement || null
    };
  }

  /**
   * Reconstructs and runs the probability engine for a historical prediction.
   */
  static async runReplay(predictionUuid: string): Promise<any> {
    const history = await this.getPredictionHistory(predictionUuid);
    const { snapshot, features } = history;

    // 1. Reconstruct feature input vector
    const featureMap: Record<string, number> = {};
    for (const f of features) {
      featureMap[f.feature_name] = f.feature_value ?? 0;
    }

    // 2. Execute probability engine
    const probOutput = await ProbabilityEngine.predict(featureMap as any, {
      oddsSnapshot: { bookmaker: 'pinnacle' }
    });

    // 3. Reconstruct odds structure for scanner
    const marketOdds = {
      bookmaker: 'pinnacle',
      line: snapshot.line ? Number(snapshot.line) : undefined,
      homeOdds: snapshot.odds ?? undefined,
      awayOdds: snapshot.odds ?? undefined
    };

    const marketType = snapshot.market === 'moneyline' ? 'ML' : snapshot.market === 'asian_handicap' ? 'AH' : 'OU';
    
    // 4. Run scanner for selection/EV
    const picks = EdgeScanner.scan(snapshot.match_id, marketType, probOutput, marketOdds);
    const topPick = picks[0];

    // 5. Determine recommendation/conviction label using neutral terminology
    let replayedLabel = 'No Action';
    if (topPick) {
      const ev = topPick.expectedValue || 0;
      const confidence = probOutput.confidence?.confidenceScore || 0;
      if (ev > 0.10 && confidence > 80) {
        replayedLabel = 'High Conviction';
      } else if (ev > 0.05 && confidence > 70) {
        replayedLabel = 'Medium Conviction';
      } else if (ev > 0) {
        replayedLabel = 'Low Conviction';
      } else {
        replayedLabel = 'Observation';
      }
    }

    return {
      probability_home: probOutput.pHome,
      probability_draw: probOutput.pDraw,
      probability_away: probOutput.pAway,
      confidence_score: probOutput.confidence ? probOutput.confidence.confidenceScore : 0,
      recommendation_label: replayedLabel,
      odds: topPick ? topPick.marketOdds : null,
      probOutput,
      topPick
    };
  }

  /**
   * Replays and compares a prediction to its original output to detect drift.
   */
  static async compareReplay(predictionUuid: string): Promise<ReplayComparisonResult> {
    const history = await this.getPredictionHistory(predictionUuid);
    const original = history.snapshot;

    const replayed = await this.runReplay(predictionUuid);

    const pHomeDiff = Number((replayed.probability_home - (original.probability_home ?? 0)).toFixed(4));
    const pDrawDiff = Number((replayed.probability_draw - (original.probability_draw ?? 0)).toFixed(4));
    const pAwayDiff = Number((replayed.probability_away - (original.probability_away ?? 0)).toFixed(4));
    const confidenceDiff = Number((replayed.confidence_score - (original.confidence_score ?? 0)).toFixed(2));
    const recommendationChanged = replayed.recommendation_label !== original.recommendation_label;

    return {
      original: {
        probability_home: original.probability_home ?? 0,
        probability_draw: original.probability_draw ?? 0,
        probability_away: original.probability_away ?? 0,
        confidence_score: original.confidence_score ?? 0,
        recommendation_label: original.recommendation_label || 'No Action',
        odds: original.odds ?? null
      },
      replayed: {
        probability_home: replayed.probability_home,
        probability_draw: replayed.probability_draw,
        probability_away: replayed.probability_away,
        confidence_score: replayed.confidence_score,
        recommendation_label: replayed.recommendation_label,
        odds: replayed.odds
      },
      diffs: {
        pHomeDiff,
        pDrawDiff,
        pAwayDiff,
        confidenceDiff,
        recommendationChanged
      }
    };
  }
}
