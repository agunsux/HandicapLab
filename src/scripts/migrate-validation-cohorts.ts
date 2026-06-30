import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Validation Sprint Cohorts database migration...\n');

  const sqlStatements = [
    `ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS league_cohort TEXT DEFAULT 'other';`,
    `ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS prediction_created_at TIMESTAMPTZ DEFAULT NOW();`,
    `ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS opening_capture_time TIMESTAMPTZ DEFAULT NOW();`,
    `ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS closing_capture_time TIMESTAMPTZ;`,
    `ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS hours_before_kickoff NUMERIC;`,
    `ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS market_movement JSONB;`,

    `ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS league_cohort TEXT DEFAULT 'other';`,
    `ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS prediction_created_at TIMESTAMPTZ DEFAULT NOW();`,
    `ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS opening_capture_time TIMESTAMPTZ DEFAULT NOW();`,
    `ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS closing_capture_time TIMESTAMPTZ;`,
    `ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS hours_before_kickoff NUMERIC;`,
    `ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS market_movement JSONB;`
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
