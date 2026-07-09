/**
 * Pipeline Step Contracts — Individual Definitions
 * ===================================================
 * Formal contracts for each step in the prediction pipeline.
 * These are the source of truth for state machine transitions,
 * recovery strategies, and observability instrumentation.
 */

import type {
  PipelineStepContract,
  RetryPolicy,
  FailureMode,
  RecoveryStrategy,
  IdempotencyScheme,
} from './index';

// ─── Helper: Default Metric Definitions ─────────────────────────────────────

const METRICS = {
  // Latency timer (every step should produce this)
  latency: (prefix: string) => ({
    name: `${prefix}_latency_ms`,
    type: 'timer' as const,
    description: `Execution time for ${prefix} step`,
    unit: 'milliseconds',
  }),

  // Success/failure counters
  success: (prefix: string) => ({
    name: `${prefix}_success_total`,
    type: 'counter' as const,
    description: `Total successful ${prefix} executions`,
  }),

  failure: (prefix: string) => ({
    name: `${prefix}_failure_total`,
    type: 'counter' as const,
    description: `Total failed ${prefix} executions`,
  }),

  // Business metrics
  count: (name: string, description: string) => ({
    name,
    type: 'counter' as const,
    description,
  }),
};

// ─── 1. PREDICTION ──────────────────────────────────────────────────────────

export const PREDICTION_CONTRACT: PipelineStepContract = {
  stepId: 'prediction',
  name: 'Prediction Generation',
  description: 'Generates model predictions for a fixture using engineered features and market odds.',

  input: {
    type: 'PredictionInput',
    description: 'Fixture with features and odds needed to compute predictions',
    requiredFields: ['fixtureId', 'homeTeam', 'awayTeam', 'league', 'kickoff', 'features', 'openingOdds'],
  },

  output: {
    type: 'PredictionOutput',
    description: 'Computed probabilities and recommended markets',
    guaranteedFields: ['homeProb', 'drawProb', 'awayProb', 'expectedGoals', 'confidence', 'modelVersion'],
  },

  preconditions: [
    {
      id: 'pred_pre_001',
      description: 'Fixture must exist',
      check: 'exists:fixtureId',
      severity: 'critical',
    },
    {
      id: 'pred_pre_002',
      description: 'Features must be computed and ready',
      check: 'exists:features',
      severity: 'critical',
    },
    {
      id: 'pred_pre_003',
      description: 'Opening odds must be available (for edge calculation)',
      check: 'exists:openingOdds',
      severity: 'warning',
    },
    {
      id: 'pred_pre_004',
      description: 'Kickoff must be in the future (no post-hoc predictions)',
      check: 'exists:kickoff',
      severity: 'critical',
    },
  ],

  postconditions: [
    {
      id: 'pred_post_001',
      description: 'Prediction must have valid probability distribution (sum ≈ 1.0)',
      check: 'type:number:homeProb',
      guarantee: 'hard',
    },
    {
      id: 'pred_post_002',
      description: 'Prediction must be persisted to database',
      check: 'exists:predictionId',
      guarantee: 'hard',
    },
    {
      id: 'pred_post_003',
      description: 'Model version must be recorded for audit',
      check: 'exists:modelVersion',
      guarantee: 'hard',
    },
  ],

  retryPolicy: { type: 'no_retry' },
  timeoutMs: 30_000,
  idempotency: { type: 'idempotency_key', keyFields: ['fixture_id', 'model_version', 'feature_version'] },
  failureMode: 'blocking',
  recoveryStrategy: { type: 'manual_intervention' },
  dependsOn: ['feature_engineering'],

  metrics: [
    METRICS.latency('prediction'),
    METRICS.success('prediction'),
    METRICS.failure('prediction'),
    METRICS.count('predictions_generated_total', 'Total predictions generated'),
    METRICS.count('predictions_high_confidence_total', 'High confidence predictions'),
  ],
};

// ─── 2. OPENING ODDS CAPTURE ────────────────────────────────────────────────

