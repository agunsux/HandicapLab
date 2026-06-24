import { Client } from 'pg';
import 'dotenv/config';

async function main() {
  console.log('Testing pooled PostgreSQL connection...');
  
  const password = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const projectRef = 'rgkrfzxipkrwqccfuqfq';
  const host = 'aws-0-us-east-1.pooler.supabase.com';
  const username = `postgres.${projectRef}`;
  const connectionString = `postgresql://${username}:${password}@${host}:5432/postgres`;

  console.log('Host:', host);
  console.log('User:', username);
  console.log('Password length:', password.length);

  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('✅ Pooled PostgreSQL connection succeeded!');
    const res = await client.query('SELECT version();');
    console.log('Database version:', res.rows[0].version);
    await client.end();
  } catch (err: any) {
    console.error('❌ Connection failed:', err.message);
  }
}

main().catch(console.error);
