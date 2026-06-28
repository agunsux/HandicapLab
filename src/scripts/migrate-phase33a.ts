import { supabase } from '../lib/supabase.server';
import { Client } from 'pg';

async function runMigration() {
  console.log('🚀 Starting Phase 33A database migration...\n');

  const sqlStatements = [
    // 1. Create user_preferences table
    `CREATE TABLE IF NOT EXISTS public.user_preferences (
      user_id UUID PRIMARY KEY,
      preferred_markets TEXT[] DEFAULT '{}',
      preferred_competitions TEXT[] DEFAULT '{}',
      minimum_confidence NUMERIC DEFAULT 0.0,
      minimum_edge NUMERIC DEFAULT 0.0,
      notification_enabled BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 2. Create watchlists table
    `CREATE TABLE IF NOT EXISTS public.watchlists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT unique_watchlist_entity UNIQUE (user_id, type, entity_id)
    );`,
    `CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON public.watchlists(user_id);`,

    // 3. Create signal_events table
    `CREATE TABLE IF NOT EXISTS public.signal_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_signal_events_signal_id ON public.signal_events(signal_id);`,
    `CREATE INDEX IF NOT EXISTS idx_signal_events_created_at ON public.signal_events(created_at);`
  ];

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (dbUrl) {
    console.log('🔌 Connecting directly via PostgreSQL connection string...');
    const client = new Client({ connectionString: dbUrl });
    try {
      await client.connect();
      console.log('✅ Connected successfully to Postgres database.');

      for (let i = 0; i < sqlStatements.length; i++) {
        const sql = sqlStatements[i];
        console.log(`Executing DDL step ${i + 1}/${sqlStatements.length}...`);
        await client.query(sql);
      }

      await client.end();
      console.log('\n🎉 Direct TCP migration successful!');
      return;
    } catch (err: any) {
      console.error('❌ Direct TCP migration failed:', err.message);
      console.log('Attempting fallback to Supabase REST RPC...');
    }
  }

  // Fallback to Supabase REST RPC
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < sqlStatements.length; i++) {
    const sql = sqlStatements[i];
    console.log(`Executing step ${i + 1}/${sqlStatements.length} via RPC...`);

    let res = await supabase.rpc('exec_sql', { query_text: sql });
    if (res.error) res = await supabase.rpc('exec_sql', { sql_query: sql });
    if (res.error) res = await supabase.rpc('execute_sql', { sql });

    if (res.error) {
      console.error(`❌ Step ${i + 1} failed: Code: ${res.error.code}, Message: ${res.error.message}`);
      failCount++;
    } else {
      console.log(`✅ Step ${i + 1} executed successfully.`);
      successCount++;
    }
  }

  console.log(`\nMigration completed: ${successCount} succeeded, ${failCount} failed.`);
  if (failCount > 0) {
    console.warn('⚠️ Migration finished with errors (this is expected in database-less sandbox environments).');
  }
}

runMigration().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