export const OPENING_CAPTURE_CONTRACT: PipelineStepContract = {
  stepId: 'capture_opening',
  name: 'Opening Odds Capture',
  description: 'Captures the first odds snapshot for a fixture as soon as it becomes available.',

  input: {
    type: 'CaptureInput',
    description: 'Fixture reference for odds capture',
    requiredFields: ['fixtureId', 'homeTeam', 'awayTeam', 'league'],
  },

  output: {
    type: 'CaptureOutput',
    description: 'Odds snapshot for all three markets',
    guaranteedFields: ['fixtureId', 'marketType', 'homeOdds', 'awayOdds', 'drawOdds', 'capturedAt', 'provider'],
  },

  preconditions: [
    {
      id: 'open_pre_001',
      description: 'Fixture must exist and be upcoming',
      check: 'exists:fixtureId',
      severity: 'critical',
    },
    {
      id: 'open_pre_002',
      description: 'Provider must be healthy (checked within last 5 min)',
      check: 'exists:provider',
      severity: 'warning',
    },
  ],

  postconditions: [
    {
      id: 'open_post_001',
      description: 'Opening odds stored in market_movements',
      check: 'exists:capturedAt',
      guarantee: 'hard',
    },
    {
      id: 'open_post_002',
      description: 'All three markets attempted (ML, AH, OU)',
      check: 'exists:marketType',
      guarantee: 'soft',
    },
  ],

  retryPolicy: {
    type: 'exponential_backoff',
    maxAttempts: 3,
    baseDelayMs: 2_000,
    maxDelayMs: 30_000,
  },
  timeoutMs: 15_000,
  idempotency: {
    type: 'dedup_window',
    windowMs: 86_400_000, // 24h — only one opening capture per fixture
    keyFields: ['fixture_id', 'market_type'],
  },
  failureMode: 'non_blocking',
  recoveryStrategy: { type: 'dead_letter_queue' },
  dependsOn: [],

  metrics: [
    METRICS.latency('capture_opening'),
    METRICS.success('capture_opening'),
    METRICS.failure('capture_opening'),
    METRICS.count('opening_odds_captured_total', 'Opening odds snapshots captured'),
    METRICS.count('market_movements_stored_total', 'Market movement records stored'),
  ],
};

// ─── 3. CLOSING ODDS CAPTURE ────────────────────────────────────────────────

export const CLOSING_CAPTURE_CONTRACT: PipelineStepContract = {
  stepId: 'capture_closing',
  name: 'Closing Odds Capture (Periodic)',
  description: 'Captures odds at multiple time windows before kickoff. The closest capture to kickoff becomes the canonical closing line.',

  input: {
    type: 'CaptureInput',
    description: 'Fixture reference with kickoff time for phase calculation',
    requiredFields: ['fixtureId', 'homeTeam', 'awayTeam', 'kickoff'],
  },

  output: {
    type: 'CaptureOutput',
    description: 'Odds snapshots at nearest applicable phase, with closing_odds updated if phase is T-15m or closer',
    guaranteedFields: ['fixtureId', 'marketType', 'capturePhase', 'closingUpdated'],
  },

  preconditions: [
    {
      id: 'close_pre_001',
      description: 'Fixture must have an opening odds capture',
      check: 'exists:openingCapture',
      severity: 'warning',
    },
    {
      id: 'close_pre_002',
      description: 'Fixture is not yet finished',
      check: 'exists:fixtureId',
      severity: 'critical',
    },
  ],

  postconditions: [
    {
      id: 'close_post_001',
      description: 'Market movement recorded (or idempotent no-op)',
      check: 'exists:capturePhase',
      guarantee: 'hard',
    },
    {
      id: 'close_post_002',
      description: 'Closing odds updated if within T-15m, T-5m, or kickoff phase',
      check: 'exists:closingUpdated',
      guarantee: 'soft',
    },
    {
      id: 'close_post_003',
      description: 'Capture delay logged (seconds before kickoff)',
      check: 'exists:capturePhase',
      guarantee: 'hard',
    },
  ],

  retryPolicy: {
    type: 'exponential_backoff',
    maxAttempts: 3,
    baseDelayMs: 5_000,
    maxDelayMs: 60_000,
  },
  timeoutMs: 20_000,
  idempotency: {
    type: 'upsert',
    uniqueFields: ['match_id', 'market_type', 'capture_phase', 'provider'],
  },
  failureMode: 'non_blocking',
  recoveryStrategy: { type: 'dead_letter_queue' },
  dependsOn: ['capture_opening'],

  metrics: [
    METRICS.latency('capture_closing'),
    METRICS.success('capture_closing'),
    METRICS.failure('capture_closing'),
    METRICS.count('closing_odds_updated_total', 'Closing odds records updated'),
    METRICS.count('market_movements_stored_total', 'Market movements stored'),
    METRICS.count('capture_retry_total', 'Capture retry attempts'),
    METRICS.count('capture_timeout_total', 'Capture timeouts'),
  ],
};

// ─── 4. SETTLEMENT ──────────────────────────────────────────────────────────

