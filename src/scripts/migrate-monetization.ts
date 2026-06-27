import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Monetization Engine database migration...\n');

  const sqlStatements = [
    `CREATE TABLE IF NOT EXISTS public.user_profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      ppp_tier VARCHAR(20) DEFAULT 'TIER_1',
      geo_country VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.user_entitlements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      access_type VARCHAR(50) NOT NULL,
      credits_balance INTEGER DEFAULT 0,
      tournament_slug VARCHAR(100),
      is_active BOOLEAN DEFAULT TRUE,
      granted_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    );`,

    `CREATE TABLE IF NOT EXISTS public.transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      amount_usd DECIMAL(10, 2) NOT NULL,
      ppp_tier VARCHAR(20) NOT NULL,
      payment_gateway VARCHAR(50) NOT NULL,
      gateway_session_id VARCHAR(255),
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      idempotency_key VARCHAR(255) UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.credit_deductions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      credits_used INTEGER NOT NULL DEFAULT 1,
      action_type VARCHAR(100) NOT NULL,
      reference_id VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.founders (
      user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      founder_number INTEGER UNIQUE NOT NULL,
      joined_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.webhook_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      gateway VARCHAR(50) NOT NULL,
      event_id VARCHAR(255) UNIQUE NOT NULL,
      payload JSONB NOT NULL,
      processed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.payment_status_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
      from_status VARCHAR(20) NOT NULL,
      to_status VARCHAR(20) NOT NULL,
      changed_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE public.credit_deductions ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE public.founders ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE public.payment_status_history ENABLE ROW LEVEL SECURITY;`
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
