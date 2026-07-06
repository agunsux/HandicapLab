import { supabase } from '../../supabase.server';

export interface XgResult {
  homeAttack: number;
  homeDefense: number;
  awayAttack: number;
  awayDefense: number;
  leagueAvgGoals: number;
}

export class XgExtractor {
  static async extract(homeTeam: string, awayTeam: string, cutoffDate: Date, leagueId: string = 'EPL'): Promise<XgResult> {
    // 1. Fetch all finished matches before cutoff date to compute league averages
    const { data: allMatches, error: allErr } = await supabase
      .from('matches')
      .select('home_team, away_team, home_goals, away_goals')
      .eq('status', 'finished')
      .eq('league', leagueId)
      .lt('kickoff', cutoffDate.toISOString());

    if (allErr || !allMatches || allMatches.length === 0) {
      // Return neutral baseline defaults if no data exists yet
      return {
        homeAttack: 1.0,
        homeDefense: 1.0,
        awayAttack: 1.0,
        awayDefense: 1.0,
        leagueAvgGoals: 2.5
      };
    }

    const totalMatches = allMatches.length;
    const totalHomeGoals = allMatches.reduce((sum, m) => sum + (m.home_goals ?? 0), 0);
    const totalAwayGoals = allMatches.reduce((sum, m) => sum + (m.away_goals ?? 0), 0);

    const leagueAvgHomeGoals = totalHomeGoals / totalMatches;
    const leagueAvgAwayGoals = totalAwayGoals / totalMatches;
    const leagueAvgGoals = (totalHomeGoals + totalAwayGoals) / totalMatches;

    // 2. Fetch matches for the specific home team at home
    const homeTeamHomeMatches = allMatches.filter(m => m.home_team === homeTeam);
    let homeAttack = 1.0;
    let homeDefense = 1.0;

    if (homeTeamHomeMatches.length > 0) {
      const avgScored = homeTeamHomeMatches.reduce((sum, m) => sum + (m.home_goals ?? 0), 0) / homeTeamHomeMatches.length;
      const avgConceded = homeTeamHomeMatches.reduce((sum, m) => sum + (m.away_goals ?? 0), 0) / homeTeamHomeMatches.length;
      
      homeAttack = leagueAvgHomeGoals > 0 ? avgScored / leagueAvgHomeGoals : 1.0;
      homeDefense = leagueAvgAwayGoals > 0 ? avgConceded / leagueAvgAwayGoals : 1.0;
    }

    // 3. Fetch matches for the specific away team away
    const awayTeamAwayMatches = allMatches.filter(m => m.away_team === awayTeam);
    let awayAttack = 1.0;
    let awayDefense = 1.0;

    if (awayTeamAwayMatches.length > 0) {
      const avgScored = awayTeamAwayMatches.reduce((sum, m) => sum + (m.away_goals ?? 0), 0) / awayTeamAwayMatches.length;
      const avgConceded = awayTeamAwayMatches.reduce((sum, m) => sum + (m.home_goals ?? 0), 0) / awayTeamAwayMatches.length;

      awayAttack = leagueAvgAwayGoals > 0 ? avgScored / leagueAvgAwayGoals : 1.0;
      awayDefense = leagueAvgHomeGoals > 0 ? avgConceded / leagueAvgHomeGoals : 1.0;
    }

    return {
      homeAttack: Number(homeAttack.toFixed(4)),
      homeDefense: Number(homeDefense.toFixed(4)),
      awayAttack: Number(awayAttack.toFixed(4)),
      awayDefense: Number(awayDefense.toFixed(4)),
      leagueAvgGoals: Number(leagueAvgGoals.toFixed(4))
    };
  }
}
