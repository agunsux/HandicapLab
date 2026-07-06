// HandicapLab Experiment Config Schema
// Location: src/experiments/config.ts

export interface FeatureFlags {
  carry_over_elo: boolean;
  promoted_team_adjustment: boolean;
  double_home_modifier_fix: boolean;
  favorite_longshot_adjustment: boolean;
  dynamic_home_advantage: boolean;
  adaptive_kelly: boolean;
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
    carry_over_elo: false,
    promoted_team_adjustment: false,
    double_home_modifier_fix: false,
    favorite_longshot_adjustment: false,
    dynamic_home_advantage: false,
    adaptive_kelly: false
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
    data_quality_score: 0.85
  }
};
