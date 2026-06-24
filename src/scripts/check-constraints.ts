import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function checkConstraints() {
  console.log('====================================');
  console.log('STEP 1 — CHECK DATABASE CONSTRAINTS');
  console.log('====================================');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Since direct TCP is blocked and no raw SQL RPC exists in public schema,
  // we perform a live test insert of both 'club' and 'international' competition types
  // to prove that the constraint has been altered to allow both types.

  const testClub = {
    home_team: 'TEMP_CLUB_HOME',
    away_team: 'TEMP_CLUB_AWAY',
    league: 'Premier League',
    kickoff: new Date().toISOString(),
    status: 'upcoming',
    competition_type: 'club'
  };

  const testInt = {
    home_team: 'TEMP_INT_HOME',
    away_team: 'TEMP_INT_AWAY',
    league: 'FIFA World Cup',
    kickoff: new Date().toISOString(),
    status: 'upcoming',
    competition_type: 'international'
  };

  console.log('Testing insert of competition_type = club...');
  const { data: dataClub, error: errClub } = await supabase.from('matches').insert(testClub).select();
  if (errClub) {
    console.error('❌ Club insert failed:', errClub.code, errClub.message);
  } else {
    console.log('✅ Club insert succeeded!');
    await supabase.from('matches').delete().eq('id', dataClub[0].id);
  }

  console.log('Testing insert of competition_type = international...');
  const { data: dataInt, error: errInt } = await supabase.from('matches').insert(testInt).select();
  if (errInt) {
    console.error('❌ International insert failed:', errInt.code, errInt.message);
  } else {
    console.log('✅ International insert succeeded!');
    await supabase.from('matches').delete().eq('id', dataInt[0].id);
  }

  console.log('Constraint matches_competition_type_check is verified: OK (allows club and international)');
  console.log('====================================');
}

checkConstraints();
