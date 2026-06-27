import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Public Prediction Ledger database migration...\n');

  const sqlStatements = [
    `CREATE TABLE IF NOT EXISTS public.prediction_ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prediction_snapshot_id UUID,
      match_id TEXT NOT NULL,
      competition_id INTEGER,
      published_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      market VARCHAR(50) NOT NULL,
      selection VARCHAR(50),
      odds_at_prediction DOUBLE PRECISION,
      confidence NUMERIC,
      model_version VARCHAR(100) NOT NULL,
      result_status VARCHAR(20) DEFAULT 'pending' NOT NULL,
      settled_at TIMESTAMPTZ,
      roi DOUBLE PRECISION,
      verified BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT unique_ledger_match_market UNIQUE (match_id, market)
    );`,

    `CREATE INDEX IF NOT EXISTS idx_prediction_ledger_match_id ON public.prediction_ledger(match_id);`,
    `CREATE INDEX IF NOT EXISTS idx_prediction_ledger_competition_id ON public.prediction_ledger(competition_id);`,
    `CREATE INDEX IF NOT EXISTS idx_prediction_ledger_result_status ON public.prediction_ledger(result_status);`,

    `ALTER TABLE public.prediction_ledger ENABLE ROW LEVEL SECURITY;`,

    `DROP POLICY IF EXISTS "Prediction ledger entries are viewable by everyone" ON public.prediction_ledger;`,
    `CREATE POLICY "Prediction ledger entries are viewable by everyone" ON public.prediction_ledger FOR SELECT USING (true);`
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
