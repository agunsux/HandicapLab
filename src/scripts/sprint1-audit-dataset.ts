import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  console.log('--- Phase A: Dataset Audit (EPL 2016-2025) ---');
  
  // Find all matches for England Premier League
  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, league, kickoff, home_team, away_team, status, home_goals, away_goals')
    .or('league.ilike.%premier league%,league.ilike.%epl%,league.ilike.%england - premier%')
    .order('kickoff', { ascending: true });

  if (error) {
    console.error('Error fetching matches:', error.message);
    return;
  }

  console.log(`Total EPL Matches found: ${matches.length}`);

  if (matches.length === 0) {
    console.log('No EPL matches found in the database. Checking all available leagues to see what we have...');
    const { data: leagues } = await supabase
      .from('matches')
      .select('league');
    
    const uniqueLeagues = new Set((leagues || []).map(l => l.league));
    console.log('Available Leagues:', Array.from(uniqueLeagues));
    return;
  }

  const byYear: Record<string, number> = {};
  let totalMissingScores = 0;
  
  for (const match of matches) {
    const year = new Date(match.kickoff).getFullYear().toString();
    byYear[year] = (byYear[year] || 0) + 1;
    
    if (match.status === 'finished' || match.status === 'complete' || match.status === 'FT') {
       if (match.home_goals === null || match.away_goals === null) {
          totalMissingScores++;
       }
    }
  }

  console.log('\n--- Coverage by Year ---');
  console.table(byYear);

  console.log(`\nMatches with missing scores: ${totalMissingScores}`);
  
  // Check Odds Table if exists
  const { data: oddsData, error: oddsErr } = await supabase.from('odds').select('id').limit(1);
  if (oddsErr) {
    console.log('Odds table not found or error:', oddsErr.message);
  } else {
    console.log('Odds table exists. Need to check odds coverage.');
  }

}

main().catch(console.error);
