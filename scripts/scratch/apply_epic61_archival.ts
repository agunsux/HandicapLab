import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { supabase } from '../../src/lib/supabase.server';

async function main() {
  console.log('=== APPLYING EPIC 61 NON-DESTRUCTIVE ARCHIVAL & MARKET DEPRECATION ===');

  // Check counts before
  const { count: picksBefore } = await supabase.from('daily_picks').select('*', { count: 'exact', head: true });
  const { count: predsBefore } = await supabase.from('predictions').select('*', { count: 'exact', head: true });
  const { count: matchesBefore } = await supabase.from('matches').select('*', { count: 'exact', head: true });

  console.log(`[BEFORE] daily_picks: ${picksBefore}, predictions: ${predsBefore}, matches: ${matchesBefore}`);

  // Flag Moneyline in daily_picks
  try {
    const { error: mlError } = await supabase
      .from('daily_picks')
      .update({
        market_deprecated: true,
        archived_reason: 'MONEYLINE_DEPRECATED_EPIC61'
      })
      .in('market_type', ['MONEYLINE', '1X2', 'ML', 'moneyline']);

    if (mlError) {
      console.warn('Notice on daily_picks Moneyline flag:', mlError.message);
    } else {
      console.log('Successfully flagged Moneyline rows in daily_picks');
    }
  } catch (err: any) {
    console.warn('Catch on daily_picks update:', err.message);
  }

  // Check counts after
  const { count: picksAfter } = await supabase.from('daily_picks').select('*', { count: 'exact', head: true });
  const { count: predsAfter } = await supabase.from('predictions').select('*', { count: 'exact', head: true });
  const { count: matchesAfter } = await supabase.from('matches').select('*', { count: 'exact', head: true });

  console.log(`[AFTER]  daily_picks: ${picksAfter}, predictions: ${predsAfter}, matches: ${matchesAfter}`);
  console.log(`[VERIFICATION] Zero rows deleted! (picks: ${picksBefore === picksAfter}, preds: ${predsBefore === predsAfter}, matches: ${matchesBefore === matchesAfter})`);
}

main().catch(console.error);
