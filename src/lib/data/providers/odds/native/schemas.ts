// Native OddsPAPI v4 Zod Schemas
// Location: src/lib/data/providers/odds/native/schemas.ts
// Verified against https://oddspapi.io/us/docs (GET sports, tournaments, bookmakers,
// markets, fixtures, odds, odds-by-tournaments). These schemas intentionally do NOT
// reuse the legacy The-Odds-API response model.

import { z } from 'zod';

// ─── Metadata schemas ────────────────────────────────────────────────

export const NativeSportSchema = z.object({
  sportId: z.number(),
  slug: z.string(),
  sportName: z.string(),
});

export const NativeTournamentSchema = z.object({
  tournamentId: z.number(),
  tournamentSlug: z.string(),
  tournamentName: z.string(),
  categorySlug: z.string(),
  categoryName: z.string(),
  futureFixtures: z.number(),
  upcomingFixtures: z.number(),
  liveFixtures: z.number(),
});

export const NativeBookmakerSchema = z.object({
  bookmakerName: z.string(),
  slug: z.string(),
  liveOdds: z.boolean().nullable(),
  cloneOf: z.string().nullable(),
});

export const NativeMarketOutcomeSchema = z.object({
  outcomeId: z.number(),
  outcomeName: z.string(),
});

export const NativeMarketSchema = z.object({
  marketId: z.number(),
  marketLength: z.number(),
  marketName: z.string(),
  playerProp: z.boolean(),
  sportId: z.number(),
  handicap: z.number(),
  period: z.string(),
  marketType: z.string(),
  outcomes: z.array(NativeMarketOutcomeSchema),
});

// ─── Odds response schemas (GET /v4/odds and GET /v4/odds-by-tournaments) ───

export const NativeOutcomePlayerSchema = z.object({
  active: z.boolean().optional().default(true),
  betslip: z.string().nullable().optional(),
  bookmakerOutcomeId: z.string().nullable().optional(),
  bookmakerChangedAt: z.string().nullable().optional(),
  changedAt: z.string().nullable().optional(),
  limit: z.number().nullable().optional(),
  playerName: z.string().nullable().optional(),
  price: z.number(),
  priceAmerican: z.string().nullable().optional(),
  priceFractional: z.string().nullable().optional(),
  mainLine: z.boolean().optional(),
  exchangeMeta: z.unknown().nullable().optional(),
});

export const NativeOutcomeSchema = z.object({
  players: z.record(z.string(), NativeOutcomePlayerSchema),
});

export const NativeBookmakerMarketSchema = z.object({
  bookmakerMarketId: z.string().nullable().optional(),
  marketActive: z.boolean().nullable().optional(),
  outcomes: z.record(z.string(), NativeOutcomeSchema),
});

export const NativeBookmakerOddsSchema = z.object({
  bookmakerIsActive: z.boolean().nullable().optional(),
  bookmakerFixtureId: z.string().nullable().optional(),
  fixturePath: z.string().nullable().optional(),
  suspended: z.boolean().nullable().optional(),
  markets: z.record(z.string(), NativeBookmakerMarketSchema),
});

export const NativeOddsFixtureSchema = z.object({
  fixtureId: z.string(),
  participant1Id: z.number(),
  participant2Id: z.number(),
  participant1Name: z.string().nullable().optional(),
  participant2Name: z.string().nullable().optional(),
  sportId: z.number(),
  tournamentId: z.number(),
  seasonId: z.number().nullable().optional(),
  statusId: z.number(),
  hasOdds: z.boolean(),
  startTime: z.string(),
  trueStartTime: z.string().nullable().optional(),
  trueEndTime: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  statusName: z.string().nullable().optional(),
  sportName: z.string().nullable().optional(),
  tournamentSlug: z.string().nullable().optional(),
  categorySlug: z.string().nullable().optional(),
  categoryName: z.string().nullable().optional(),
  tournamentName: z.string().nullable().optional(),
  bookmakerOdds: z.record(z.string(), NativeBookmakerOddsSchema).nullable().optional(),
});

// GET /v4/odds returns a single fixture object; GET /v4/odds-by-tournaments
// returns an array of fixture objects. Accept both defensively.
export const NativeOddsResponseSchema = z.union([
  z.array(NativeOddsFixtureSchema),
  NativeOddsFixtureSchema,
]);

export const NativeFixturesResponseSchema = z.array(NativeOddsFixtureSchema);
export const NativeSportsResponseSchema = z.array(NativeSportSchema);
export const NativeTournamentsResponseSchema = z.array(NativeTournamentSchema);
export const NativeBookmakersResponseSchema = z.array(NativeBookmakerSchema);
export const NativeMarketsResponseSchema = z.array(NativeMarketSchema);

// ─── Derived types ───────────────────────────────────────────────────

export type NativeSport = z.infer<typeof NativeSportSchema>;
export type NativeTournament = z.infer<typeof NativeTournamentSchema>;
export type NativeBookmaker = z.infer<typeof NativeBookmakerSchema>;
export type NativeMarket = z.infer<typeof NativeMarketSchema>;
export type NativeMarketOutcome = z.infer<typeof NativeMarketOutcomeSchema>;
export type NativeOddsFixture = z.infer<typeof NativeOddsFixtureSchema>;
export type NativeBookmakerOdds = z.infer<typeof NativeBookmakerOddsSchema>;
export type NativeBookmakerMarket = z.infer<typeof NativeBookmakerMarketSchema>;
export type NativeOutcome = z.infer<typeof NativeOutcomeSchema>;
export type NativeOutcomePlayer = z.infer<typeof NativeOutcomePlayerSchema>;