export const SETTLEMENT_CONTRACT: PipelineStepContract = {
  stepId: 'settlement',
  name: 'Match Settlement',
  description: 'Records actual match result and compares against predictions to determine hits and profit/loss.',

  input: {
    type: 'SettlementInput',
    description: 'Finished match with actual score and predictions',
    requiredFields: ['fixtureId', 'homeScore', 'awayScore', 'predictionId'],
  },

  output: {
    type: 'SettlementOutput',
    description: 'Settlement record with hit/miss for each market and profit/loss',
    guaranteedFields: ['fixtureId', 'actualHomeScore', 'actualAwayScore', 'hit1x2', 'hitAH', 'hitOU'],
  },

  preconditions: [
    {
      id: 'settle_pre_001',
      description: 'Match must be finished (actual score exists)',
      check: 'exists:homeScore',
      severity: 'critical',
    },
    {
      id: 'settle_pre_002',
      description: 'Prediction must exist for this fixture',
      check: 'exists:predictionId',
      severity: 'critical',
    },
  ],

  postconditions: [
    {
      id: 'settle_post_001',
      description: 'Settlement record persisted in prediction_results',
      check: 'exists:fixtureId',
      guarantee: 'hard',
    },
    {
      id: 'settle_post_002',
      description: 'All three markets settled (1X2, AH, OU)',
      check: 'exists:hitAH',
      guarantee: 'hard',
    },
    {
      id: 'settle_post_003',
      description: 'Profit/Loss calculated for all markets',
      check: 'exists:hit1x2',
      guarantee: 'soft',
    },
  ],

  retryPolicy: { type: 'no_retry' },
  timeoutMs: 10_000,
  idempotency: { type: 'idempotency_key', keyFields: ['match_id', 'prediction_id'] },
  failureMode: 'blocking',
  recoveryStrategy: { type: 'manual_intervention' },
  dependsOn: ['prediction', 'capture_closing'],

  metrics: [
    METRICS.latency('settlement'),
    METRICS.success('settlement'),
    METRICS.failure('settlement'),
    METRICS.count('settlements_completed_total', 'Matches settled'),
    METRICS.count('settlements_hit_1x2_total', 'Correct 1X2 predictions'),
    METRICS.count('settlements_hit_ah_total', 'Correct AH predictions'),
    METRICS.count('settlements_hit_ou_total', 'Correct OU predictions'),
  ],
};

// ─── 5. CLV COMPUTATION ─────────────────────────────────────────────────────

export const CLV_CONTRACT: PipelineStepContract = {
  stepId: 'clv',
  name: 'CLV Computation',
  description: 'Computes Closing Line Value — the log ratio of model price to closing market price.',

  input: {
    type: 'CLVInput',
    description: 'Prediction and corresponding closing odds',
    requiredFields: ['predictionId', 'fixtureId', 'marketType', 'modelPrice', 'closingPrice'],
  },

  output: {
    type: 'CLVOutput',
    description: 'CLV in basis points and edge vs closing line',
    guaranteedFields: ['clv', 'clvBps', 'edgeVsClosing'],
  },

  preconditions: [
    {
      id: 'clv_pre_001',
      description: 'Prediction must exist and be settled',
      check: 'exists:predictionId',
      severity: 'critical',
    },
    {
      id: 'clv_pre_002',
      description: 'Closing odds must exist for this fixture/market',
      check: 'exists:closingPrice',
      severity: 'critical',
    },
  ],

  postconditions: [
    {
      id: 'clv_post_001',
      description: 'CLV calculated and stored in clv_results',
      check: 'exists:clv',
      guarantee: 'hard',
    },
    {
      id: 'clv_post_002',
      description: 'CLV expressed in both decimal and basis points',
      check: 'exists:clvBps',
      guarantee: 'hard',
    },
  ],

  retryPolicy: { type: 'no_retry' },
  timeoutMs: 5_000,
  idempotency: {
    type: 'upsert',
    uniqueFields: ['prediction_id', 'market_type'],
  },
  failureMode: 'non_blocking',
  recoveryStrategy: { type: 'dead_letter_queue' },
  dependsOn: ['settlement', 'capture_closing'],

  metrics: [
    METRICS.latency('clv'),
    METRICS.success('clv'),
    METRICS.failure('clv'),
    METRICS.count('clv_calculated_total', 'CLV values computed'),
    METRICS.count('clv_positive_total', 'CLV > 0 (model beat market)'),
    METRICS.count('clv_negative_total', 'CLV < 0 (market beat model)'),
  ],
};

// ─── 6. LEDGER WRITE ────────────────────────────────────────────────────────

