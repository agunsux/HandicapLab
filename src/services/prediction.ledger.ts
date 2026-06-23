import { supabase } from '@/lib/supabase.server';
import { MatchInput, PredictionOutput, generatePrediction } from './probability.engine';
import { mapConfidence } from '../lib/confidence';

// TODO: Sprint 6 Refactor - Full cleanup of prediction ledger to completely align with Sprint 5 market-specific predictions

let cachedIsNewSchema: boolean | null = null;

async function checkIsNewSchema(): Promise<boolean> {
  if (cachedIsNewSchema !== null) return cachedIsNewSchema;
  try {
    const { error } = await supabase.from('predictions').select('prediction').limit(1);
    cachedIsNewSchema = !error || error.code !== '42703';
  } catch {
    cachedIsNewSchema = false;
  }
  return cachedIsNewSchema;
}

export async function processAndStorePrediction(matchId: string, input: MatchInput) {
  // 1. Generate Prediction using engine
  const prediction: PredictionOutput = generatePrediction(input);

  // Map confidence levels
  const confidenceStr = mapConfidence(prediction.final_confidence);
  
  // Mapped pick probabilities for market-specific confidences
  const bestAhProb = Math.max(prediction.ah_home_prob, 1 - prediction.ah_home_prob);
  const bestOuProb = Math.max(prediction.ou_over_prob, 1 - prediction.ou_over_prob);
  
  const ahConf = mapConfidence(bestAhProb);
  const ouConf = mapConfidence(bestOuProb);
  
  const expectedGoalsTotal = prediction.expected_goals_home + prediction.expected_goals_away;

  const isNew = await checkIsNewSchema();

  // 2. Store prediction into Supabase 'predictions' table
  let insertPayload: any;

  if (isNew) {
    insertPayload = {
      match_id: matchId,
      market_type: 'ML',
      prediction: {
        home_prob: prediction.ml_home_prob,
        draw_prob: prediction.ml_draw_prob,
        away_prob: prediction.ml_away_prob,
        ah_line: input.ah_line ?? -0.75,
        ah_prob: prediction.ah_home_prob,
        ah_confidence: ahConf,
        ou_line: input.ou_line ?? 2.5,
        over_prob: prediction.ou_over_prob,
        ou_confidence: ouConf,
        expected_goals: Number(expectedGoalsTotal.toFixed(2)),
        confidence: confidenceStr,
      },
      model_version: prediction.model_version || 'v0.5-ai',
      feature_version: 'basic-v1',
      generated_at: new Date().toISOString(),
      prediction_timestamp: new Date().toISOString(),
    };
  } else {
    insertPayload = {
      match_id: matchId,
      home_prob: prediction.ml_home_prob,
      draw_prob: prediction.ml_draw_prob,
      away_prob: prediction.ml_away_prob,
      ah_line: input.ah_line ?? -0.75,
      ah_prob: prediction.ah_home_prob,
      ah_confidence: ahConf,
      ou_line: input.ou_line ?? 2.5,
      over_prob: prediction.ou_over_prob,
      ou_confidence: ouConf,
      expected_goals: Number(expectedGoalsTotal.toFixed(2)),
      confidence: confidenceStr,
      model_version: prediction.model_version || 'v0.5-ai',
    };
  }

  const { data, error } = await supabase
    .from('predictions')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error('Error storing prediction:', error);
    throw error;
  }

  return data;
}
