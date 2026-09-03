import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { supabase } from '../src/lib/supabase.server';

async function archiveAllSyntheticPicks() {
  console.log('=== STAGE C.1: COMPLETE ARCHIVAL OF SYNTHETIC DATA IN SUPABASE ===');

  // 1. Update all daily_picks rows
  const { count: totalPicks } = await supabase
    .from('daily_picks')
    .select('*', { count: 'exact', head: true });

  console.log(`Total daily_picks in database: ${totalPicks}`);

  const { data, error } = await supabase
    .from('daily_picks')
    .update({
      rejection_reason: 'ARCHIVED_SYNTHETIC_EPIC63',
      verdict: 'LEWATI',
      reasoning: 'Archived synthetic dummy fixture per EPIC 63 Zero-Dummy Invariant.',
    })
    .neq('rejection_reason', 'ARCHIVED_SYNTHETIC_EPIC63')
    .select('id');

  if (error) {
    console.error('Error updating daily_picks:', error);
  } else {
    console.log(`Updated remaining ${data?.length || 0} rows in daily_picks`);
  }

  // 2. Verify all daily_picks now have rejection_reason='ARCHIVED_SYNTHETIC_EPIC63'
  const { count: unarchivedPicks } = await supabase
    .from('daily_picks')
    .select('*', { count: 'exact', head: true })
    .neq('rejection_reason', 'ARCHIVED_SYNTHETIC_EPIC63');

  console.log(`Remaining unarchived daily_picks: ${unarchivedPicks} (MUST BE 0)`);

  // 3. Verify matches status
  const { count: totalMatches } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true });

  const { count: quarantinedMatches } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('data_status', 'QUARANTINED');

  console.log(`Matches in DB: ${totalMatches}, Quarantined matches: ${quarantinedMatches}`);
}

archiveAllSyntheticPicks().catch(console.error);
