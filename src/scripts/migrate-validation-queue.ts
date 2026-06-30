import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Validation Queue database migration...\n');

  const sqlStatements = [
    `CREATE TABLE IF NOT EXISTS public.validation_queue (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      fixture_id TEXT NOT NULL UNIQUE,
      league_id TEXT,
      scheduled_time TIMESTAMPTZ,
      market_available BOOLEAN DEFAULT FALSE,
      reference_book_available BOOLEAN DEFAULT FALSE,
      validation_status TEXT DEFAULT 'pending', -- 'pending', 'queued', 'validated', 'rejected'
      settled BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE INDEX IF NOT EXISTS idx_validation_queue_fixture_id ON public.validation_queue(fixture_id);`,
    `CREATE INDEX IF NOT EXISTS idx_validation_queue_status ON public.validation_queue(validation_status);`
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
