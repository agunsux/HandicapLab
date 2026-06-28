import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  const { data, error } = await supabase.rpc('get_tables');
  if (error) {
    console.error('Error fetching tables via RPC:', error);
    
    // Fallback: query pg_catalog
    const { data: tablesData, error: sqlError } = await supabase.from('pg_tables' as any).select('tablename');
    if (sqlError) {
      console.log('Could not query pg_tables directly.');
      
      // Let's just try selecting from some potential tables
      const candidateTables = ['matches', 'signals', 'predictions', 'fixtures', 'incoming_fixtures', 'external_fixtures'];
      for (const t of candidateTables) {
        const { error: err } = await supabase.from(t).select('count').limit(1);
        console.log(`Table ${t}: ${err ? 'Error ' + err.code : 'EXISTS'}`);
      }
    } else {
      console.log('Tables in db:', tablesData);
    }
  } else {
    console.log('Tables:', data);
  }
}

main();
