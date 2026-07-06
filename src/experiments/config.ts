// HandicapLab Experiment Config Schema
// Location: src/experiments/config.ts

export interface FeatureFlags {
  carry_over_elo: boolean;
  promoted_team_adjustment: boolean;
  double_home_modifier_fix: boolean;
  favorite_longshot_adjustment: boolean;
  adaptive_kelly: boolean;
  single_bet_per_match: boolean;
  xg_integration: boolean;
  calibration_method: 'platt' | 'isotonic' | 'beta';
  squad_dynamics: boolean;
  squad_dynamics_value_only: boolean;
  squad_dynamics_congestion_only: boolean;
  market_intelligence: boolean;
}

export interface ModelParameters {
  elo_k_factor: number;            // e.g. 32
  home_advantage_multiplier: number; // e.g. 1.05
  kelly_multiplier: number;        // e.g. 0.25
  minimum_edge_pct: number;        // e.g. 3.0 (%)
  probability_threshold: number;   // e.g. 0.05
  odds_min_limit: number;          // e.g. 1.10
  odds_max_limit: number;          // e.g. 30.0
  model_confidence_score: number;  // e.g. 0.80
  data_quality_score: number;      // e.g. 0.85
  platt_a?: number;
  platt_b?: number;
  steam_move_threshold: number;
}

export interface ExperimentConfig {
  experimentId: string;
  description: string;
  datasetVersion: string;
  seasons: string[];
  featureFlags: FeatureFlags;
  parameters: ModelParameters;
}

export const DEFAULT_CONFIG: ExperimentConfig = {
  experimentId: 'Baseline_v1',
  description: 'Immutable model baseline run.',
  datasetVersion: 'Gold_v1',
  seasons: ['2020-2021', '2021-2022', '2022-2023', '2023-2024', '2024-2025'],
  featureFlags: {
    carry_over_elo: true, // Baseline carries over Elo rating
    promoted_team_adjustment: false,
    double_home_modifier_fix: false,
    favorite_longshot_adjustment: false,
    adaptive_kelly: false,
    single_bet_per_match: true, // Default to true to match Sprint 11 baseline!
    xg_integration: false,
    calibration_method: 'platt',
    squad_dynamics: false,
    squad_dynamics_value_only: false,
    squad_dynamics_congestion_only: false,
    market_intelligence: false
  },
  parameters: {
    elo_k_factor: 32,
    home_advantage_multiplier: 1.05,
    kelly_multiplier: 0.25,
    minimum_edge_pct: 3.0,
    probability_threshold: 0.05,
    odds_min_limit: 1.10,
    odds_max_limit: 30.0,
    model_confidence_score: 0.80,
    data_quality_score: 0.85,
    platt_a: 1.02,
    platt_b: -0.01,
    steam_move_threshold: 0.05
  }
};
