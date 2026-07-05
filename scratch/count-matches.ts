import 'dotenv/config';
import { supabase } from '../src/lib/supabase.server';

async function countMatches() {
  console.log('Querying matches table from Supabase...');
  try {
    const { data: matches, error } = await supabase
      .from('matches')
      .select('league, status, kickoff');
    
    if (error) {
      throw error;
    }

    console.log(`Total matches in DB: ${matches?.length}`);
    if (matches && matches.length > 0) {
      const leagues: Record<string, number> = {};
      matches.forEach(m => {
        leagues[m.league] = (leagues[m.league] || 0) + 1;
      });
      console.log('Matches by league:', leagues);
    }
  } catch (err: any) {
    console.error('Query failed:', err.message);
  }
}

countMatches();
