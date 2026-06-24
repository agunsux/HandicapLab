import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Sprint 6 database migration...\n');

  const sqlStatements = [
    // 1. Alter matches table to add Sprint 6 columns
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS competition_type VARCHAR(30) DEFAULT 'club';`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_id VARCHAR(50);`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS fifa_ranking_home INTEGER;`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS fifa_ranking_away INTEGER;`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS elo_rating_home INTEGER;`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS elo_rating_away INTEGER;`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS squad_strength_home DECIMAL;`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS squad_strength_away DECIMAL;`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_stage VARCHAR(50);`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS motivation_home DECIMAL;`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS motivation_away DECIMAL;`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS knockout_risk_adjustment DECIMAL DEFAULT 0.0;`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_availability JSONB;`,

    // 2. Alter predictions table to add Sprint 6 columns
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS market_confidence_score INTEGER;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS predicted_odds DOUBLE PRECISION;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS closing_line_value DOUBLE PRECISION;`,

    // 3. Alter paper_trades table to add Sprint 6 columns
    `ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS opening_odds DOUBLE PRECISION;`,

    // 4. Create model_weight_history table
    `CREATE TABLE IF NOT EXISTS model_weight_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      league_id TEXT NOT NULL,
      poisson_weight DOUBLE PRECISION NOT NULL,
      dixon_coles_weight DOUBLE PRECISION NOT NULL,
      measured_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 5. Create indexes
    `CREATE INDEX IF NOT EXISTS idx_matches_competition_type ON matches(competition_type);`,
    `CREATE INDEX IF NOT EXISTS idx_model_weight_history_league_id ON model_weight_history(league_id);`
  ];

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (dbUrl) {
    console.log('🔌 Connecting directly via PostgreSQL connection string...');
    const client = new Client({ connectionString: dbUrl });
    try {
      await client.connect();
      console.log('✅ Connected successfully to Postgres database.');
      
      let successCount = 0;
      for (let i = 0; i < sqlStatements.length; i++) {
        const sql = sqlStatements[i];
        console.log(`Executing step ${i + 1}/${sqlStatements.length}...`);
        await client.query(sql);
        successCount++;
      }
      
      await client.end();
      console.log(`\n🎉 Direct TCP migration successful! Executed ${successCount} statements.`);
      process.exit(0);
    } catch (err: any) {
      console.error('❌ Direct TCP migration failed:', err.message);
      console.log('Attempting fallback to Supabase REST RPC...');
    }
  } else {
    console.log('ℹ️ No DATABASE_URL or POSTGRES_URL environment variables found. Using Supabase API Client...');
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
