export interface CanonicalCompetition {
  apiId: number;
  name: string;
  country: string;
  type: 'league' | 'cup';
  logoUrl?: string;
}

export interface CanonicalSeason {
  competitionApiId: number;
  year: number;
  startDate?: string;
  endDate?: string;
}

export interface CanonicalTeam {
  apiId: number;
  name: string;
  country?: string;
  logoUrl?: string;
}

export interface CanonicalVenue {
  apiId?: number;
  name: string;
  city?: string;
  capacity?: number;
  surface?: string;
}

export interface CanonicalReferee {
  apiId?: number;
  name: string;
  country?: string;
}

export interface CanonicalCoach {
  apiId?: number;
  name: string;
  nationality?: string;
}

export interface CanonicalFixture {
  apiId: number;
  competitionApiId: number;
  seasonYear: number;
  kickoffTime: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled' | 'abandoned';
  referee?: CanonicalReferee;
  venue?: CanonicalVenue;
  homeTeamApiId: number;
  awayTeamApiId: number;
  homeGoals?: number;
  awayGoals?: number;
  htHomeGoals?: number;
  htAwayGoals?: number;
  detailsJson?: any;
}

export interface CanonicalBookmaker {
  apiId: number;
  name: string;
}

export interface CanonicalMarket {
  apiId: number;
  name: string;
}

export interface CanonicalOutcome {
  selection: string; // e.g. 'Home', 'Away', 'Draw', 'Over 2.5', '+0.5'
  odds: number;
}

export interface CanonicalOddsSnapshot {
  fixtureId: number;
  bookmakerId: number;
  marketId: number;
  timestamp: string;
  outcomes: CanonicalOutcome[];
}

export interface CanonicalStandingRow {
  rank: number;
  teamApiId: number;
  points: number;
  goalsDiff: number;
  form?: string;
}

export interface CanonicalStandings {
  competitionApiId: number;
  seasonYear: number;
  round: number;
  rows: CanonicalStandingRow[];
}

export interface CanonicalPlayer {
  apiId: number;
  name: string;
  nationality?: string;
  position?: string;
}
