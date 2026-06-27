import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Payment Observability database migration...\n');

  const sqlStatements = [
    `CREATE TABLE IF NOT EXISTS public.paywall_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      event_type VARCHAR(100) NOT NULL,
      product_type VARCHAR(50),
      ppp_tier VARCHAR(20),
      amount_usd DECIMAL(10, 2),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.entitlement_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      entitlement_id UUID REFERENCES public.user_entitlements(id) ON DELETE SET NULL,
      action VARCHAR(50) NOT NULL,
      access_type VARCHAR(50) NOT NULL,
      credits_balance_before INTEGER,
      credits_balance_after INTEGER,
      reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `ALTER TABLE public.paywall_events ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE public.entitlement_audit_log ENABLE ROW LEVEL SECURITY;`
  ];

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (dbUrl) {
    console.log('🔌 Connecting directly via PostgreSQL connection string...');
    const client = new Client({ connectionString: dbUrl });
    try {
      await client.connect();
      console.log('✅ Connected successfully to Postgres database.');
      
      for (let i = 0; i < sqlStatements.length; i++) {
        const sql = sqlStatements[i];
        console.log(`Executing DDL step ${i + 1}/${sqlStatements.length}...`);
        await client.query(sql);
      }
      
      await client.end();
      console.log('\n🎉 Direct TCP migration successful!');
      process.exit(0);
    } catch (err: any) {
      console.error('❌ Direct TCP migration failed:', err.message);
      console.log('Attempting fallback to Supabase REST RPC...');
    }
  }

  // Fallback to RPC executions
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < sqlStatements.length; i++) {
    const sql = sqlStatements[i];
    console.log(`Executing step ${i + 1}/${sqlStatements.length} via RPC...`);
    
    let res = await supabase.rpc('exec_sql', { query_text: sql });
    if (res.error) res = await supabase.rpc('exec_sql', { sql_query: sql });
    if (res.error) res = await supabase.rpc('execute_sql', { sql });

    if (res.error) {
      console.error(`❌ Step ${i + 1} failed: Code: ${res.error.code}, Message: ${res.error.message}`);
      failCount++;
    } else {
      console.log(`✅ Step ${i + 1} executed successfully.`);
      successCount++;
    }
  }

  console.log(`\nMigration completed: ${successCount} succeeded, ${failCount} failed.`);
  if (failCount > 0) {
    console.error('⚠️ Migration finished with errors. Please check DB credentials.');
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMigration().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
