import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Sprint 4 database migration for snapshots...\n');

  const sqlStatements = [
    // 1. Create prediction_snapshots table
    `CREATE TABLE IF NOT EXISTS prediction_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      match_id TEXT NOT NULL,
      prediction_id TEXT,
      horizon VARCHAR(50) NOT NULL, -- 'T-7 days', 'T-5 days', 'T-3 days', 'T-1 day', 'T-6 hours', 'T-2 hours', 'Lineup Release', 'Kickoff'
      prediction JSONB NOT NULL, -- { pHome, pDraw, pAway, pOver, pUnder, pBttsYes, pBttsNo, expectedGoals }
      model_version VARCHAR(100) NOT NULL,
      feature_version VARCHAR(100) NOT NULL,
      generated_at TIMESTAMPTZ DEFAULT NOW(),
      prediction_timestamp TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 2. Create edge_snapshots table
    `CREATE TABLE IF NOT EXISTS edge_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      match_id TEXT NOT NULL,
      prediction_id TEXT,
      horizon VARCHAR(50) NOT NULL,
      market VARCHAR(50) NOT NULL,
      bookmaker VARCHAR(100) DEFAULT 'Pinnacle',
      opening_odds DOUBLE PRECISION,
      current_odds DOUBLE PRECISION,
      closing_odds DOUBLE PRECISION,
      fair_odds DOUBLE PRECISION NOT NULL,
      edge DOUBLE PRECISION NOT NULL,
      expected_value DOUBLE PRECISION NOT NULL,
      clv_projection DOUBLE PRECISION,
      steam BOOLEAN DEFAULT FALSE,
      reverse_line BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 3. Create decision_snapshots table
    `CREATE TABLE IF NOT EXISTS decision_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      match_id TEXT NOT NULL,
      prediction_id TEXT,
      horizon VARCHAR(50) NOT NULL,
      market VARCHAR(50) NOT NULL,
      expected_value DOUBLE PRECISION NOT NULL,
      recommended_stake DOUBLE PRECISION NOT NULL,
      kelly_fraction DOUBLE PRECISION DEFAULT 0.25,
      confidence_score DOUBLE PRECISION NOT NULL,
      confidence_label VARCHAR(50) NOT NULL, -- 'Very High', 'High', 'Medium', 'Low', 'Very Low'
      risk VARCHAR(50) NOT NULL, -- 'Low', 'Medium', 'High'
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 4. Create feature_snapshots table
    `CREATE TABLE IF NOT EXISTS feature_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      match_id TEXT NOT NULL,
      horizon VARCHAR(50) NOT NULL,
      feature_values JSONB NOT NULL,
      feature_age DOUBLE PRECISION, -- age in seconds or hours
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 5. Create recommendation_snapshots table
    `CREATE TABLE IF NOT EXISTS recommendation_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      match_id TEXT NOT NULL,
      prediction_id TEXT,
      horizon VARCHAR(50) NOT NULL,
      market VARCHAR(50) NOT NULL,
      decision VARCHAR(50) NOT NULL, -- 'NO_ACTION', 'WATCH', 'VALUE', 'STRONG_VALUE', 'AVOID'
      reasoning JSONB NOT NULL, -- array of graph contributions: [{ feature, contribution, direction, magnitude }]
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 6. Create indexes for snapshots
    `CREATE INDEX IF NOT EXISTS idx_prediction_snapshots_match_id ON prediction_snapshots(match_id);`,
    `CREATE INDEX IF NOT EXISTS idx_prediction_snapshots_horizon ON prediction_snapshots(horizon);`,
    `CREATE INDEX IF NOT EXISTS idx_edge_snapshots_match_id ON edge_snapshots(match_id);`,
    `CREATE INDEX IF NOT EXISTS idx_decision_snapshots_match_id ON decision_snapshots(match_id);`,
    `CREATE INDEX IF NOT EXISTS idx_feature_snapshots_match_id ON feature_snapshots(match_id);`,
    `CREATE INDEX IF NOT EXISTS idx_rec_snapshots_match_id ON recommendation_snapshots(match_id);`
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

  // Fallback RPC execution
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
      console.log(`✅ Step ${i + 1} succeeded.`);
      successCount++;
    }
  }

  console.log('\n====================================');
  console.log(`RPC Migration complete. Succeeded: ${successCount}, Failed: ${failCount}`);
  
  if (failCount > 0) {
    console.log('\n⚠️ Migration failed via Supabase REST. In local test mode this is expected if DB is offline.');
    console.log('We will fall back to using static/memory mock implementations in the service layer.');
  } else {
    console.log('🎉 Supabase RPC migration successful!');
  }
}

runMigration().catch(err => {
  console.error('❌ Migration encountered fatal error:', err);
});
