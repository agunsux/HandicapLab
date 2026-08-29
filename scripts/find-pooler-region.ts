import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });

async function tryAllPoolers() {
  const projectRef = 'rgkrfzxipkrwqccfuqfq';
  const regions = [
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1',
    'ap-northeast-2',
    'ap-south-1',
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
    'eu-central-1',
    'eu-west-1',
    'eu-west-2',
    'eu-west-3',
    'ca-central-1',
    'sa-east-1'
  ];

  const migrationSql = fs.readFileSync(
    path.resolve(process.cwd(), 'supabase', 'migrations', '016_model_registry.sql'),
    'utf8'
  );

  const password = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  for (const reg of regions) {
    const host = `aws-0-${reg}.pooler.supabase.com`;
    const port = 6543;
    const user = `postgres.${projectRef}`;
    process.stdout.write(`Testing ${host}... `);
    const client = new Client({
      host,
      port,
      user,
      password,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 4000,
    });

    try {
      await client.connect();
      console.log(`\n🎉 CONNECTED to ${host}! Executing migration...`);
      await client.query(migrationSql);
      console.log('✅ Migration 016_model_registry.sql applied successfully!');
      await client.end();
      return true;
    } catch (e: any) {
      if (e.message.includes('tenant/user')) {
        console.log('tenant not here.');
      } else if (e.message.includes('password authentication failed')) {
        console.log(`FOUND REGION (${host})! But service role key is not DB password.`);
        await client.end();
        return host;
      } else {
        console.log(`Error: ${e.message}`);
      }
      try { await client.end(); } catch {}
    }
  }
  return false;
}

tryAllPoolers().then(res => console.log('Result:', res)).catch(console.error);
