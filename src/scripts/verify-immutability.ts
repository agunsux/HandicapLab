import { Client } from 'pg';
import 'dotenv/config';

async function main() {
  console.log('🔒 Running prediction_snapshots immutability verification...');
  
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
    await client.query('BEGIN');

    const testUuid = '00000000-0000-0000-0000-888888888888';
    
    // 1. Insert snapshot
    await client.query(`
      INSERT INTO public.prediction_snapshots (
        id, prediction_uuid, match_id, hash_fingerprint, created_by
      ) VALUES (
        $1, $1, 'test-match-immutability', 'test_immutability_hash', 'verify-immutability-script'
      );
    `, [testUuid]);

    console.log('✅ Snapshot inserted. Attempting illegal UPDATE operation...');

    // 2. Attempt update (should trigger exception)
    try {
      await client.query(`
        UPDATE public.prediction_snapshots
        SET match_id = 'altered-match'
        WHERE id = $1;
      `, [testUuid]);

      console.error('❌ FAILURE: UPDATE succeeded on prediction_snapshots! Immutability trigger is NOT working.');
      await client.query('ROLLBACK');
      process.exit(1);
    } catch (err: any) {
      if (err.message && err.message.includes('Immutability violation')) {
        console.log('✅ SUCCESS: UPDATE was successfully blocked by database trigger!');
        console.log(`Received expected error: "${err.message}"`);
        await client.query('ROLLBACK');
        await client.end();
        process.exit(0);
      } else {
        console.error(`❌ FAILURE: UPDATE failed with unexpected error: ${err.message}`);
        await client.query('ROLLBACK');
        process.exit(1);
      }
    }
  } catch (err: any) {
    console.error('❌ Connection or setup failed:', err.message);
    process.exit(1);
  }
}

main().catch(console.error);
