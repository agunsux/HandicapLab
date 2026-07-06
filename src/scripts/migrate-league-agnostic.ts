// Migration runner for league agnostic hardening
// Location: src/scripts/migrate-league-agnostic.ts

import 'dotenv/config';
import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('🚀 Starting League-Agnostic Platform Hardening database migration...\n');

  const migrationFilePath = path.join(__dirname, '../../supabase/migrations/00000000000027_league_agnostic_hardening.sql');
  if (!fs.existsSync(migrationFilePath)) {
    console.error(`❌ Migration file not found at: ${migrationFilePath}`);
    process.exit(1);
  }

  const fullSql = fs.readFileSync(migrationFilePath, 'utf8');
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (dbUrl) {
    console.log('🔌 Connecting directly via PostgreSQL connection string...');
    const client = new Client({ connectionString: dbUrl });
    try {
      await client.connect();
      console.log('✅ Connected successfully to Postgres database.');

      console.log('Executing migration SQL block...');
      await client.query(fullSql);

      await client.end();
      console.log('🎉 Direct TCP migration successful!');
      process.exit(0);
    } catch (err: any) {
      console.error('❌ Direct TCP migration failed:', err.message);
      console.log('Attempting fallback to Supabase REST RPC...');
    }
  }

  // Fallback to RPC
  console.log('Calling Supabase RPC to execute SQL...');
  let res = await supabase.rpc('exec_sql', { query_text: fullSql });
  if (res.error) res = await supabase.rpc('exec_sql', { sql_query: fullSql });
  if (res.error) res = await supabase.rpc('execute_sql', { sql: fullSql });

  if (res.error) {
    console.error(`❌ Migration RPC failed: Code: ${res.error.code}, Message: ${res.error.message}`);
    process.exit(1);
  } else {
    console.log('✅ Migration RPC executed successfully.');
    process.exit(0);
  }
}

runMigration().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
