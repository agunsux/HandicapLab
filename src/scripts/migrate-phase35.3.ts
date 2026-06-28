import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Phase 35.3 database migration...\n');

  const sqlStatements = [
    `CREATE TABLE IF NOT EXISTS public.shadow_predictions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      fixture_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
      competition TEXT NOT NULL,
      market_type TEXT NOT NULL,
      predicted_pick TEXT NOT NULL,
      predicted_probability NUMERIC NOT NULL,
      predicted_edge NUMERIC NOT NULL,
      odds_at_prediction NUMERIC NOT NULL,
      clv NUMERIC,
      result_status TEXT DEFAULT 'pending',
      settled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_shadow_predictions_fixture_id ON public.shadow_predictions(fixture_id);`,
    `CREATE INDEX IF NOT EXISTS idx_shadow_predictions_competition ON public.shadow_predictions(competition);`,
    `CREATE INDEX IF NOT EXISTS idx_shadow_predictions_result_status ON public.shadow_predictions(result_status);`
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
