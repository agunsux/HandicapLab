export interface MatchFeatures {
  matchId: string;
  marketType: 'AH' | 'OU' | 'ML';
  kickoffAt: Date;
  homeFormLast5: number[];
  awayFormLast5: number[];
  homeFormWeighted: number;
  awayFormWeighted: number;
  homeRestDays: number;
  awayRestDays: number;
  homeTravelKm: number;
  homeElo: number;
  awayElo: number;
  eloDelta: number;
  homeAttack: number;
  homeDefense: number;
  awayAttack: number;
  awayDefense: number;
  leagueAvgGoals: number;
  isHomeAdvantage: boolean;
  leagueId: string;
  season: string;
  generatedAt: Date; // MUST be <= kickoffAt
  competitionType?: 'club' | 'international';
  squadFamiliarity?: number;
  tournamentStage?: string;
  fifaRankingHome?: number;
  fifaRankingAway?: number;
  squadContinuityHome?: number;
  squadContinuityAway?: number;
  knockoutPressure?: number;
  internationalAdjustmentScore?: number;
  historicalMatchesCount?: number;
}
