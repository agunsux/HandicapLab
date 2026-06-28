import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Phase 32.7 & 32.8 database migration...\n');

  const sqlStatements = [
    // 1. Extend leagues_cache (competitions table)
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS competition_name VARCHAR(100);`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS tier INTEGER;`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS liquidity_score INTEGER;`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS market_coverage_score INTEGER;`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS active_status VARCHAR(20) DEFAULT 'active';`,
    
    // Copy existing name to competition_name
    `UPDATE public.leagues_cache SET competition_name = name WHERE competition_name IS NULL;`,
    // Set default active_status
    `UPDATE public.leagues_cache SET active_status = 'active' WHERE active_status IS NULL;`,

    // 2. Extend signals table
    `ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS last_odds_update TIMESTAMPTZ;`,
    `ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS odds_age_minutes INTEGER;`,
    // Set default for existing signals
    `UPDATE public.signals SET last_odds_update = updated_at WHERE last_odds_update IS NULL;`,
    `UPDATE public.signals SET odds_age_minutes = 0 WHERE odds_age_minutes IS NULL;`,

    // 3. Extend odds_snapshots table
    `ALTER TABLE public.odds_snapshots ADD COLUMN IF NOT EXISTS market_type VARCHAR(20);`,
    `ALTER TABLE public.odds_snapshots ADD COLUMN IF NOT EXISTS handicap_line NUMERIC;`,
    `ALTER TABLE public.odds_snapshots ADD COLUMN IF NOT EXISTS odds_home NUMERIC;`,
    `ALTER TABLE public.odds_snapshots ADD COLUMN IF NOT EXISTS odds_away NUMERIC;`,
    
    // Migrate existing market/line/odds to new columns
    `UPDATE public.odds_snapshots SET market_type = CASE WHEN market = 'asian_handicap' THEN 'AH' WHEN market = 'over_under' THEN 'OU' ELSE 'ML' END WHERE market_type IS NULL;`,
    `UPDATE public.odds_snapshots SET handicap_line = line WHERE handicap_line IS NULL;`,
    `UPDATE public.odds_snapshots SET odds_home = odds WHERE odds_home IS NULL;`
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
    throw new Error('Migration finished with errors.');
  }
}

runMigration().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
