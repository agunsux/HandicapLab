import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('=== APPLYING MIGRATION 016_MODEL_REGISTRY ===');
  
  const migrationSql = fs.readFileSync(
    path.resolve(process.cwd(), 'supabase', 'migrations', '016_model_registry.sql'),
    'utf8'
  );

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;
  let appliedViaPg = false;

  if (dbUrl) {
    console.log('Attempting direct PostgreSQL migration...');
    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      await client.query(migrationSql);
      console.log('✅ Direct PG migration executed successfully!');
      await client.end();
      appliedViaPg = true;
    } catch (err: any) {
      console.warn('Direct PG migration failed:', err.message);
      try { await client.end(); } catch {}
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify model_versions table
    const { data: mvData, error: mvErr } = await supabase.from('model_versions').select('*');
    if (mvErr) {
      console.log('model_versions query note:', mvErr.message);
    } else {
      console.log(`✅ model_versions table verified with ${mvData?.length || 0} rows.`);
    }

    // Verify public_predictions table
    const { data: ppData, error: ppErr } = await supabase.from('public_predictions').select('*').limit(5);
    if (ppErr) {
      console.log('public_predictions query note:', ppErr.message);
    } else {
      console.log(`✅ public_predictions table verified with ${ppData?.length || 0} rows.`);
    }
  }
}

main().catch(console.error);
