import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Phase 1 Paper Trading database migration...\n');

  const sqlStatements = [
    // 1. Ensure matches table exists
    `CREATE TABLE IF NOT EXISTS matches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      home_team VARCHAR(100) NOT NULL,
      away_team VARCHAR(100) NOT NULL,
      league VARCHAR(50) NOT NULL,
      kickoff TIMESTAMP NOT NULL,
      status VARCHAR(20) DEFAULT 'upcoming',
      home_goals INTEGER,
      away_goals INTEGER,
      ht_home_goals INTEGER,
      ht_away_goals INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );`,

    // 2. Ensure predictions table exists
    `CREATE TABLE IF NOT EXISTS predictions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      match_id TEXT,
      market_type TEXT,
      home_team TEXT,
      away_team TEXT,
      prediction JSONB,
      odds_snapshot JSONB,
      closing_odds JSONB,
      model_version TEXT,
      feature_version TEXT,
      generated_at TIMESTAMPTZ DEFAULT NOW(),
      prediction_timestamp TIMESTAMPTZ,
      brier_score DOUBLE PRECISION,
      clv DOUBLE PRECISION,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 3. Alter predictions table to add Phase 1 columns
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS cohort_tag TEXT;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS market_subtype TEXT;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS selection TEXT;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS model_probability DOUBLE PRECISION;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS fair_odds DOUBLE PRECISION;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS edge_pct DOUBLE PRECISION;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS entry_odds DOUBLE PRECISION;`,

    // 4. Create odds_history table
    `CREATE TABLE IF NOT EXISTS odds_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      match_id TEXT NOT NULL,
      market TEXT NOT NULL,
      line DOUBLE PRECISION,
      odds DOUBLE PRECISION NOT NULL,
      bookmaker TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 5. Create paper_trades table
    `CREATE TABLE IF NOT EXISTS paper_trades (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      prediction_id UUID REFERENCES predictions(id) ON DELETE SET NULL,
      match_id TEXT NOT NULL,
      market_type TEXT NOT NULL,
      market_subtype TEXT,
      selection TEXT NOT NULL,
      entry_odds DOUBLE PRECISION NOT NULL,
      closing_odds DOUBLE PRECISION,
      stake DOUBLE PRECISION DEFAULT 1.0,
      profit DOUBLE PRECISION,
      status TEXT DEFAULT 'pending',
      is_win BOOLEAN,
      clv DOUBLE PRECISION,
      brier_score DOUBLE PRECISION,
      cohort_tag TEXT DEFAULT 'GENERAL',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 6. Create Indexes
    `CREATE INDEX IF NOT EXISTS idx_predictions_match_id ON predictions(match_id);`,
    `CREATE INDEX IF NOT EXISTS idx_predictions_cohort_tag ON predictions(cohort_tag);`,
    `CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_predictions_market_type ON predictions(market_type);`,

    `CREATE INDEX IF NOT EXISTS idx_paper_trades_user_id ON paper_trades(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_paper_trades_match_id ON paper_trades(match_id);`,
    `CREATE INDEX IF NOT EXISTS idx_paper_trades_cohort_tag ON paper_trades(cohort_tag);`,
    `CREATE INDEX IF NOT EXISTS idx_paper_trades_created_at ON paper_trades(created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_paper_trades_market_type ON paper_trades(market_type);`,

    `CREATE INDEX IF NOT EXISTS idx_odds_history_match_id ON odds_history(match_id);`,
    `CREATE INDEX IF NOT EXISTS idx_odds_history_timestamp ON odds_history(timestamp);`,

    // 7. Enable RLS on paper_trades
    `ALTER TABLE paper_trades ENABLE ROW LEVEL SECURITY;`,

    // 8. Recreate RLS Policies on paper_trades
    `DROP POLICY IF EXISTS "Users can insert their own paper trades" ON paper_trades;`,
    `CREATE POLICY "Users can insert their own paper trades" ON paper_trades FOR INSERT WITH CHECK (auth.uid() = user_id);`,
    
    `DROP POLICY IF EXISTS "Users can select their own paper trades" ON paper_trades;`,
    `CREATE POLICY "Users can select their own paper trades" ON paper_trades FOR SELECT USING (auth.uid() = user_id);`,

    `DROP POLICY IF EXISTS "Users can update their own paper trades" ON paper_trades;`,
    `CREATE POLICY "Users can update their own paper trades" ON paper_trades FOR UPDATE USING (auth.uid() = user_id);`,

    `DROP POLICY IF EXISTS "Users can delete their own paper trades" ON paper_trades;`,
    `CREATE POLICY "Users can delete their own paper trades" ON paper_trades FOR DELETE USING (auth.uid() = user_id);`
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
        console.log(`Executing step ${i + 1}/${sqlStatements.length}...`);
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

  // Fallback / Primary Supabase RPC execution
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
  console.log(`RPC Migration complete. Succeeded: ${successCount}, Failed: ${failCount}`);
  
  if (failCount > 0) {
    console.log('\n❌ Migration failed. Please run the SQL statement directly in Supabase SQL editor:');
    console.log(sqlStatements.join('\n\n'));
    process.exit(1);
  } else {
    console.log('🎉 Supabase RPC migration successful!');
    process.exit(0);
  }
}

runMigration().catch(err => {
  console.error('❌ Migration encountered fatal error:', err);
  process.exit(1);
});
