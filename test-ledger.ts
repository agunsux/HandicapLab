import { supabase } from './src/lib/supabase.server';

async function run() {
  const { data, error } = await supabase
    .from('predictions')
    .select('id, home_team, away_team')
    .order('expected_value', { ascending: false })
    .limit(5);
  console.log('Data:', data);
  console.log('Error:', error);
}
run();
