export interface NormalizedCompetition {
  apiId: number;
  name: string;
  type: 'league' | 'cup';
  country: string;
  logoUrl?: string;
}

export interface NormalizedSeason {
  competitionApiId: number;
  year: number;
  startDate?: string;
  endDate?: string;
}

export interface NormalizedTeam {
  apiId: number;
  name: string;
  country?: string;
  logoUrl?: string;
}

export interface NormalizedVenue {
  apiId?: number;
  name: string;
  city?: string;
  capacity?: number;
  surface?: string;
}

export interface NormalizedReferee {
  apiId?: number;
  name: string;
  country?: string;
}

export interface NormalizedFixture {
  apiId: number;
  competitionApiId: number;
  seasonYear: number;
  kickoffTime: string;
  status: string;
  refereeName?: string;
  venueName?: string;
  venueCity?: string;
  homeTeamApiId: number;
  awayTeamApiId: number;
  homeGoals?: number;
  awayGoals?: number;
  htHomeGoals?: number;
  htAwayGoals?: number;
  detailsJson?: any;
}

export interface NormalizedStanding {
  competitionApiId: number;
  seasonYear: number;
  teamApiId: number;
  round: number;
  rank: number;
  points: number;
  goalsDiff: number;
  form?: string;
}

export class DataNormalizer {
  /**
   * Normalizes raw API-Football response formats.
   */
  public static apiFootballFixture(raw: any): NormalizedFixture {
    const fixture = raw.fixture;
    const league = raw.league;
    const teams = raw.teams;
    const goals = raw.goals;
    const score = raw.score;

    return {
      apiId: fixture.id,
      competitionApiId: league.id,
      seasonYear: league.season,
      kickoffTime: fixture.date,
      status: this.mapStatus(fixture.status.short),
      refereeName: fixture.referee || undefined,
      venueName: fixture.venue?.name || undefined,
      venueCity: fixture.venue?.city || undefined,
      homeTeamApiId: teams.home.id,
      awayTeamApiId: teams.away.id,
      homeGoals: (goals && goals.home !== null) ? goals.home : undefined,
      awayGoals: (goals && goals.away !== null) ? goals.away : undefined,
      htHomeGoals: (score && score.halftime && score.halftime.home !== null) ? score.halftime.home : undefined,
      htAwayGoals: (score && score.halftime && score.halftime.away !== null) ? score.halftime.away : undefined,
      detailsJson: {
        rawStatus: fixture.status.long,
        periods: fixture.periods,
        events: raw.events,
        lineups: raw.lineups,
        statistics: raw.statistics
      }
    };
  }

  /**
   * Normalizes raw Football-Data.org response formats.
   */
  public static footballDataFixture(raw: any): NormalizedFixture {
    return {
      apiId: raw.id,
      competitionApiId: raw.competition?.id,
      seasonYear: raw.season?.start ? new Date(raw.season.start).getFullYear() : new Date(raw.utcDate).getFullYear(),
      kickoffTime: raw.utcDate,
      status: this.mapStatus(raw.status),
      refereeName: raw.referees && raw.referees[0] ? raw.referees[0].name : undefined,
      venueName: raw.venue || undefined,
      homeTeamApiId: raw.homeTeam.id,
      awayTeamApiId: raw.awayTeam.id,
      homeGoals: (raw.score && raw.score.fullTime && raw.score.fullTime.home !== null) ? raw.score.fullTime.home : undefined,
      awayGoals: (raw.score && raw.score.fullTime && raw.score.fullTime.away !== null) ? raw.score.fullTime.away : undefined,
      htHomeGoals: (raw.score && raw.score.halfTime && raw.score.halfTime.home !== null) ? raw.score.halfTime.home : undefined,
      htAwayGoals: (raw.score && raw.score.halfTime && raw.score.halfTime.away !== null) ? raw.score.halfTime.away : undefined,
      detailsJson: {
        rawScore: raw.score
      }
    };
  }

  /**
   * Normalizes raw FootyStats response formats.
   */
  public static footyStatsFixture(raw: any): NormalizedFixture {
    return {
      apiId: raw.id,
      competitionApiId: raw.competition_id,
      seasonYear: parseInt(raw.season, 10) || new Date(raw.date_unix * 1000).getFullYear(),
      kickoffTime: new Date(raw.date_unix * 1000).toISOString(),
      status: raw.status === 'complete' ? 'finished' : (raw.status === 'suspended' ? 'postponed' : 'scheduled'),
      homeTeamApiId: raw.homeID,
      awayTeamApiId: raw.awayID,
      homeGoals: raw.homeGoalCount !== -1 ? raw.homeGoalCount : undefined,
      awayGoals: raw.awayGoalCount !== -1 ? raw.awayGoalCount : undefined,
      htHomeGoals: raw.ht_goals_team_a !== -1 ? raw.ht_goals_team_a : undefined,
      htAwayGoals: raw.ht_goals_team_b !== -1 ? raw.ht_goals_team_b : undefined,
      detailsJson: {
        xg_home: raw.xg_home,
        xg_away: raw.xg_away,
        corners_home: raw.corners_home,
        corners_away: raw.corners_away
      }
    };
  }

  private static mapStatus(shortStatus: string): string {
    if (!shortStatus) return 'scheduled';
    const statusMap: Record<string, string> = {
      'FT': 'finished',
      'AET': 'finished',
      'PEN': 'finished',
      'NS': 'scheduled',
      'TBD': 'scheduled',
      'PST': 'postponed',
      'CANC': 'cancelled',
      'ABD': 'abandoned',
      '1H': 'live',
      '2H': 'live',
      'HT': 'live',
      'ET': 'live',
      'P': 'live',
      'FINISHED': 'finished',
      'SCHEDULED': 'scheduled',
      'TIMED': 'scheduled',
      'IN_PLAY': 'live',
      'PAUSED': 'live',
      'POSTPONED': 'postponed',
      'CANCELLED': 'cancelled'
    };

    return statusMap[shortStatus.toUpperCase()] || 'scheduled';
  }
}
