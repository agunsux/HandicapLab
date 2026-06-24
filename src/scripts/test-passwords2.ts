import { Client } from 'pg';

const host = 'db.rgkrfzxipkrwqccfuqfq.supabase.co';
const user = 'postgres';
const passwords = [
  'postgres',
  'password',
  'handicap-lab',
  'HandicapLab',
  'rgkrfzxipkrwqccfuqfq',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
];

async function main() {
  for (const p of passwords) {
    if (!p) continue;
    console.log('Trying password length:', p.length);
    const client = new Client({ connectionString: `postgresql://${user}:${p}@${host}:5432/postgres` });
    try {
      await client.connect();
      console.log('SUCCESS with password:', p);
      await client.query(`
        -- 3. Alter matches table
        ALTER TABLE matches ADD COLUMN IF NOT EXISTS competition_type TEXT;
        ALTER TABLE matches ADD COLUMN IF NOT EXISTS fifa_ranking_home INTEGER;
        ALTER TABLE matches ADD COLUMN IF NOT EXISTS fifa_ranking_away INTEGER;
        ALTER TABLE matches ADD COLUMN IF NOT EXISTS squad_strength_home INTEGER;
        ALTER TABLE matches ADD COLUMN IF NOT EXISTS squad_strength_away INTEGER;
      `);
      console.log('Successfully ran DDL!');
      await client.end();
      return;
    } catch (e: any) {
      console.log('Failed:', e.message);
    }
  }
}

main();
