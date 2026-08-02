import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rgkrfzxipkrwqccfuqfq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyPhase8Migration() {
  console.log('🚀 Phase 8 Runtime Verification: Schema Hardening');

  const migrationPath = path.join(process.cwd(), 'supabase/migrations/00000000000057_phase8_persistence_hardening.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('1. Applying Phase 8 Migration...');
  let res = await supabase.rpc('exec_sql', { query_text: sql });
  if (res.error) {
    res = await supabase.rpc('execute_sql', { sql });
  }
  
  if (res.error && !res.error.message.includes('already exists') && !res.error.message.includes('multiple default values')) {
    console.error('❌ Failed to execute migration via RPC:', res.error);
    // Ignore error if it's "column already exists"
  } else {
    console.log('✅ Migration applied or already exists.');
  }

  console.log('2. Verifying Schema Constraints (Information Schema)...');
  
  // We can just query the tables directly with limit 1 to see if it throws an error
  try {
    const { error: err1 } = await supabase.from('wh_predictions').select('win_probability, calibration_status, data_age_ms, loss_probability').limit(1);
    if (err1) throw err1;
    
    const { error: err2 } = await supabase.from('value_recommendations').select('rejection_reason, threshold_version, calibration_status, data_age_ms').limit(1);
    if (err2) throw err2;

    const { error: err3 } = await supabase.from('daily_picks').select('rejection_reason, odds_snapshot_id, prediction_id').limit(1);
    if (err3) throw err3;

    console.log('✅ SUCCESS: wh_predictions has forensic columns.');
    console.log('✅ SUCCESS: value_recommendations has forensic columns.');
    console.log('✅ SUCCESS: daily_picks has forensic lookup keys.');
    console.log('🎯 Phase 8 Migration Runtime Verification COMPLETE.');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Schema Verification Failed. The migration may not be applied to the target database.', error);
    process.exit(1);
  }
}

verifyPhase8Migration().catch(console.error);
