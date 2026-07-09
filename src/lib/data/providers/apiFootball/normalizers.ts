// API-Football Response Normalizers — Raw API Response → Normalized Application Objects
// Location: src/lib/data/providers/apiFootball/normalizers.ts

import { z } from 'zod';
import type { Fixture } from '../types';

export const RawApiFootballFixtureSchema = z.object({
  fixture: z.object({
    id: z.number(),
    date: z.string(),
    status: z.object({ short: z.string(), long: z.string() }),
  }),
  league: z.object({
    id: z.number(),
    name: z.string(),
    season: z.number(),
  }),
  teams: z.object({
    home: z.object({ id: z.number(), name: z.string(), logo: z.string().optional().or(z.literal('')) }),
    away: z.object({ id: z.number(), name: z.string(), logo: z.string().optional().or(z.literal('')) }),
  }),
  goals: z.object({
    home: z.number().nullable(),
    away: z.number().nullable(),
  }),
  score: z.object({
    halftime: z.object({ home: z.number().nullable(), away: z.number().nullable() }),
    fulltime: z.object({ home: z.number().nullable(), away: z.number().nullable() }),
    extratime: z.object({ home: z.number().nullable(), away: z.number().nullable() }),
    penalty: z.object({ home: z.number().nullable(), away: z.number().nullable() }),
  }),
});

export const RawApiFootballResponseSchema = z.object({
  get: z.string(),
  parameters: z.record(z.string(), z.any()),
  errors: z.union([z.array(z.any()), z.record(z.string(), z.any())]).optional().nullable(),
  results: z.number(),
  paging: z.object({ current: z.number(), total: z.number() }),
  response: z.array(RawApiFootballFixtureSchema),
});

export type RawApiFootballFixture = z.infer<typeof RawApiFootballFixtureSchema>;
export type RawApiFootballResponse = z.infer<typeof RawApiFootballResponseSchema>;

export function normalizeFixtureStatus(apiStatus: string): Fixture['status'] {
  switch (apiStatus) {
    case 'TBD': return 'upcoming';
    case 'NS': return 'upcoming';
    case '1H':
    case '2H':
    case 'HT':
    case 'ET':
    case 'P':
    case 'BT':
    case 'INT':
      return 'live';
    case 'FT':
    case 'AET':
    case 'PEN':
      return 'finished';
    case 'CANC':
    case 'ABD':
    case 'AWD':
    case 'WO':
      return 'cancelled';
    case 'PST':
    case 'SUSP':
      return 'upcoming'; // postponed — still upcoming
    default:
      return 'upcoming';
  }
}

export function normalizeFixture(raw: RawApiFootballFixture): Fixture {
  const status = normalizeFixtureStatus(raw.fixture.status.short);
  return {
    fixtureId: `af_${raw.fixture.id}`,
    league: raw.league.name,
    season: String(raw.league.season),
    tournamentStage: 'regular_season',
    homeTeam: raw.teams.home.name,
    awayTeam: raw.teams.away.name,
    kickoffTime: new Date(raw.fixture.date),
    status,
    homeScore: raw.goals.home,
    awayScore: raw.goals.away,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function normalizeFixtures(raw: RawApiFootballResponse): Fixture[] {
  return (raw.response ?? []).map(normalizeFixture);
}

export const RawApiFootballTeamItemSchema = z.object({
  team: z.object({
    id: z.number(),
    name: z.string(),
    code: z.string().nullable().optional(),
    country: z.string(),
    logo: z.string(),
  }),
});

export const RawApiFootballTeamsResponseSchema = z.object({
  response: z.array(RawApiFootballTeamItemSchema),
});

export type RawApiFootballTeamsResponse = z.infer<typeof RawApiFootballTeamsResponseSchema>;

export interface NormalizedTeam {
  teamId: string;
  name: string;
  code: string | null;
  country: string;
  logo: string;
}

export function normalizeTeams(rawResponse: RawApiFootballTeamsResponse): NormalizedTeam[] {
  const response = rawResponse?.response ?? [];
  return response.map((t) => ({
    teamId: `af_${t.team.id}`,
    name: t.team.name,
    code: t.team.code ?? null,
    country: t.team.country,
    logo: t.team.logo,
  }));
}
