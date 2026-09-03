import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { supabase } from '../src/lib/supabase.server';

async function archiveSyntheticDailyPicks() {
  console.log('=== STAGE C: ARCHIVING SYNTHETIC ROWS IN daily_picks ===');

  // Count unarchived rows before
  const { count: unarchivedBefore, error: cErr } = await supabase
    .from('daily_picks')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'ARCHIVED');

  if (cErr) {
    console.error('Error counting daily_picks:', cErr);
    return;
  }
  console.log(`Unarchived daily_picks count before: ${unarchivedBefore}`);

  // Update in batches or by condition
  // Rule 5: Archive, never hard-delete.
  const { data, error } = await supabase
    .from('daily_picks')
    .update({ status: 'ARCHIVED' })
    .neq('status', 'ARCHIVED')
    .select('id');

  if (error) {
    console.error('Error archiving daily_picks:', error);
    return;
  }

  console.log(`Successfully updated ${data?.length || 0} rows to status='ARCHIVED'`);

  // Verify remaining active rows
  const { count: activeAfter, error: aErr } = await supabase
    .from('daily_picks')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'ARCHIVED');

  console.log(`Active (non-archived) daily_picks count after: ${activeAfter}`);

  // Also verify Everton vs Arsenal specifically
  const { count: evertonCount } = await supabase
    .from('daily_picks')
    .select('*', { count: 'exact', head: true })
    .eq('home_team', 'Everton')
    .eq('away_team', 'Arsenal')
    .neq('status', 'ARCHIVED');

  console.log(`Active Everton vs Arsenal picks: ${evertonCount} (must be 0)`);
}

archiveSyntheticDailyPicks().catch(console.error);
