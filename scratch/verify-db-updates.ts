import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  console.log('--- Database Verification for Sprint 9 CLV Columns ---');
  
  const { data: signals, error } = await supabase
    .from('signals')
    .select('id, opening_reference_book, clv_status, clv_percentage, market_truth_score')
    .limit(5);

  if (error) {
    console.error('Error fetching signals:', error);
    return;
  }

  console.log(`Successfully verified columns. Row count fetched: ${signals.length}`);
  console.log('Sample rows:', signals);
}

main();

