import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });

async function tryPoolers() {
  const projectRef = 'rgkrfzxipkrwqccfuqfq';
  const poolers = [
    'aws-0-ap-southeast-2.pooler.supabase.com',
    'aws-0-ap-southeast-1.pooler.supabase.com',
    'aws-0-us-east-1.pooler.supabase.com',
    'aws-0-eu-central-1.pooler.supabase.com',
    'db.rgkrfzxipkrwqccfuqfq.supabase.co'
  ];

  const migrationSql = fs.readFileSync(
    path.resolve(process.cwd(), 'supabase', 'migrations', '016_model_registry.sql'),
    'utf8'
  );

  const password = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  for (const host of poolers) {
    const port = host.includes('pooler') ? 6543 : 5432;
    const user = host.includes('pooler') ? `postgres.${projectRef}` : 'postgres';
    console.log(`Connecting to ${host}:${port}...`);
    const client = new Client({
      host,
      port,
      user,
      password,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });

    try {
      await client.connect();
      console.log(`✅ CONNECTED to ${host}! Executing migration...`);
      await client.query(migrationSql);
      console.log('✅ Migration 016_model_registry.sql applied successfully!');
      await client.end();
      return true;
    } catch (e: any) {
      console.log(`❌ Failed on ${host}: ${e.message}`);
      try { await client.end(); } catch {}
    }
  }
  return false;
}

tryPoolers().then(res => {
  console.log('Result:', res);
}).catch(console.error);
