// Read-only connectivity probe for the production Postgres pooler.
// Tries the documented pooler hosts with credential candidates from env.
// Performs SELECT 1 only — never applies DDL. Prints no secrets.
//
// Usage: npx tsx scripts/verify/db-connectivity-probe.ts

import './_load-env';
import { Client } from 'pg';

const projectRef = 'rgkrfzxipkrwqccfuqfq';
const hosts = [
  'aws-0-ap-southeast-2.pooler.supabase.com',
  'aws-0-ap-southeast-1.pooler.supabase.com',
  'aws-0-us-east-1.pooler.supabase.com',
  'aws-0-eu-central-1.pooler.supabase.com',
  'aws-0-ap-northeast-1.pooler.supabase.com',
  'db.rgkrfzxipkrwqccfuqfq.supabase.co',
];

const candidates: Array<{ label: string; password: string }> = [
  { label: 'SUPABASE_DB_PASSWORD', password: process.env.SUPABASE_DB_PASSWORD || '' },
  { label: 'SUPABASE_SERVICE_ROLE_KEY', password: process.env.SUPABASE_SERVICE_ROLE_KEY || '' },
  { label: 'SUPABASE_SERVICE_KEY', password: process.env.SUPABASE_SERVICE_KEY || '' },
];

async function run(): Promise<void> {
  let connected = false;

  for (const host of hosts) {
    const isPooler = host.includes('pooler');
    const port = isPooler ? 6543 : 5432;
    const user = isPooler ? `postgres.${projectRef}` : 'postgres';

    for (const candidate of candidates) {
      if (!candidate.password) continue;
      const client = new Client({
        host,
        port,
        user,
        password: candidate.password,
        database: 'postgres',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 6000,
      });

      try {
        await client.connect();
        const res = await client.query('SELECT 1 AS ok');
        console.log(`CONNECTED host=${host} port=${port} user=${user} credential=${candidate.label} query=${JSON.stringify(res.rows[0])}`);
        connected = true;
        await client.end();
        break;
      } catch (err: any) {
        console.log(`failed host=${host} port=${port} credential=${candidate.label}: ${String(err.message).slice(0, 120)}`);
        try {
          await client.end();
        } catch {
          // ignore
        }
      }
    }
    if (connected) break;
  }

  console.log(connected ? 'RESULT: CONNECTED' : 'RESULT: NO_DDL_CREDENTIALS');
  if (!connected) process.exitCode = 1;
}

run().catch((err) => {
  console.error('probe crashed:', err.message);
  process.exitCode = 1;
});
