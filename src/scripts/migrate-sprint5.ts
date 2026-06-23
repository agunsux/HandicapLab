import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Sprint 5 database migration...\n');

  const sqlStatements = [
    // 1. Ensure matches table exists (idempotent setup)
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

    // 3. Alter columns if the tables already existed to bring them to Sprints 5 spec
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS market_type TEXT;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS home_team TEXT;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS away_team TEXT;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS prediction JSONB;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS odds_snapshot JSONB;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS closing_odds JSONB;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS model_version TEXT;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS feature_version TEXT;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS prediction_timestamp TIMESTAMPTZ;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS brier_score DOUBLE PRECISION;`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS clv DOUBLE PRECISION;`,

    // 4. Safely change match_id type to TEXT
    `ALTER TABLE predictions ALTER COLUMN match_id TYPE TEXT;`,

    // 5. Convert generated_at and created_at to TIMESTAMPTZ
    `ALTER TABLE predictions ALTER COLUMN generated_at TYPE TIMESTAMPTZ;`,
    `ALTER TABLE predictions ALTER COLUMN created_at TYPE TIMESTAMPTZ;`,

    // 6. Create indexes idempotently
    `CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON matches(kickoff);`,
    `CREATE INDEX IF NOT EXISTS idx_predictions_match_id ON predictions(match_id);`,
    `CREATE INDEX IF NOT EXISTS idx_predictions_market_type ON predictions(market_type);`,
    `CREATE INDEX IF NOT EXISTS idx_predictions_prediction_timestamp ON predictions(prediction_timestamp);`,
    `CREATE INDEX IF NOT EXISTS idx_predictions_generated_at ON predictions(generated_at);`,
    `CREATE INDEX IF NOT EXISTS idx_predictions_prediction_gin ON predictions USING GIN (prediction);`,
    `CREATE INDEX IF NOT EXISTS idx_predictions_odds_snapshot_gin ON predictions USING GIN (odds_snapshot);`,
    `CREATE INDEX IF NOT EXISTS idx_predictions_model_version ON predictions USING btree ((model_version::text));`
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
    console.log('\n❌ CONNECTION / SCHEMAS REGISTRATION FAILURE SUMMARY:');
    console.log('The Supabase database could not execute ALTER TABLE queries directly.');
    console.log('\n👉 HOW TO RESOLVE THIS ISSUE:');
    console.log('Option A: Add a direct connection string to your `.env` file:');
    console.log('   DATABASE_URL=postgresql://postgres:[password]@db.rgkrfzxipkrwqccfuqfq.supabase.co:5432/postgres');
    console.log('   (This script will then connect directly via standard pg client)');
    console.log('\nOption B: Open the SQL Editor in your Supabase Dashboard and create the exec_sql handler:');
    console.log(`   CREATE OR REPLACE FUNCTION exec_sql(query_text text)
   RETURNS void AS $$
   BEGIN
     EXECUTE query_text;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;`);
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
