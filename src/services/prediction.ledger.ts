import { supabase } from '@/lib/supabase.server';
import { MatchInput, PredictionOutput, generatePrediction } from './probability.engine';
import { mapConfidence } from '../lib/confidence';

export async function processAndStorePrediction(matchId: string, input: MatchInput) {
  // 1. Generate Prediction using engine
  const prediction: PredictionOutput = generatePrediction(input);

  // Map confidence level
  const confidenceStr = mapConfidence(prediction.final_confidence);

  // 2. Store prediction into Supabase 'predictions' table
  const { data, error } = await supabase
    .from('predictions')
    .insert({
      match_id: matchId,
      home_prob: prediction.ml_home_prob,
      draw_prob: prediction.ml_draw_prob,
      away_prob: prediction.ml_away_prob,
      ah_line: input.ah_line ?? -0.75,
      ah_prob: prediction.ah_home_prob,
      ou_line: input.ou_line ?? 2.5,
      over_prob: prediction.ou_over_prob,
      confidence: confidenceStr,
    })
    .select()
    .single();

  if (error) {
    console.error('Error storing prediction:', error);
    throw error;
  }

  return data;
}
