import { supabase } from '../../lib/supabase.server';

/**
 * Migration to create system_alerts table for internal monitoring.
 * Run with: `node src/scripts/migrate-alerts.ts`
 */
async function runMigration() {
  console.log('🚀 Starting alerts table migration...');

  const sql = `
    CREATE TABLE IF NOT EXISTS public.system_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
      source TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata JSONB,
      resolved BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_type_source_unresolved ON public.system_alerts(alert_type, source) WHERE resolved = FALSE;
  `;

  // Try direct Postgres connection first (fallback to Supabase RPC)
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (dbUrl) {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: dbUrl });
    try {
      await client.connect();
      await client.query(sql);
      console.log('✅ system_alerts table created via direct DB connection.');
    } catch (e: any) {
      console.error('Direct DB migration failed, falling back to Supabase RPC:', e.message);
    } finally {
      await client.end();
    }
  }

  // Supabase RPC fallback (assumes a stored proc `run_sql` exists)
  const { error } = await supabase.rpc('run_sql', { sql });
  if (error) {
    console.error('Supabase migration error:', error.message);
    process.exit(1);
  } else {
    console.log('✅ system_alerts table ensured via Supabase RPC.');
    process.exit(0);
  }
}

if (require.main === module) {
  runMigration().catch((e) => console.error('Migration crashed:', e));
}