export const LEDGER_CONTRACT: PipelineStepContract = {
  stepId: 'ledger',
  name: 'Evidence Ledger Write',
  description: 'Writes the complete prediction-settlement-CLV record to the immutable evidence ledger.',

  input: {
    type: 'LedgerInput',
    description: 'Complete prediction record with settlement and CLV',
    requiredFields: ['predictionId', 'fixtureId', 'modelVersion', 'marketType', 'predictionProb', 'marketProb', 'edge', 'clv'],
  },

  output: {
    type: 'LedgerOutput',
    description: 'Ledger entry with chain hash for integrity verification',
    guaranteedFields: ['entryId', 'chainHash', 'previousEntryId'],
  },

  preconditions: [
    {
      id: 'ledger_pre_001',
      description: 'Prediction must exist and be settled',
      check: 'exists:predictionId',
      severity: 'critical',
    },
    {
      id: 'ledger_pre_002',
      description: 'CLV must be computed',
      check: 'exists:clv',
      severity: 'critical',
    },
    {
      id: 'ledger_pre_003',
      description: 'Previous ledger entry hash available for chaining',
      check: 'exists:previousEntryId',
      severity: 'warning',
    },
  ],

  postconditions: [
    {
      id: 'ledger_post_001',
      description: 'Ledger entry persisted with valid chain hash',
      check: 'exists:chainHash',
      guarantee: 'hard',
    },
    {
      id: 'ledger_post_002',
      description: 'Chain integrity verified (hash matches previous entry)',
      check: 'exists:previousEntryId',
      guarantee: 'hard',
    },
  ],

  retryPolicy: { type: 'no_retry' },
  timeoutMs: 10_000,
  idempotency: { type: 'idempotency_key', keyFields: ['prediction_id', 'event_type'] },
  failureMode: 'blocking',
  recoveryStrategy: { type: 'manual_intervention' },
  dependsOn: ['prediction', 'settlement', 'clv'],

  metrics: [
    METRICS.latency('ledger'),
    METRICS.success('ledger'),
    METRICS.failure('ledger'),
    METRICS.count('ledger_written_total', 'Ledger entries written'),
    METRICS.count('ledger_chain_verified_total', 'Chain integrity verifications'),
    METRICS.count('ledger_chain_broken_total', 'Chain integrity failures'),
  ],
};

// ─── 7. FEATURE ENGINEERING ─────────────────────────────────────────────────

export const FEATURE_ENGINEERING_CONTRACT: PipelineStepContract = {
  stepId: 'feature_engineering',
  name: 'Feature Engineering',
  description: 'Computes match-level features from historical data, team stats, and market data.',

  input: {
    type: 'FeatureInput',
    description: 'Fixture with historical context needed to compute features',
    requiredFields: ['fixtureId', 'homeTeam', 'awayTeam', 'league', 'season'],
  },

  output: {
    type: 'FeatureOutput',
    description: 'Feature vector for the prediction model',
    guaranteedFields: ['featureVersion', 'featureCount', 'features'],
  },

  preconditions: [
    {
      id: 'feat_pre_001',
      description: 'Fixture must exist in database',
      check: 'exists:fixtureId',
      severity: 'critical',
    },
    {
      id: 'feat_pre_002',
      description: 'Historical data available for both teams (min 5 matches)',
      check: 'exists:homeTeam',
      severity: 'warning',
    },
  ],

  postconditions: [
    {
      id: 'feat_post_001',
      description: 'Feature vector complete with no null values',
      check: 'exists:features',
      guarantee: 'hard',
    },
    {
      id: 'feat_post_002',
      description: 'Feature version tagged for reproducibility',
      check: 'exists:featureVersion',
      guarantee: 'hard',
    },
  ],

  retryPolicy: { type: 'no_retry' },
  timeoutMs: 30_000,
  idempotency: { type: 'idempotency_key', keyFields: ['fixture_id', 'feature_version'] },
  failureMode: 'blocking',
  recoveryStrategy: { type: 'dead_letter_queue' },
  dependsOn: [],

  metrics: [
    METRICS.latency('feature_engineering'),
    METRICS.success('feature_engineering'),
    METRICS.failure('feature_engineering'),
    METRICS.count('features_computed_total', 'Feature vectors computed'),
    METRICS.count('features_null_total', 'Feature vectors with null values'),
  ],
};

// ─── Register All Contracts ─────────────────────────────────────────────────

import { PIPELINE_CONTRACTS } from './index';

export function registerAllContracts(): void {
  const contracts = [
    FEATURE_ENGINEERING_CONTRACT,
    PREDICTION_CONTRACT,
    OPENING_CAPTURE_CONTRACT,
    CLOSING_CAPTURE_CONTRACT,
    SETTLEMENT_CONTRACT,
    CLV_CONTRACT,
    LEDGER_CONTRACT,
  ];

  for (const contract of contracts) {
    PIPELINE_CONTRACTS[contract.stepId] = contract;
  }
}

// Initialize on import
registerAllContracts();