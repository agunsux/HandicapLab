import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase URL or Service Key is missing in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Starting production database migration...\n');

  const sqlStatements = [
    // 1. Create paper_trades table
    `CREATE TABLE IF NOT EXISTS paper_trades (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      match_id TEXT,
      competition_id TEXT,
      market_type TEXT,
      prediction_id UUID,
      odds DOUBLE PRECISION,
      stake DOUBLE PRECISION,
      status TEXT DEFAULT 'pending',
      pnl DOUBLE PRECISION,
      closing_clv DOUBLE PRECISION,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 2. Create odds_history table
    `CREATE TABLE IF NOT EXISTS odds_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      match_id TEXT,
      market_type TEXT,
      home_odds DOUBLE PRECISION,
      draw_odds DOUBLE PRECISION,
      away_odds DOUBLE PRECISION,
      recorded_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 3. Alter matches table
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS competition_type TEXT;`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS fifa_ranking_home INTEGER;`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS fifa_ranking_away INTEGER;`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS squad_strength_home INTEGER;`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS squad_strength_away INTEGER;`,

    // 4. Alter predictions table
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS model_confidence DOUBLE PRECISION;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS data_confidence DOUBLE PRECISION;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS market_confidence DOUBLE PRECISION;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS league_id TEXT;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS cohort_tag TEXT;`
  ];

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < sqlStatements.length; i++) {
    const sql = sqlStatements[i];
    console.log(`Executing step ${i + 1}/${sqlStatements.length} via RPC...`);
    
    let res = await supabase.rpc('exec_sql', { query_text: sql });
    
    if (res.error) {
      res = await supabase.rpc('exec_sql', { sql_query: sql });
    }
    
    if (res.error) {
      res = await supabase.rpc('execute_sql', { sql });
    }

    if (res.error) {
      console.error(`❌ Step ${i + 1} failed: Code: ${res.error.code}, Message: ${res.error.message}`);
      failCount++;
    } else {
      console.log(`✅ Step ${i + 1} succeeded.`);
      successCount++;
    }
  }

  console.log('\n====================================');
  console.log(`Migration complete. Succeeded: ${successCount}, Failed: ${failCount}`);
  
  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMigration();
