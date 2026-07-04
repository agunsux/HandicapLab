import { Client } from 'pg';
import 'dotenv/config';

async function main() {
  console.log('📦 Running database migration metadata validation...');
  
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  let client: Client;

  if (dbUrl) {
    client = new Client({ connectionString: dbUrl });
  } else {
    const projectRef = 'rgkrfzxipkrwqccfuqfq';
    client = new Client({
      host: 'aws-0-ap-southeast-2.pooler.supabase.com',
      port: 6543,
      user: `postgres.${projectRef}`,
      password: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      database: 'postgres',
      ssl: { rejectUnauthorized: false }
    });
  }

  try {
    await client.connect();
    
    // Check if migration 39 has been applied
    const res = await client.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM public.schema_migrations_meta 
        WHERE migration_name = '00000000000039_prediction_ledger_v2.sql'
      );
    `);
    
    if (res.rows[0].exists) {
      console.log('✅ Migration 00000000000039_prediction_ledger_v2.sql has been successfully applied and verified.');
      await client.end();
      process.exit(0);
    } else {
      console.error('❌ Migration 00000000000039_prediction_ledger_v2.sql is NOT recorded as applied in schema_migrations_meta.');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('❌ Setup/Connection failed:', err.message);
    process.exit(1);
  }
}

main().catch(console.error);
