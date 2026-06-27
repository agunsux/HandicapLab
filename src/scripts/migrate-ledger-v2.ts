import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Public Ledger v2 database migration...\n');

  const sqlStatements = [
    `CREATE TABLE IF NOT EXISTS public.prediction_decisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prediction_ledger_id UUID REFERENCES public.prediction_ledger(id) ON DELETE CASCADE NOT NULL,
      decision VARCHAR(20) NOT NULL,
      reason_category VARCHAR(100) NOT NULL,
      reason_text TEXT NOT NULL,
      confidence_score NUMERIC,
      edge_score NUMERIC,
      expected_value NUMERIC,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT unique_decision_ledger UNIQUE (prediction_ledger_id)
    );`,

    `CREATE INDEX IF NOT EXISTS idx_prediction_decisions_ledger ON public.prediction_decisions(prediction_ledger_id);`,
    `CREATE INDEX IF NOT EXISTS idx_prediction_decisions_decision ON public.prediction_decisions(decision);`,

    `ALTER TABLE public.prediction_decisions ENABLE ROW LEVEL SECURITY;`,

    `DROP POLICY IF EXISTS "Prediction decisions are viewable by everyone" ON public.prediction_decisions;`,
    `CREATE POLICY "Prediction decisions are viewable by everyone" ON public.prediction_decisions FOR SELECT USING (true);`,

    `ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS prediction_decision_id UUID REFERENCES public.prediction_decisions(id) ON DELETE SET NULL;`
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
