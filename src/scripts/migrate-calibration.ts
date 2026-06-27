import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Competition Calibration database migration...\n');

  const sqlStatements = [
    // 1. Add model quality & active season discovery fields to leagues_cache
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS market_efficiency_score INTEGER CHECK (market_efficiency_score >= 0 AND market_efficiency_score <= 100);`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS sample_size_score INTEGER CHECK (sample_size_score >= 0 AND sample_size_score <= 100);`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS data_quality_score INTEGER CHECK (data_quality_score >= 0 AND data_quality_score <= 100);`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS edge_potential_score INTEGER CHECK (edge_potential_score >= 0 AND edge_potential_score <= 100);`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS model_confidence_score INTEGER CHECK (model_confidence_score >= 0 AND model_confidence_score <= 100);`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS historical_accuracy INTEGER CHECK (historical_accuracy >= 0 AND historical_accuracy <= 100);`,

    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS season_status VARCHAR(50) DEFAULT 'upcoming';`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS current_season VARCHAR(20);`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS season_start TIMESTAMPTZ;`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS season_end TIMESTAMPTZ;`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS is_currently_active BOOLEAN DEFAULT FALSE;`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS next_match_date TIMESTAMPTZ;`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS last_match_date TIMESTAMPTZ;`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS featured_calibration BOOLEAN DEFAULT FALSE;`,

    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS competition_weight NUMERIC DEFAULT 1.0;`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS confidence_multiplier NUMERIC DEFAULT 1.0;`,
    `ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS risk_factor NUMERIC DEFAULT 1.0;`,

    // 2. Create competition_metrics table for tracking historical accuracies
    `CREATE TABLE IF NOT EXISTS public.competition_metrics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      competition_id INTEGER REFERENCES public.leagues_cache(api_id) ON DELETE CASCADE UNIQUE,
      matches_count INTEGER DEFAULT 0,
      prediction_accuracy NUMERIC,
      roi_simulation NUMERIC,
      closing_line_accuracy NUMERIC,
      over25_accuracy NUMERIC,
      btts_accuracy NUMERIC,
      handicap_accuracy NUMERIC,
      sample_confidence VARCHAR(50) DEFAULT 'low',
      last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 3. RLS Setup
    `ALTER TABLE public.competition_metrics ENABLE ROW LEVEL SECURITY;`,
    `DROP POLICY IF EXISTS "Competition metrics are viewable by everyone" ON public.competition_metrics;`,
    `CREATE POLICY "Competition metrics are viewable by everyone" ON public.competition_metrics FOR SELECT USING (true);`
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
