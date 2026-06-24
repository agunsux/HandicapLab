import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Core League Configuration database migration...\n');

  const sqlStatements = [
    `ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS competition_id VARCHAR(50);`,
    `CREATE INDEX IF NOT EXISTS idx_paper_trades_competition_id ON paper_trades(competition_id);`
  ];

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (dbUrl) {
    console.log('🔌 Connecting directly via PostgreSQL connection string...');
    const client = new Client({ connectionString: dbUrl });
    try {
      await client.connect();
      console.log('✅ Connected successfully to Postgres database.');
      for (let i = 0; i < sqlStatements.length; i++) {
        console.log(`Executing step ${i + 1}/${sqlStatements.length}...`);
        await client.query(sqlStatements[i]);
      }
      await client.end();
      console.log('🎉 Direct TCP migration successful!');
      process.exit(0);
    } catch (err: any) {
      console.error('❌ Direct TCP migration failed:', err.message);
      console.log('Attempting fallback to Supabase REST RPC...');
    }
  } else {
    console.log('ℹ️ No DATABASE_URL found. Using Supabase API client fallback...');
  }

  // Fallback via RPC
  let successCount = 0;
  for (let i = 0; i < sqlStatements.length; i++) {
    const sql = sqlStatements[i];
    let res = await supabase.rpc('exec_sql', { query_text: sql });
    if (res.error) {
      res = await supabase.rpc('exec_sql', { sql_query: sql });
    }
    if (res.error) {
      res = await supabase.rpc('execute_sql', { sql });
    }
    if (res.error) {
      console.error(`❌ RPC Step ${i + 1} failed: ${res.error.message}`);
    } else {
      successCount++;
    }
  }

  console.log(`🎉 Supabase RPC migration completed. Succeeded: ${successCount}`);
  process.exit(0);
}

runMigration().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
