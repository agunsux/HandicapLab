import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Real Data Verification database migration...\n');

  const sqlStatements = [
    `ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS competition_id INTEGER;`,
    `ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS external_match_id VARCHAR(100);`,
    `ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS source VARCHAR(100) DEFAULT 'api-football';`,
    `ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ DEFAULT NOW();`,
    `ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS kickoff_time TIMESTAMPTZ;`,
    `ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS home_team VARCHAR(150);`,
    `ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS away_team VARCHAR(150);`,

    `CREATE TABLE IF NOT EXISTS public.prediction_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      match_id TEXT NOT NULL,
      model_version VARCHAR(100) NOT NULL,
      prediction JSONB NOT NULL,
      confidence NUMERIC,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE INDEX IF NOT EXISTS idx_prediction_snapshots_match_id ON public.prediction_snapshots(match_id);`,

    `CREATE TABLE IF NOT EXISTS public.match_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      match_id TEXT NOT NULL UNIQUE,
      final_score JSONB NOT NULL,
      verified_source VARCHAR(100) DEFAULT 'api-football',
      verified_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `ALTER TABLE public.prediction_snapshots ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;`,

    `DROP POLICY IF EXISTS "Prediction snapshots are viewable by everyone" ON public.prediction_snapshots;`,
    `CREATE POLICY "Prediction snapshots are viewable by everyone" ON public.prediction_snapshots FOR SELECT USING (true);`,

    `DROP POLICY IF EXISTS "Match results are viewable by everyone" ON public.match_results;`,
    `CREATE POLICY "Match results are viewable by everyone" ON public.match_results FOR SELECT USING (true);`
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
