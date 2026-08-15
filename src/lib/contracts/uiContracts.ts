import { z } from 'zod';

export const RealFixtureSchema = z.object({
  id: z.string(),
  competition: z.string(),
  season: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  kickoff_utc: z.string(),
  status: z.enum(['upcoming', 'live', 'finished', 'postponed', 'cancelled']),
  provenance: z.string(),
  is_synthetic: z.literal(false),
});

export const RealOddsSchema = z.object({
  fixture_id: z.string(),
  provider: z.literal('oddspapi'),
  bookmaker: z.enum(['Pinnacle', 'Circa', 'SBO', 'pinnacle', 'circasports', 'sbobet']),
  market: z.enum(['Moneyline', 'Asian Handicap', 'Over/Under', 'BTTS', '101', '106', '108', '114']),
  line: z.string().nullable().optional(),
  selection: z.string(),
  odds: z.number().positive(),
  snapshot_timestamp: z.string(),
  source: z.string(),
});

export const RealPredictionSchema = z.object({
  id: z.string(),
  fixture_id: z.string(),
  market: z.string(),
  model_version: z.string(),
  model_status: z.enum(['LIVE_PRODUCTION', 'SHADOW', 'HISTORICAL_BACKTEST']),
  model_probability: z.number().min(0).max(1),
  fair_odds: z.number().positive(),
  expected_value: z.number(),
  clv: z.number().optional(),
  timestamp: z.string(),
  provenance_id: z.string(),
});

export const RealOpportunitySchema = z.object({
  id: z.string(),
  match: z.string(),
  league: z.string(),
  time: z.string(),
  market: z.string(),
  selection: z.string().optional(),
  line: z.string().optional(),
  modelProb: z.number().min(0).max(100),
  marketOdds: z.number().positive(),
  fairOdds: z.number().positive(),
  ev: z.number(),
  signal: z.enum(['VALUE', 'WATCH', 'PASS']),
  isStale: z.boolean(),
  locked: z.boolean(),
});

export const ModelStatusSchema = z.object({
  market: z.enum(['Moneyline', 'Asian Handicap', 'Over/Under', 'BTTS']),
  champion_model: z.string(),
  incumbent_model: z.string(),
  status: z.literal('SHADOW'),
  training: z.string(),
  clv: z.string(),
  oos_roi: z.string(),
  sample_size: z.number(),
  last_validated: z.string(),
});

export const ProvenanceRecordSchema = z.object({
  prediction_id: z.string(),
  canonical_fixture_id: z.string(),
  competition: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  kickoff_utc: z.string(),
  model_version: z.string(),
  model_family: z.string(),
  model_status: z.string(),
  feature_snapshot: z.object({
    as_of_timestamp: z.string(),
    point_in_time_verified: z.boolean(),
    anti_leakage_status: z.string(),
  }),
  odds_snapshot: z.object({
    provider: z.string(),
    bookmaker: z.string(),
    market: z.string(),
    odds: z.number(),
    snapshot_timestamp: z.string(),
  }),
  calculation: z.object({
    model_probability: z.number(),
    fair_odds: z.number(),
    ev: z.number(),
    calculation_version: z.string(),
  }),
  provenance_chain: z.array(z.string()),
});
