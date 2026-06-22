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
}

export interface PredictionOutput {
  ah_home_prob: number;
  ah_away_prob: number;
  ou_over_prob: number;
  ou_under_prob: number;
  ml_home_prob: number;
  ml_draw_prob: number;
  ml_away_prob: number;
  btts_yes_prob: number;
  btts_no_prob: number;
  final_confidence: number;
  model_version: string;
}

export function generatePrediction(input: MatchInput): PredictionOutput {
  // 1. Market Implied Probability
  const implied_home = 1 / input.odds_home;
  const implied_draw = 1 / input.odds_draw;
  const implied_away = 1 / input.odds_away;
  const total_implied = implied_home + implied_draw + implied_away;
  
  const prob_home = implied_home / total_implied;
  const prob_draw = implied_draw / total_implied;
  const prob_away = implied_away / total_implied;

  // 2. xG Differential Model
  const xg_diff = input.xg_home - input.xg_away;

  // 3. Poisson Approximation (lightweight variables for logical mapping)
  // const lambda_home = input.xg_home;
  // const lambda_away = input.xg_away;

  // 4. Market-Specific Logic

  // A. Asian Handicap
  // Derive edge from xG_diff + odds imbalance
  // simplified logic: sigmoid curve on (xG difference shifted by Asian handicap line)
  const ah_diff_expected = xg_diff - input.ah_line;
  const ah_home_prob = 1 / (1 + Math.exp(-ah_diff_expected)); 
  const ah_away_prob = 1 - ah_home_prob;

  // B. Over/Under
  const total_expected_goals = input.xg_home + input.xg_away;
  const ou_diff = total_expected_goals - input.ou_line;
  const ou_over_prob = 1 / (1 + Math.exp(-ou_diff));
  const ou_under_prob = 1 - ou_over_prob;

  // C. Moneyline
  // combine: market probability (50%), xG model (30%), form index (20%)
  const xg_home_prob = 1 / (1 + Math.exp(-xg_diff));
  const xg_away_prob = 1 - xg_home_prob;
  
  // form scale assumption: 0 to 5 points. Difference is between -5 and 5.
  // map form diff to probability modifier (base 50% shifted by diff)
  const form_home_modifier = 0.5 + (input.form_home - input.form_away) * 0.05; 
  const form_away_modifier = 0.5 + (input.form_away - input.form_home) * 0.05;

  const ml_home_raw = (prob_home * 0.5) + (xg_home_prob * 0.3) + (Math.max(0, Math.min(1, form_home_modifier)) * 0.2);
  const ml_away_raw = (prob_away * 0.5) + (xg_away_prob * 0.3) + (Math.max(0, Math.min(1, form_away_modifier)) * 0.2);
  
  // draw probability based on closeness of match (xG diff near 0) + market implication
  const draw_xg_factor = 1 - Math.abs(xg_home_prob - 0.5) * 2; 
  const draw_form_factor = 1 - Math.abs(form_home_modifier - 0.5) * 2;
  const ml_draw_raw = (prob_draw * 0.5) + (0.3 * draw_xg_factor) + (0.2 * draw_form_factor);
  
  // Normalize ML
  const total_ml = ml_home_raw + ml_away_raw + ml_draw_raw;
  const final_ml_home = ml_home_raw / total_ml;
  const final_ml_draw = ml_draw_raw / total_ml;
  const final_ml_away = ml_away_raw / total_ml;

  // D. BTTS
  // Rule-based: if xG_home > 0.9 AND xG_away > 0.9 → high BTTS_yes
  let btts_yes_raw = 0.5; // base BTTS yes prob
  if (input.xg_home > 0.9 && input.xg_away > 0.9) {
      btts_yes_raw += 0.2;
  } else if (input.xg_home < 0.8 || input.xg_away < 0.8) {
      btts_yes_raw -= 0.15;
  }
  
  // adjust with defensive strength proxy (shots_on_target allowed)
  // Assuming 'shots_on_target_home' is what home team creates, 
  // defensive strength of home is measured by 'shots_on_target_away' (what they allow)
  const sot_allowed_home = input.shots_on_target_away; 
  const sot_allowed_away = input.shots_on_target_home; 

  if (sot_allowed_home > 5 && sot_allowed_away > 5) {
      btts_yes_raw += 0.1;
  } else if (sot_allowed_home < 3 || sot_allowed_away < 3) {
      btts_yes_raw -= 0.1;
  }

  const btts_yes_prob = Math.max(0.01, Math.min(0.99, btts_yes_raw));
  const btts_no_prob = 1 - btts_yes_prob;

  // Final Confidence
  // Simple heuristic: if market and xG models agree closely, high confidence.
  const diff_market_xg = Math.abs(prob_home - xg_home_prob);
  let final_confidence = 1 - diff_market_xg; // Max 1.0
  final_confidence = Math.max(0.1, Math.min(0.99, final_confidence));

  return {
      ah_home_prob,
      ah_away_prob,
      ou_over_prob,
      ou_under_prob,
      ml_home_prob: final_ml_home,
      ml_draw_prob: final_ml_draw,
      ml_away_prob: final_ml_away,
      btts_yes_prob,
      btts_no_prob,
      final_confidence,
      model_version: 'v0.1'
  };
}
