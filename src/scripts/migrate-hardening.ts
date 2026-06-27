import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  console.log('🚀 Starting Payment Hardening database migration...\n');

  const migrationPath = path.join(process.cwd(), 'supabase/migrations/00000000000026_payment_hardening.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (dbUrl) {
    console.log('🔌 Connecting directly via PostgreSQL connection string...');
    const client = new Client({ connectionString: dbUrl });
    try {
      await client.connect();
      console.log('✅ Connected successfully to Postgres database.');
      await client.query('BEGIN;');
      await client.query(sql);
      await client.query('COMMIT;');
      console.log('\n🎉 Direct TCP migration successful!');
      process.exit(0);
    } catch (err: any) {
      console.error('❌ Direct TCP migration failed:', err.message);
      console.log('Attempting fallback to Supabase REST RPC...');
    }
  }

  // Fallback to RPC executions: parse out individual statements
  // A simple splitter that parses blocks and individual statements
  const statements: string[] = [];
  let currentStmt = '';
  let inDollarQuote = false;

  const lines = sql.split('\n');
  for (const line of lines) {
    if (line.includes('$$')) {
      inDollarQuote = !inDollarQuote;
    }
    currentStmt += line + '\n';
    if (!inDollarQuote && line.trim().endsWith(';')) {
      statements.push(currentStmt.trim());
      currentStmt = '';
    }
  }
  if (currentStmt.trim()) {
    statements.push(currentStmt.trim());
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt) continue;
    console.log(`Executing step ${i + 1}/${statements.length} via RPC...`);
    
    let res = await supabase.rpc('exec_sql', { query_text: stmt });
    if (res.error) res = await supabase.rpc('exec_sql', { sql_query: stmt });
    if (res.error) res = await supabase.rpc('execute_sql', { sql: stmt });

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
