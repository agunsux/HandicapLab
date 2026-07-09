import { z } from 'zod';

// 1. Team Schema
export const TeamSchema = z.object({
  apiId: z.number().int().positive(),
  name: z.string().min(1),
  country: z.string().optional(),
  logoUrl: z.string().optional().or(z.literal('')),
});

// 2. League Schema
export const LeagueSchema = z.object({
  apiId: z.number().int().positive(),
  name: z.string().min(1),
  country: z.string(),
  type: z.enum(['league', 'cup']),
  logoUrl: z.string().optional(),
});

// 3. Fixture Schema
export const FixtureSchema = z.object({
  fixtureId: z.string().min(1),
  league: z.string().min(1),
  season: z.string().min(1),
  tournamentStage: z.string().default('regular_season'),
  homeTeam: z.string().min(1),
  awayTeam: z.string().min(1),
  kickoffTime: z.coerce.date(),
  status: z.enum(['upcoming', 'live', 'finished', 'cancelled']).optional(),
  homeScore: z.number().int().nonnegative().nullable().optional(),
  awayScore: z.number().int().nonnegative().nullable().optional(),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});

// 4. Odds Schema (OddsSnapshot)
export const OddsSchema = z.object({
  id: z.string().optional(),
  fixtureId: z.string().min(1),
  bookmaker: z.string().min(1),
  marketType: z.enum(['asian_handicap', 'over_under', 'moneyline']),
  line: z.number(),
  priceHome: z.number().positive(),
  priceAway: z.number().positive(),
  priceDraw: z.number().positive().nullable(),
  capturedAt: z.coerce.date(),
  providerName: z.string(),
  rawResponseHash: z.string().optional(),
});

// 5. Standing Row & Standings
export const StandingRowSchema = z.object({
  rank: z.number().int().positive(),
  teamApiId: z.number().int().positive(),
  points: z.number().int().nonnegative(),
  goalsDiff: z.number().int(),
  form: z.string().optional(),
});

export const StandingSchema = z.object({
  competitionApiId: z.number().int().positive(),
  seasonYear: z.number().int().positive(),
  round: z.number().int().positive(),
  rows: z.array(StandingRowSchema),
});

// 6. Player Schema
export const PlayerSchema = z.object({
  apiId: z.number().int().positive(),
  name: z.string().min(1),
  nationality: z.string().optional(),
  position: z.string().optional(),
});

// 7. Prediction Schema
export const PredictionSchema = z.object({
  id: z.string().optional(),
  match_id: z.string(),
  market_type: z.enum(['ML', 'AH', 'OU']),
  home_team: z.string(),
  away_team: z.string(),
  prediction: z.record(z.string(), z.any()),
  odds_snapshot: z.any().optional(),
  model_version: z.string(),
  feature_version: z.string(),
  generated_at: z.string(),
  prediction_timestamp: z.string(),
  cohort_tag: z.string(),
  market_subtype: z.string().optional(),
  selection: z.string().nullable(),
  model_probability: z.number().nullable(),
  fair_odds: z.number().nullable(),
  edge_pct: z.number().nullable(),
  expected_value: z.number().nullable(),
  entry_odds: z.number().nullable(),
  confidence: z.number().nullable(),
  model_confidence: z.number().nullable(),
  data_confidence: z.number().nullable(),
  market_confidence: z.number().nullable(),
});

// 8. Settlement Schema
export const SettlementSchema = z.object({
  prediction_uuid: z.string().uuid(),
  snapshot_id: z.string(),
  match_result: z.object({
    home_goals: z.number().int().nonnegative(),
    away_goals: z.number().int().nonnegative(),
  }),
  closing_odds: z.number().positive(),
  line_movement: z.number(),
  clv: z.number(),
  brier_contribution: z.number(),
  logloss_contribution: z.number(),
  settlement_reason: z.string(),
  roi: z.number(),
  profit: z.number().nonnegative(),
  loss: z.number().nonnegative(),
  paper_trade: z.boolean(),
  calibration_bucket: z.string(),
});

// 9. Paper Trade Schema
export const PaperTradeSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string(),
  prediction_id: z.string().optional(),
  prediction_ledger_id: z.string().optional(),
  prediction_decision_id: z.string().optional(),
  match_id: z.string(),
  competition_id: z.string(),
  market_type: z.enum(['ML', 'AH', 'OU']),
  market_subtype: z.string().optional(),
  selection: z.string(),
  entry_odds: z.number().positive(),
  opening_odds: z.number().positive().optional(),
  odds: z.number().positive().optional(),
  stake: z.number().positive(),
  stake_units: z.number().positive().optional(),
  expected_value: z.number(),
  edge_score: z.number(),
  cohort_tag: z.string(),
  status: z.enum(['PENDING', 'WON', 'LOST', 'VOID', 'REFUNDED']),
  profit_loss: z.number().optional(),
});

// 10. Match Result Schema
export const MatchResultSchema = z.object({
  matchId: z.string(),
  homeTeam: z.string(),
  awayTeam: z.string(),
  homeGoals: z.number().int().nonnegative().nullable(),
  awayGoals: z.number().int().nonnegative().nullable(),
  status: z.string(),
  settledAt: z.string().optional(),
});

// 11. Historical Odds Schema
export const HistoricalOddsSchema = z.object({
  match_id: z.string(),
  market: z.enum(['ML', 'AH', 'OU']),
  line: z.number().nullable(),
  odds: z.number().positive(),
  bookmaker: z.string(),
  timestamp: z.string(),
});

// Types inferred from Schemas
export type Team = z.infer<typeof TeamSchema>;
export type League = z.infer<typeof LeagueSchema>;
export type Fixture = z.infer<typeof FixtureSchema>;
export type OddsSnapshot = z.infer<typeof OddsSchema>;
export type StandingRow = z.infer<typeof StandingRowSchema>;
export type Standing = z.infer<typeof StandingSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type Prediction = z.infer<typeof PredictionSchema>;
export type Settlement = z.infer<typeof SettlementSchema>;
export type PaperTrade = z.infer<typeof PaperTradeSchema>;
export type MatchResult = z.infer<typeof MatchResultSchema>;
export type HistoricalOdds = z.infer<typeof HistoricalOddsSchema>;
