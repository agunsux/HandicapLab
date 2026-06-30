import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Sprint 9 CLV and Baselining database migration...\n');

  const sqlStatements = [
    // 1. Add reference book and market snapshot columns to signals table
    `ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS opening_reference_book TEXT DEFAULT 'PINNACLE';`,
    `ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS closing_reference_book TEXT DEFAULT 'PINNACLE';`,
    `ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS opening_market_snapshot JSONB;`,
    `ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS closing_market_snapshot JSONB;`,
    `ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS clv_status TEXT DEFAULT 'pending';`,
    `ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS line_clv NUMERIC;`,
    `ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS price_clv NUMERIC;`,
    `ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS total_clv NUMERIC;`,
    `ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS market_truth_score NUMERIC;`,

    // 2. Add constraint for clv_status
    `DO $$
     BEGIN
       ALTER TABLE public.signals DROP CONSTRAINT IF EXISTS chk_signals_clv_status;
       ALTER TABLE public.signals ADD CONSTRAINT chk_signals_clv_status 
         CHECK (clv_status IN ('pending', 'calculated', 'invalid', 'excluded'));
     EXCEPTION
       WHEN OTHERS THEN NULL;
     END $$;`,

    // 3. Mark existing rows as 'excluded' so they don't have invalid status/historical clv calculation
    `UPDATE public.signals SET clv_status = 'excluded' WHERE clv_status IS NULL OR clv_status = 'pending';`,

    // 4. Update predictions table too for parity (so prediction ledger and backtests work)
    `ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS opening_reference_book TEXT DEFAULT 'PINNACLE';`,
    `ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS closing_reference_book TEXT DEFAULT 'PINNACLE';`,
    `ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS opening_market_snapshot JSONB;`,
    `ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS closing_market_snapshot JSONB;`,
    `ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS clv_status TEXT DEFAULT 'pending';`,
    `ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS line_clv NUMERIC;`,
    `ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS price_clv NUMERIC;`,
    `ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS total_clv NUMERIC;`,
    `ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS market_truth_score NUMERIC;`
  ];

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (dbUrl) {
    console.log('🔌 Connecting directly via PostgreSQL connection string...');
    const client = new Client({ connectionString: dbUrl });
    try {
      await client.connect();
      console.log('✅ Connected successfully to Postgres database.');
      
      let successCount = 0;
      for (let i = 0; i < sqlStatements.length; i++) {
        const sql = sqlStatements[i];
        console.log(`Executing step ${i + 1}/${sqlStatements.length}...`);
        await client.query(sql);
        successCount++;
      }
      
      await client.end();
      console.log(`\n🎉 Direct TCP migration successful! Executed ${successCount} statements.`);
      process.exit(0);
    } catch (err: any) {
      console.error('❌ Direct TCP migration failed:', err.message);
      console.log('Attempting fallback to Supabase REST RPC...');
    }
  } else {
    console.log('ℹ️ No DATABASE_URL or POSTGRES_URL environment variables found. Using Supabase API Client...');
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
