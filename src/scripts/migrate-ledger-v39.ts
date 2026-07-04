import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import 'dotenv/config';

async function runMigration() {
  console.log('🚀 Starting Prediction Ledger v2 Migration...\n');

  const migrationName = '00000000000039_prediction_ledger_v2.sql';
  const migrationPath = path.resolve(process.cwd(), 'supabase', 'migrations', migrationName);

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found at: ${migrationPath}`);
    process.exit(1);
  }

  // 1. Read file and compute checksum
  const fileContent = fs.readFileSync(migrationPath, 'utf8');
  const checksum = crypto.createHash('sha256').update(fileContent).digest('hex');
  console.log(`Migration name: ${migrationName}`);
  console.log(`SHA-256 Checksum: ${checksum}`);

  // 2. Establish PostgreSQL client connection
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  let client: Client;

  if (dbUrl) {
    console.log('🔌 Connecting directly via environment connection string (DATABASE_URL/POSTGRES_URL)...');
    client = new Client({ connectionString: dbUrl });
  } else {
    // Construct default pooler credentials
    const projectRef = 'rgkrfzxipkrwqccfuqfq';
    const host = 'aws-0-ap-southeast-2.pooler.supabase.com'; // Sydney regional pooler (confirmed by IPv6 range checks)
    const user = `postgres.${projectRef}`;
    const password = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    console.log(`🔌 Attempting connection to Sydney regional pooler: ${host}:6543...`);
    client = new Client({
      host,
      port: 6543,
      user,
      password,
      database: 'postgres',
      ssl: { rejectUnauthorized: false }
    });
  }

  try {
    await client.connect();
    console.log('✅ Connected successfully to Postgres database.');

    // 3. Ensure schema_migrations_meta table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations_meta (
        migration_name TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        schema_version VARCHAR(20) NOT NULL
      );
    `);

    // 4. Check if migration has already been applied
    const checkRes = await client.query(
      'SELECT checksum FROM public.schema_migrations_meta WHERE migration_name = $1',
      [migrationName]
    );

    if (checkRes.rows.length > 0) {
      const existingChecksum = checkRes.rows[0].checksum;
      if (existingChecksum === checksum) {
        console.log(`\n✅ Migration "${migrationName}" has already been applied with matching checksum. Skipping execution.`);
        await client.end();
        process.exit(0);
      } else {
        console.error(`\n❌ SCHEMA DRIFT DETECTED!`);
        console.error(`Migration "${migrationName}" is already applied but has a different checksum!`);
        console.error(`Database Checksum: ${existingChecksum}`);
        console.error(`Local Checksum:    ${checksum}`);
        console.error(`Please verify your local modifications and resolve conflict before continuing.`);
        await client.end();
        process.exit(1);
      }
    }

    // 5. Execute DDL statements
    console.log(`Applying DDL statements from ${migrationName}...`);
    await client.query(fileContent);
    console.log('✅ DDL statements applied successfully.');

    // 6. Record migration in metadata table
    await client.query(
      `INSERT INTO public.schema_migrations_meta (migration_name, checksum, schema_version) 
       VALUES ($1, $2, '2.0.0')`,
      [migrationName, checksum]
    );
    console.log('✅ Registered migration in schema_migrations_meta.');

    await client.end();
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ Migration failed:', err.message);
    console.log('\nℹ️ Troubleshooting Database connection issues:');
    console.log('1. Ensure "Connection Pooler" is enabled under Supabase Settings -> Database.');
    console.log('2. Provide a valid connection string as DATABASE_URL in your environment variables.');
    process.exit(1);
  }
}

runMigration().catch(err => {
  console.error('Fatal migration runner error:', err);
  process.exit(1);
});
