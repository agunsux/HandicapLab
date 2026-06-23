export interface MatchInput {
  odds_home: number;
  odds_draw: number;
  odds_away: number;
  ah_line: number;
  ou_line: number;
  btts_odds: number; // e.g. btts_yes_odds
  xg_home: number;
  xg_away: number;
  shots_home: number;
  shots_away: number;
  shots_on_target_home: number;
  shots_on_target_away: number;
  form_home: number;
  form_away: number;
  last_5_avg_goals_home?: number;
  last_5_avg_goals_away?: number;
  sh_ou_line?: number;
  sh_ou_odds_under?: number;
  domain_tempo?: number;
  domain_defensiveShapeHome?: number;
  domain_defensiveShapeAway?: number;
  domain_fatigueHome?: number;
  domain_fatigueAway?: number;
  domain_weather?: number;
  domain_pressure?: number;
  ht_home_goals?: number;
  ht_away_goals?: number;
}

export interface PredictionOutput {
  matchId: string;
  ml_home_prob: number;
  ml_draw_prob: number;
  ml_away_prob: number;
  ou_over_prob: number;
  ou_under_prob: number;
  ah_home_prob: number;
  ah_away_prob: number;
  sh_ou_over_prob: number;
  sh_ou_under_prob: number;
  btts_yes_prob: number;
  btts_no_prob: number;
  marketLogits: Record<string, number>;
  expected_goals_home: number;
  expected_goals_away: number;
  final_confidence: number;
  model_version: string;
  topPositiveFactors: string[];
  topNegativeFactors: string[];
  features?: Feature[];
  htScoreState?: string;
}

import { Feature, calculateFeatureScore, sigmoid, extractExplainability } from '../lib/model/features';
import { StateWeightResult } from '../lib/calibration/stateWeightLearner';

export function generatePrediction(
  input: MatchInput,
  learnedStateWeights?: Record<string, StateWeightResult>
): PredictionOutput {
  const homeXg = input.xg_home;
  const awayXg = input.xg_away;
  const mlFeatureScore = (input.form_home - input.form_away) * 0.2;
  const ahFeatureScore = 0;
  const ouFeatureScore = 0;

  // Parse HT score state
  const htHome = input.ht_home_goals || 0;
  const htAway = input.ht_away_goals || 0;
  const htTotal = htHome + htAway;
  let htScoreState = '2+';
  if (htTotal === 0) htScoreState = '0-0';
  else if (htTotal === 1) htScoreState = '1-0'; // Assuming '1-0' covers 1-0 and 0-1 for simplicity, or 1 total goal
  else if (htHome === 1 && htAway === 1) htScoreState = '1-1';

  // Feature Model for Second Half Under
  const shUnderFeatures: Feature[] = [
    { name: 'tempo', value: (input.domain_tempo || 0) * -1, weight: 1.5, description: 'low tempo' },
    { name: 'defShapeHome', value: input.domain_defensiveShapeHome || 0, weight: 1.2, description: 'home defensive shape' },
    { name: 'defShapeAway', value: input.domain_defensiveShapeAway || 0, weight: 1.2, description: 'away defensive shape' },
    { name: 'fatigueHome', value: input.domain_fatigueHome || 0, weight: -0.8, description: 'home fatigue' },
    { name: 'fatigueAway', value: input.domain_fatigueAway || 0, weight: -0.8, description: 'away fatigue' },
    { name: 'weather', value: (input.domain_weather || 0) * -1, weight: 0.5, description: 'bad weather' },
    { name: 'pressure', value: input.domain_pressure || 0, weight: 0.5, description: 'high pressure' },
    { name: 'ht_0_0', value: htScoreState === '0-0' ? 1 : 0, weight: 0, description: 'HT is 0-0' },
    { name: 'ht_1_0', value: htScoreState === '1-0' ? 1 : 0, weight: 0, description: 'HT is 1-0 or 0-1' },
    { name: 'ht_1_1', value: htScoreState === '1-1' ? 1 : 0, weight: 0, description: 'HT is 1-1' },
    { name: 'ht_2_plus', value: htScoreState === '2+' ? 1 : 0, weight: 0, description: 'HT is 2+ goals' }
  ];

  let sh_ou_under_logit = 0;
  
  if (learnedStateWeights && learnedStateWeights[htScoreState] && !learnedStateWeights[htScoreState].fallback && learnedStateWeights[htScoreState].weights) {
    const w = learnedStateWeights[htScoreState].weights!;
    const tempo = (input.domain_tempo || 0) * -1;
    const pressure = input.domain_pressure || 0;
    const defShape = (input.domain_defensiveShapeHome || 0) + (input.domain_defensiveShapeAway || 0);
    
    // State-dependent logit
    sh_ou_under_logit = w.bias + w.tempo_weight * tempo + w.pressure_weight * pressure + w.defShape_weight * defShape;
  } else {
    // Global fallback
    const shFeatureScore = calculateFeatureScore(shUnderFeatures);
    sh_ou_under_logit = shFeatureScore - 0.2;
  }

  const ouBaseLine = 2.5;
  const ahBaseLine = 0;
  
  // Base raw logits
  const ah_home_logit = (homeXg - awayXg - ahBaseLine) * 1.5 + ahFeatureScore;
  const ou_over_logit = (homeXg + awayXg - ouBaseLine) * 0.8 + ouFeatureScore;
  const ml_home_logit = (homeXg - awayXg) * 2.0 + mlFeatureScore;
  
  const sh_ou_under_prob_feature = sigmoid(sh_ou_under_logit);
  const ah_home_prob_feature = sigmoid(ah_home_logit);
  const ou_over_prob_feature = sigmoid(ou_over_logit);
  const ml_home_prob_feature = sigmoid(ml_home_logit);

  const { positive, negative } = extractExplainability(shUnderFeatures);

  let ml_home_prob_norm = ml_home_prob_feature;
  let ml_draw_prob_norm = 0.24;
  let ml_away_prob_norm = 1 - ml_home_prob_norm - ml_draw_prob_norm;
  
  if (ml_away_prob_norm < 0) {
    ml_draw_prob_norm = Math.max(0, 1 - ml_home_prob_norm);
    ml_away_prob_norm = 0;
  }

  return {
    matchId: (input as any).matchId || 'sim_' + Math.random().toString(36).substring(7),
    ml_home_prob: ml_home_prob_norm,
    ml_draw_prob: ml_draw_prob_norm,
    ml_away_prob: ml_away_prob_norm,
    ou_over_prob: ou_over_prob_feature,
    ou_under_prob: 1 - ou_over_prob_feature,
    ah_home_prob: ah_home_prob_feature,
    ah_away_prob: 1 - ah_home_prob_feature,
    sh_ou_over_prob: 1 - sh_ou_under_prob_feature,
    sh_ou_under_prob: sh_ou_under_prob_feature,
    btts_yes_prob: 0.5,
    btts_no_prob: 0.5,
    marketLogits: {
      SH_UNDER: sh_ou_under_logit,
      FT_OU: ou_over_logit,
      AH_HOME: ah_home_logit,
      ML_HOME: ml_home_logit
    },
    expected_goals_home: homeXg,
    expected_goals_away: awayXg,
    final_confidence: 0.85,
    model_version: 'v0.3',
    topPositiveFactors: positive,
    topNegativeFactors: negative,
    features: shUnderFeatures,
    htScoreState
  };
}
