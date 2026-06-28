import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .order('kickoff', { ascending: true });

  if (error) {
    console.error('Error fetching matches:', error);
    return;
  }

  console.log(`Found ${matches.length} matches total in database.`);
  
  // Print unique league names
  const leagues = new Set(matches.map(m => m.league));
  console.log('Unique leagues:', Array.from(leagues));

  // Let's filter matches for names like Japan, Germany, Paraguay, Brazil, etc.
  const keywordMatches = matches.filter(m => 
    /Japan|Germany|Paraguay|Brazil|Argentina|France|Spain|England|Portugal|Netherlands|Belgium|Italy/i.test(m.home_team) ||
    /Japan|Germany|Paraguay|Brazil|Argentina|France|Spain|England|Portugal|Netherlands|Belgium|Italy/i.test(m.away_team)
  );

  console.log(`\nFiltered keyword matches (${keywordMatches.length}):`);
  keywordMatches.forEach(m => {
    console.log(`ID: ${m.id} | ${m.kickoff} | ${m.league} | ${m.home_team} vs ${m.away_team} | status: ${m.status} | stage: ${m.tournament_stage}`);
  });
}

main();
