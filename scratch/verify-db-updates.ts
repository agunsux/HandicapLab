import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  console.log('--- Database Verification for World Cup Fixtures ---');
  
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .ilike('league', '%World Cup%')
    .order('kickoff', { ascending: true });

  if (error) {
    console.error('Error fetching matches:', error);
    return;
  }

  console.log(`Found ${matches.length} World Cup matches in the database:`);
  
  matches.forEach((m, idx) => {
    console.log(`[Match #${idx + 1}] ID: ${m.id} | Kickoff: ${m.kickoff} | Teams: ${m.home_team} vs ${m.away_team} | Stage: ${m.tournament_stage} | Status: ${m.status}`);
  });
}

main();
