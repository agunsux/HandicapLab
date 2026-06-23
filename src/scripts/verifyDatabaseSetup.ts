import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase URL or Service Key is missing in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verify() {
  console.log('🔍 Starting database setup verification...\n');
  let pass = true;

  // 1. Verify matches table
  try {
    const { error } = await supabase.from('matches').select('id').limit(1);
    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      console.log('❌ matches table: MISSING');
      pass = false;
    } else if (error) {
      console.log(`⚠️ matches table: ERROR (${error.code}) - ${error.message}`);
      // Connection errors shouldn't mark the schema itself as invalid, but let's count them
      pass = false;
    } else {
      console.log('✅ matches table: PRESENT');
    }
  } catch (e: any) {
    console.log('❌ matches table: ERROR', e.message);
    pass = false;
  }

  // 2. Verify predictions table
  try {
    const { error } = await supabase.from('predictions').select('id').limit(1);
    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      console.log('❌ predictions table: MISSING');
      pass = false;
    } else if (error) {
      console.log(`⚠️ predictions table: ERROR (${error.code}) - ${error.message}`);
      pass = false;
    } else {
      console.log('✅ predictions table: PRESENT');
    }
  } catch (e: any) {
    console.log('❌ predictions table: ERROR', e.message);
    pass = false;
  }

  // 3. Verify prediction_results table
  try {
    const { error } = await supabase.from('prediction_results').select('id').limit(1);
    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      console.log('❌ prediction_results table: MISSING');
      pass = false;
    } else if (error) {
      console.log(`⚠️ prediction_results table: ERROR (${error.code}) - ${error.message}`);
      pass = false;
    } else {
      console.log('✅ prediction_results table: PRESENT');
    }
  } catch (e: any) {
    console.log('❌ prediction_results table: ERROR', e.message);
    pass = false;
  }

  // 4. Verify get_prediction_accuracy() function
  try {
    const { error } = await supabase.rpc('get_prediction_accuracy');
    if (error && (error.code === '3F000' || error.code === '42883' || error.message?.includes('does not exist') || error.message?.includes('Could not find the function'))) {
      console.log('❌ get_prediction_accuracy() function: MISSING');
      pass = false;
    } else if (error && error.code !== 'PGRST202') {
      // PGRST202 is "Could not find the function" which counts as MISSING.
      // Other database errors might just mean empty tables or connection, which counts as PRESENT (since Postgres recognized the RPC name to call it).
      console.log('✅ get_prediction_accuracy() function: PRESENT');
    } else if (error) {
      console.log('❌ get_prediction_accuracy() function: MISSING');
      pass = false;
    } else {
      console.log('✅ get_prediction_accuracy() function: PRESENT');
    }
  } catch (e: any) {
    console.log('❌ get_prediction_accuracy() function: ERROR', e.message);
    pass = false;
  }

  console.log('\n====================================');
  if (pass) {
    console.log('🎉 VERIFICATION RESULT: PASS');
    process.exit(0);
  } else {
    console.log('❌ VERIFICATION RESULT: FAIL');
    process.exit(1);
  }
}

verify();
