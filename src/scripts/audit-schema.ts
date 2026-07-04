import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  console.log('--- Phase 0: Schema Audit ---');
  
  const tables = [
    'matches',
    'predictions',
    'signals',
    'prediction_ledger',
    'prediction_snapshots',
    'paper_trades'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`[NOT_IMPLEMENTED or ERROR] Table ${table}: ${error.message}`);
    } else {
      console.log(`[VERIFIED_RUNTIME] Table ${table} exists. Columns: ${data && data.length > 0 ? Object.keys(data[0]).join(', ') : 'Table empty but accessible'}`);
    }
  }
}

main().catch(console.error);
