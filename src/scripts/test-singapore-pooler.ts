import { Client } from 'pg';

const host = 'aws-0-ap-southeast-1.pooler.supabase.com';
const user = 'postgres.rgkrfzxipkrwqccfuqfq';
const passwords = [
  'postgres',
  'password',
  'handicap-lab',
  'HandicapLab',
  'rgkrfzxipkrwqccfuqfq',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  process.env.SUPABASE_SERVICE_KEY || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
];

async function main() {
  console.log('Testing connection to:', host);
  for (const p of passwords) {
    if (!p) continue;
    console.log(`Trying password length: ${p.length} ...`);
    const client = new Client({
      connectionString: `postgresql://${user}:${p}@${host}:6543/postgres`
    });
    try {
      await client.connect();
      console.log('🎉 SUCCESS! Connected successfully with password:', p);
      await client.end();
      return;
    } catch (e: any) {
      console.log('Failed:', e.message);
    }
  }
}

main().catch(console.error);
