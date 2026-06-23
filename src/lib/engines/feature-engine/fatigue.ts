import { supabase } from '../../supabase.server';

export interface FatigueResult {
  homeRestDays: number;
  awayRestDays: number;
  homeTravelKm: number;
}

async function getRestDays(teamName: string, cutoffDate: Date): Promise<number> {
  const { data: match, error } = await supabase
    .from('matches')
    .select('kickoff')
    .or(`home_team.eq."${teamName}",away_team.eq."${teamName}"`)
    .lt('kickoff', cutoffDate.toISOString())
    .order('kickoff', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !match) {
    return 7; // Default to 7 rest days (1 week)
  }

  const lastKickoff = new Date(match.kickoff).getTime();
  const diffMs = cutoffDate.getTime() - lastKickoff;
  const restDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  return Math.max(0, restDays);
}

export class FatigueExtractor {
  static async extract(homeTeam: string, awayTeam: string, cutoffDate: Date): Promise<FatigueResult> {
    const homeRestDays = await getRestDays(homeTeam, cutoffDate);
    const awayRestDays = await getRestDays(awayTeam, cutoffDate);
    
    // Home team has 0 travel km because the match is hosted at their stadium.
    const homeTravelKm = 0;

    return {
      homeRestDays,
      awayRestDays,
      homeTravelKm
    };
  }
}
