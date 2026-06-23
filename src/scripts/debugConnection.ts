import { supabase } from '../lib/supabase.server';

async function debugConnection() {
  console.log('--- Supabase Connection Debugger ---');
  console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  console.log('Key length:', key.length);
  console.log('Key prefix:', key.substring(0, 15));

  // Test 1: Simple select query on match (checks if auth allows reading schema or if PGRST205 occurs)
  console.log('\nTest 1: Querying "matches" table...');
  const { data: matches, error: matchErr } = await supabase.from('matches').select('id').limit(1);
  if (matchErr) {
    console.log(`❌ matches query failed: Code: ${matchErr.code}, Status: ${(matchErr as any).status}, Message: ${matchErr.message}`);
  } else {
    console.log('✅ matches query succeeded. Data:', matches);
  }

  // Test 2: Call exec_sql RPC
  console.log('\nTest 2: Calling RPC "exec_sql"...');
  const { data: rpc1, error: rpcErr1 } = await supabase.rpc('exec_sql', { query_text: 'SELECT 1;' });
  if (rpcErr1) {
    console.log(`❌ exec_sql (query_text) failed: Code: ${rpcErr1.code}, Status: ${(rpcErr1 as any).status}, Message: ${rpcErr1.message}`);
  } else {
    console.log('✅ exec_sql (query_text) succeeded. Data:', rpc1);
  }

  const { data: rpc2, error: rpcErr2 } = await supabase.rpc('exec_sql', { sql_query: 'SELECT 1;' });
  if (rpcErr2) {
    console.log(`❌ exec_sql (sql_query) failed: Code: ${rpcErr2.code}, Status: ${(rpcErr2 as any).status}, Message: ${rpcErr2.message}`);
  } else {
    console.log('✅ exec_sql (sql_query) succeeded. Data:', rpc2);
  }

  // Test 3: Call execute_sql RPC
  console.log('\nTest 3: Calling RPC "execute_sql"...');
  const { data: rpc3, error: rpcErr3 } = await supabase.rpc('execute_sql', { sql: 'SELECT 1;' });
  if (rpcErr3) {
    console.log(`❌ execute_sql (sql) failed: Code: ${rpcErr3.code}, Status: ${(rpcErr3 as any).status}, Message: ${rpcErr3.message}`);
  } else {
    console.log('✅ execute_sql (sql) succeeded. Data:', rpc3);
  }
}

debugConnection().catch(console.error);
