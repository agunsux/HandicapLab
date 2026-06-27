import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Competition Hub database migration...\n');

  const sqlStatements = [
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS competition_type VARCHAR(50) DEFAULT 'league';`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS format VARCHAR(50) DEFAULT 'round_robin';`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS region VARCHAR(100);`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3;`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;`,
    
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS home_advantage NUMERIC;`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS season_xg NUMERIC;`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS form_weight NUMERIC;`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS rotation_risk NUMERIC;`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS two_leg_factor NUMERIC;`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS aggregate_score NUMERIC;`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS neutral_venue BOOLEAN DEFAULT FALSE;`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS knockout_pressure NUMERIC;`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS fatigue_factor NUMERIC;`
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
