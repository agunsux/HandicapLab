import { supabase } from '../../supabase.server';

export interface FormResult {
  homeFormLast5: number[];
  awayFormLast5: number[];
  homeFormWeighted: number;
  awayFormWeighted: number;
}

/**
 * Calculates recency-weighted form score based on points earned (Win=3, Draw=1, Loss=0)
 */
function calculateWeightedForm(points: number[]): number {
  if (points.length === 0) return 1.5; // Neutral default (1.5 pts/game)
  
  let weightedSum = 0;
  let weightTotal = 0;
  
  // Assign higher weights to the most recent matches (index 0 is most recent)
  for (let i = 0; i < points.length; i++) {
    const weight = points.length - i;
    weightedSum += points[i] * weight;
    weightTotal += weight;
  }
  
  return Number((weightedSum / weightTotal).toFixed(2));
}

async function getTeamPoints(teamName: string, cutoffDate: Date, leagueId: string): Promise<number[]> {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('home_team, away_team, home_goals, away_goals, kickoff')
    .eq('status', 'finished')
    .eq('league', leagueId)
    .or(`home_team.eq."${teamName}",away_team.eq."${teamName}"`)
    .lt('kickoff', cutoffDate.toISOString())
    .order('kickoff', { ascending: false })
    .limit(5);

  if (error || !matches) {
    return [];
  }

  return matches.map(m => {
    const isHome = m.home_team === teamName;
    const hGoals = m.home_goals ?? 0;
    const aGoals = m.away_goals ?? 0;
    
    if (hGoals === aGoals) return 1; // Draw
    if (isHome && hGoals > aGoals) return 3; // Home Win
    if (!isHome && aGoals > hGoals) return 3; // Away Win
    return 0; // Loss
  });
}

export class FormExtractor {
  static async extract(homeTeam: string, awayTeam: string, cutoffDate: Date, leagueId: string = 'EPL'): Promise<FormResult> {
    const homeFormLast5 = await getTeamPoints(homeTeam, cutoffDate, leagueId);
    const awayFormLast5 = await getTeamPoints(awayTeam, cutoffDate, leagueId);

    const homeFormWeighted = calculateWeightedForm(homeFormLast5);
    const awayFormWeighted = calculateWeightedForm(awayFormLast5);

    return {
      homeFormLast5,
      awayFormLast5,
      homeFormWeighted,
      awayFormWeighted
    };
  }
}
