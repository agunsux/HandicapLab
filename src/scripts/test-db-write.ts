import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function testWrite() {
  console.log('Testing Supabase REST write...');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const testMatch = {
    home_team: 'Test Home Team',
    away_team: 'Test Away Team',
    league: 'Premier League',
    kickoff: new Date().toISOString(),
    status: 'upcoming',
    competition_type: 'club'
  };

  console.log('Inserting test match...');
  const { data, error } = await supabase
    .from('matches')
    .insert(testMatch)
    .select();

  if (error) {
    console.error('❌ Insert failed:', error.message);
  } else {
    console.log('✅ Insert succeeded! Data:', data);
    
    // Clean up
    console.log('Cleaning up test match...');
    const { error: deleteErr } = await supabase
      .from('matches')
      .delete()
      .eq('id', data[0].id);

    if (deleteErr) {
      console.error('❌ Cleanup failed:', deleteErr.message);
    } else {
      console.log('✅ Cleanup succeeded!');
    }
  }
}

testWrite();
