import { Client } from 'pg';

async function main() {
  const host = 'db.rgkrfzxipkrwqccfuqfq.supabase.co';
  const user = 'postgres';
  const password = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  console.log(`Connecting to pg://${user}@${host} ...`);
  const client = new Client({
    connectionString: `postgresql://${user}:${password}@${host}:5432/postgres`
  });
  
  try {
    await client.connect();
    console.log('✅ Connected successfully!');
    const res = await client.query('SELECT version();');
    console.log('Version:', res.rows[0]);
    await client.end();
  } catch (e: any) {
    console.log('❌ Connection failed:', e.message);
  }
}

main();
