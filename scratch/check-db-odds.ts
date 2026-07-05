import 'dotenv/config';
import { supabase } from '../src/lib/supabase.server';

async function main() {
  try {
    const { data: matchesWithOdds, error } = await supabase
      .from('odds_snapshots')
      .select('match_id');
      
    if (error) throw error;
    
    const uniqueMatches = Array.from(new Set(matchesWithOdds.map(m => m.match_id)));
    
    const { data: finishedMatches, error: matchErr } = await supabase
      .from('matches')
      .select('id, home_team, away_team, status, home_goals, away_goals')
      .in('id', uniqueMatches)
      .eq('status', 'finished');
      
    if (matchErr) throw matchErr;
    console.log(`Finished matches with odds snapshots: ${finishedMatches?.length}`);
    if (finishedMatches && finishedMatches.length > 0) {
      console.log('Sample finished matches with odds snapshots:', finishedMatches.slice(0, 5));
    }
  } catch (err: any) {
    console.error('Failed:', err.message);
  }
}

main();
