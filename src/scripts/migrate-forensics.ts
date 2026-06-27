import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Forensic Reports database migration...\n');

  const sqlStatements = [
    `CREATE TABLE IF NOT EXISTS public.forensic_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      report_type VARCHAR(50) NOT NULL,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      signals_analyzed INTEGER DEFAULT 0,
      bets_taken INTEGER DEFAULT 0,
      skips INTEGER DEFAULT 0,
      roi_units NUMERIC DEFAULT 0.0,
      avg_clv NUMERIC DEFAULT 0.0,
      sample_size INTEGER DEFAULT 0,
      forensic_score NUMERIC DEFAULT 0.0,
      generated_content JSONB DEFAULT '{}'::jsonb,
      status VARCHAR(20) DEFAULT 'DRAFT',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `ALTER TABLE public.forensic_reports ENABLE ROW LEVEL SECURITY;`,

    `DROP POLICY IF EXISTS "Forensic reports are viewable by everyone" ON public.forensic_reports;`,
    `CREATE POLICY "Forensic reports are viewable by everyone" ON public.forensic_reports FOR SELECT USING (true);`
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
