import { supabase } from '../../supabase.server';

export interface StrengthResult {
  homeElo: number;
  awayElo: number;
  eloDelta: number;
}

/**
 * Dynamically computes Elo ratings for all teams by running a chronological simulation 
 * of all finished matches before the cutoff date.
 */
export class StrengthExtractor {
  static async extract(homeTeam: string, awayTeam: string, cutoffDate: Date): Promise<StrengthResult> {
    // Fetch all finished matches before cutoff chronologically
    const { data: matches, error } = await supabase
      .from('matches')
      .select('home_team, away_team, home_goals, away_goals')
      .eq('status', 'finished')
      .lt('kickoff', cutoffDate.toISOString())
      .order('kickoff', { ascending: true });

    const eloMap: Record<string, number> = {};
    const defaultElo = 1500;
    const K = 32;

    if (!error && matches) {
      for (const m of matches) {
        const hTeam = m.home_team;
        const aTeam = m.away_team;
        const hGoals = m.home_goals ?? 0;
        const aGoals = m.away_goals ?? 0;

        const eloH = eloMap[hTeam] ?? defaultElo;
        const eloA = eloMap[aTeam] ?? defaultElo;

        // Expectation calculation
        const expectedH = 1 / (1 + Math.pow(10, (eloA - eloH) / 400));
        const expectedA = 1 - expectedH;

        // Outcome score
        let scoreH = 0.5; // Draw
        if (hGoals > aGoals) scoreH = 1.0;
        else if (aGoals > hGoals) scoreH = 0.0;
        const scoreA = 1.0 - scoreH;

        // Update
        eloMap[hTeam] = Number((eloH + K * (scoreH - expectedH)).toFixed(1));
        eloMap[aTeam] = Number((eloA + K * (scoreA - expectedA)).toFixed(1));
      }
    }

    const homeElo = eloMap[homeTeam] ?? defaultElo;
    const awayElo = eloMap[awayTeam] ?? defaultElo;
    const eloDelta = Number((homeElo - awayElo).toFixed(1));

    return {
      homeElo,
      awayElo,
      eloDelta
    };
  }
}
