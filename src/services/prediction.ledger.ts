import { supabase } from '@/lib/supabase.server';
import { MatchInput, PredictionOutput, generatePrediction } from './probability.engine';

export async function processAndStorePrediction(matchId: string, input: MatchInput) {
  // 1. Generate Prediction using deterministic rules engine
  const prediction: PredictionOutput = generatePrediction(input);

  // 2. Store prediction into Supabase 'predictions' table
  const { data, error } = await supabase
    .from('predictions')
    .insert({
      match_id: matchId,
      model_version: prediction.model_version,
      ah_home_prob: prediction.ah_home_prob,
      ah_away_prob: prediction.ah_away_prob,
      ou_over_prob: prediction.ou_over_prob,
      ou_under_prob: prediction.ou_under_prob,
      ml_home_prob: prediction.ml_home_prob,
      ml_draw_prob: prediction.ml_draw_prob,
      ml_away_prob: prediction.ml_away_prob,
      btts_yes_prob: prediction.btts_yes_prob,
      btts_no_prob: prediction.btts_no_prob,
      final_confidence: prediction.final_confidence,
    })
    .select()
    .single();

  if (error) {
    console.error('Error storing prediction:', error);
    throw error;
  }

  return data;
}
