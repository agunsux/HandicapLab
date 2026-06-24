import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Sprint 8 (Programmatic SEO Cache) database migration...\n');

  const sqlStatements = [
    // leagues_cache table
    `CREATE TABLE IF NOT EXISTS leagues_cache (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      api_id INTEGER NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      country VARCHAR(100) NOT NULL,
      logo_url VARCHAR(255),
      season VARCHAR(20),
      stats_json JSONB DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // teams_cache table
    `CREATE TABLE IF NOT EXISTS teams_cache (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      api_id INTEGER NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      league_id INTEGER REFERENCES leagues_cache(api_id) ON DELETE CASCADE,
      logo_url VARCHAR(255),
      form_json JSONB DEFAULT '[]'::jsonb,
      stats_json JSONB DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // matches_cache table
    `CREATE TABLE IF NOT EXISTS matches_cache (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      api_id INTEGER NOT NULL UNIQUE,
      league_id INTEGER REFERENCES leagues_cache(api_id) ON DELETE CASCADE,
      home_team_id INTEGER REFERENCES teams_cache(api_id) ON DELETE CASCADE,
      away_team_id INTEGER REFERENCES teams_cache(api_id) ON DELETE CASCADE,
      kickoff TIMESTAMPTZ NOT NULL,
      odds_json JSONB DEFAULT '{}'::jsonb,
      prediction_json JSONB DEFAULT '{}'::jsonb,
      edge_pct DECIMAL(5,2),
      clv DECIMAL(5,2),
      settled_at TIMESTAMPTZ
    );`,

    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_leagues_cache_slug ON leagues_cache(slug);`,
    `CREATE INDEX IF NOT EXISTS idx_teams_cache_slug ON teams_cache(slug);`,
    `CREATE INDEX IF NOT EXISTS idx_matches_cache_kickoff ON matches_cache(kickoff);`
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
      console.log(`✅ Step ${i + 1} succeeded.`);
      successCount++;
    }
  }

  console.log('\n====================================');
  console.log(`RPC Migration complete. Succeeded: ${successCount}, Failed: ${failCount}`);

  if (failCount > 0) {
    console.log('\n❌ Migration failed. Local build fallback will be used.');
    process.exit(0); // Exit gracefully so builds don't block
  } else {
    console.log('🎉 Supabase RPC migration successful!');
    process.exit(0);
  }
}

runMigration().catch(err => {
  console.error('❌ Migration encountered fatal error:', err);
  process.exit(1);
});
