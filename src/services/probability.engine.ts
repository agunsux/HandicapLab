import { Feature, calculateFeatureScore, extractExplainability } from '../lib/model/features';
import { sigmoid } from '../lib/math/metrics';

import { StateWeightResult } from '../lib/calibration/stateWeightLearner';
import { calculatePoissonProbabilities } from '../lib/model/poisson';
import { OODDetector } from '../lib/ood/OODDetector';
import { ConfidenceCalculator } from '../lib/confidence/ConfidenceCalculator';

export interface MatchInput {
  /** Optional match identifier for traceability */
  matchId?: string;
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
  preMatchFeatures?: {
    homeTeamStrength: number;
    awayTeamStrength: number;
    homeForm: number;
    awayForm: number;
    h2hHomeWinRate: number;
    h2hAwayWinRate: number;
    h2hDrawRate: number;
  };
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
  final_confidence: number; // 0.0 to 1.0 (or 0-100, we normalize to 0.0-1.0)
  ood_score: number;

  model_version: string;
  topPositiveFactors: string[];
  topNegativeFactors: string[];
  features?: Feature[];
  htScoreState?: string;
}

export function generatePrediction(
  input: MatchInput,
  learnedStateWeights?: Record<string, StateWeightResult>
): PredictionOutput {
  // 1. Calculate lambdas (expected goals) for Poisson model
  let lambdaHome = input.xg_home || 1.35;
  let lambdaAway = input.xg_away || 1.15;

  const pm = input.preMatchFeatures;
  if (pm) {
    // Adjust xG lambdas based on relative team strength and form
    const strengthAdjustHome = Math.max(0.5, Math.min(2.0, pm.homeTeamStrength / (pm.awayTeamStrength || 1.0)));
    const strengthAdjustAway = Math.max(0.5, Math.min(2.0, pm.awayTeamStrength / (pm.homeTeamStrength || 1.0)));
    
    const formAdjustHome = Math.max(0.6, Math.min(1.8, pm.homeForm / 1.5));
    const formAdjustAway = Math.max(0.6, Math.min(1.8, pm.awayForm / 1.5));

    lambdaHome = lambdaHome * strengthAdjustHome * formAdjustHome;
    lambdaAway = lambdaAway * strengthAdjustAway * formAdjustAway;
  }

  // 2. Run Poisson probability aggregation
  const ouLine = input.ou_line || 2.5;
  const ahLine = input.ah_line || 0;
  const poisson = calculatePoissonProbabilities(lambdaHome, lambdaAway, ouLine, ahLine);

  // 3. Keep existing Second Half Under logic intact (backward compatibility)
  const htHome = input.ht_home_goals || 0;
  const htAway = input.ht_away_goals || 0;
  const htTotal = htHome + htAway;
  let htScoreState = '2+';
  if (htTotal === 0) htScoreState = '0-0';
  else if (htTotal === 1) htScoreState = '1-0';
  else if (htHome === 1 && htAway === 1) htScoreState = '1-1';

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
    sh_ou_under_logit = w.bias + w.tempo_weight * tempo + w.pressure_weight * pressure + w.defShape_weight * defShape;
  } else {
    const shFeatureScore = calculateFeatureScore(shUnderFeatures);
    sh_ou_under_logit = shFeatureScore - 0.2;
  }
  const sh_ou_under_prob = sigmoid(sh_ou_under_logit);

  const { positive, negative } = extractExplainability(shUnderFeatures);

  // Calculate OOD Score
  const featureValues = [
    input.xg_home, input.xg_away, input.shots_home, input.shots_away,
    input.domain_tempo || 0, input.domain_pressure || 0
  ];
  const ood_score = OODDetector.computeOODScore(featureValues);

  // 4. Calculate prediction confidence (0.0 to 1.0)
  // Use highest probability from primary markets as a baseline confidence metric
  const primaryMarkets = [poisson.homeProb, poisson.drawProb, poisson.awayProb, poisson.overProb, poisson.underProb];
  const maxMarketProb = Math.max(...primaryMarkets);
  
  let baseConfidence = maxMarketProb;
  if (pm) {
    // Add H2H reliability factor (higher win/loss consistency in H2H increases confidence)
    const h2hSkew = Math.abs(pm.h2hHomeWinRate - pm.h2hAwayWinRate);
    baseConfidence = Math.min(0.99, Math.max(0.35, baseConfidence + h2hSkew * 0.1));
  }

  // Composite Confidence
  const final_confidence = ConfidenceCalculator.calculate(
    1.0, // Mock calibration quality (would come from Registry/ECE)
    0.9, // Mock model stability
    0.95, // Mock data coverage
    ood_score,
    baseConfidence // Mock agreement score (using max market prob as proxy)
  );

  // Base raw logits for legacy metrics
  const ouBaseLine = 2.5;
  const ahBaseLine = 0;
  const ah_home_logit = (lambdaHome - lambdaAway - ahBaseLine) * 1.5;
  const ou_over_logit = (lambdaHome + lambdaAway - ouBaseLine) * 0.8;
  const ml_home_logit = (lambdaHome - lambdaAway) * 2.0;

  const matchId: string = input.matchId || 'sim_' + Math.random().toString(36).substring(7);

  return {
    matchId,
    ml_home_prob: poisson.homeProb,
    ml_draw_prob: poisson.drawProb,
    ml_away_prob: poisson.awayProb,
    ou_over_prob: poisson.overProb,
    ou_under_prob: poisson.underProb,
    ah_home_prob: poisson.ahHomeProb,
    ah_away_prob: poisson.ahAwayProb,
    sh_ou_over_prob: 1 - sh_ou_under_prob,
    sh_ou_under_prob: sh_ou_under_prob,
    btts_yes_prob: poisson.bttsYesProb,
    btts_no_prob: poisson.bttsNoProb,
    marketLogits: {
      SH_UNDER: sh_ou_under_logit,
      FT_OU: ou_over_logit,
      AH_HOME: ah_home_logit,
      ML_HOME: ml_home_logit
    },
    expected_goals_home: Number(lambdaHome.toFixed(2)),
    expected_goals_away: Number(lambdaAway.toFixed(2)),
    final_confidence,
    ood_score,
    model_version: 'v0.5-ai',
    topPositiveFactors: pm ? ['Form & Strength Adjusted', ...positive] : positive,
    topNegativeFactors: negative,
    features: shUnderFeatures,
    htScoreState
  };
}
