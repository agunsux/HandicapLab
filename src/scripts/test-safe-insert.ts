import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function testSafeInsert() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const testMatch = {
    home_team: 'TEST_HOME',
    away_team: 'TEST_AWAY',
    league: 'Premier League',
    kickoff: new Date().toISOString(),
    status: 'upcoming',
    competition_type: 'club'
  };

  const { data, error } = await supabase.from('matches').insert(testMatch).select();

  if (error) {
    console.log('INSERT: FAIL');
    console.log('error.code:', error.code);
    console.log('error.message:', error.message);
    console.log('error.details:', error.details);
  } else {
    console.log('INSERT: PASS');
    // Clean up
    await supabase.from('matches').delete().eq('id', data[0].id);
  }
}

testSafeInsert();
