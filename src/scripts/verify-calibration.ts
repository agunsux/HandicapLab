import { Client } from 'pg';
import 'dotenv/config';

async function main() {
  console.log('📊 Running calibration metrics validation...');
  
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
    
    // Check if table exists
    const res = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'prediction_calibration_metrics'
      );
    `);
    
    if (res.rows[0].exists) {
      console.log('✅ Table prediction_calibration_metrics is PRESENT.');
      await client.end();
      process.exit(0);
    } else {
      console.error('❌ Table prediction_calibration_metrics is MISSING!');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
  }
}

main().catch(console.error);
