import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Manual loading of .env from root directory if variables are missing
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    });
  }
}

loadEnv();

async function runMigration() {
  console.log('🚀 Running database migrations via direct PG connection...');

  const password = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const projectRef = 'rgkrfzxipkrwqccfuqfq';
  const host = 'aws-0-us-east-1.pooler.supabase.com';
  const username = `postgres.${projectRef}`;
  const connectionString = `postgresql://${username}:${password}@${host}:5432/postgres`;

  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('✅ Connected successfully to Postgres database.');
    
    console.log('Executing kelly_metadata column addition on paper_trades...');
    await client.query(`ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS kelly_metadata JSONB;`);
    
    console.log('Executing competition_type column addition on signals...');
    await client.query(`ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS competition_type TEXT;`);
    
    await client.end();
    console.log('✅ Migration succeeded!');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Direct TCP migration failed:', err.message);
    process.exit(1);
  }
}

runMigration().catch(console.error);
