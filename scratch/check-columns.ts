import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  const { data, error } = await supabase.from('matches').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Match columns:', Object.keys(data[0] || {}));
  console.log('Sample match:', data[0]);
}

main();
