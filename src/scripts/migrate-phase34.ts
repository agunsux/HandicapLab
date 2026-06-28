import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Phase 34.1 database migration...\n');

  const sqlStatements = [
    // 1. Create signal_performance_attribution table
    `CREATE TABLE IF NOT EXISTS public.signal_performance_attribution (
        signal_id UUID PRIMARY KEY REFERENCES public.signals(id) ON DELETE CASCADE,
        competition TEXT NOT NULL,
        market_type TEXT NOT NULL,
        confidence_bucket TEXT NOT NULL,
        odds_range TEXT NOT NULL,
        bookmaker TEXT NOT NULL,
        is_win BOOLEAN DEFAULT FALSE,
        is_loss BOOLEAN DEFAULT FALSE,
        roi NUMERIC DEFAULT 0.0,
        clv NUMERIC DEFAULT 0.0,
        edge NUMERIC DEFAULT 0.0,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 2. Create model_calibration_history table
    `CREATE TABLE IF NOT EXISTS public.model_calibration_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE,
        model_probability NUMERIC NOT NULL,
        actual_result NUMERIC NOT NULL,
        calibration_error NUMERIC NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 3. Extend leagues_cache table with quality_score
    `ALTER TABLE public.leagues_cache 
     ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 75;`
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
      return;
    } catch (err: any) {
      console.error('❌ Direct TCP migration failed:', err.message);
      console.log('Attempting fallback to Supabase REST RPC...');
    }
  }

  // Fallback to Supabase REST RPC
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
    console.warn('⚠️ Migration finished with errors (this is expected in database-less sandbox environments).');
  }
}

runMigration().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
