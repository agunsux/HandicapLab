// API-Football Response Normalizers — Raw API Response → Normalized Application Objects
// Location: src/lib/data/providers/apiFootball/normalizers.ts

import type { Fixture } from '../types';

export interface RawApiFootballFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; long: string };
  };
  league: {
    id: number;
    name: string;
    season: number;
  };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}

export interface RawApiFootballResponse {
  get: string;
  parameters: Record<string, string>;
  errors: any[];
  results: number;
  paging: { current: number; total: number };
  response: RawApiFootballFixture[];
}

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

export interface NormalizedTeam {
  teamId: string;
  name: string;
  code: string | null;
  country: string;
  logo: string;
}

export function normalizeTeams(rawResponse: any): NormalizedTeam[] {
  const response = rawResponse?.response ?? [];
  return response.map((t: any) => ({
    teamId: `af_${t.team.id}`,
    name: t.team.name,
    code: t.team.code ?? null,
    country: t.team.country,
    logo: t.team.logo,
  }));
}
