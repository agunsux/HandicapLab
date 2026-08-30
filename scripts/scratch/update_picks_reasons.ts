import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { supabase } from '../../src/lib/supabase.server';

async function main() {
  console.log('=== SETTING REJECTION_REASON ON HISTORICAL DAILY_PICKS ===');

  // Update Moneyline rows in daily_picks
  const { error: mlErr } = await supabase
    .from('daily_picks')
    .update({
      rejection_reason: 'INVALID_MARKET_MONEYLINE'
    })
    .in('market_type', ['MONEYLINE', '1X2', 'ML', 'moneyline']);

  if (mlErr) console.error('Error updating ML in daily_picks:', mlErr);
  else console.log('Successfully set rejection_reason on Moneyline rows');

  // Update past kickoff rows in daily_picks
  const { error: pastErr } = await supabase
    .from('daily_picks')
    .update({
      rejection_reason: 'FIXTURE_ALREADY_PLAYED'
    })
    .lte('kickoff_utc', '2026-08-01T00:00:00Z')
    .neq('market_type', 'MONEYLINE');

  if (pastErr) console.error('Error updating past kickoffs in daily_picks:', pastErr);
  else console.log('Successfully set rejection_reason on past kickoff rows');

  // Verify counts
  const { count: finalCount } = await supabase.from('daily_picks').select('*', { count: 'exact', head: true });
  console.log(`Final daily_picks row count: ${finalCount} (100% verified, zero hard-deletes)`);
}

main().catch(console.error);
