import { supabase } from '../lib/supabase.server';

async function verify() {
  console.log('[Verification] Executing DB count queries...');

  const tables = [
    'raw_import_jobs',
    'raw_matches',
    'raw_odds',
    'raw_statistics',
    'wh_fixtures'
  ];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error(`[Verification] Error querying count for ${table}:`, error.message);
    } else {
      console.log(`[Verification] Table "${table}" count: ${count}`);
    }
  }

  // Fetch 5 matches
  console.log('\n[Verification] Fetching first 5 fixtures...');
  const { data: fixtures, error: fixErr } = await supabase
    .from('wh_fixtures')
    .select('id, season_id, kickoff_time, home_team_id, away_team_id, status')
    .order('kickoff_time')
    .limit(5);

  if (fixErr) {
    console.error('[Verification] Error fetching fixtures:', fixErr.message);
  } else {
    console.table(fixtures);
  }

  // Fetch 20 odds
  console.log('\n[Verification] Fetching first 20 raw odds...');
  const { data: odds, error: oddsErr } = await supabase
    .from('raw_odds')
    .select('match_id, bookmaker, market, selection, price')
    .limit(20);

  if (oddsErr) {
    console.error('[Verification] Error fetching odds:', oddsErr.message);
  } else {
    console.table(odds);
  }
}

verify().catch(console.error);
