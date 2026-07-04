import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  console.log('--- Phase 0 Deep Database Audit ---');
  
  // List all tables using RPC or by querying information_schema
  // We'll use a direct query via postgrest if possible, but since it's hard to do without direct pg access,
  // we will try to query known tables and their columns.
  
  const tables = [
    'matches',
    'predictions',
    'prediction_results',
    'prediction_decisions',
    'signals',
    'prediction_ledger',
    'prediction_snapshots',
    'paper_trades',
    'team_ratings',
    'cron_runs',
    'shadow_predictions'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`[TABLE MISSING/ERROR] ${table}: ${error.message}`);
    } else {
      console.log(`[TABLE EXISTS] ${table}`);
      if (data && data.length > 0) {
        console.log(`  Columns: ${Object.keys(data[0]).join(', ')}`);
      } else {
        console.log(`  (Table is empty)`);
      }
    }
  }
}

main().catch(console.error);
