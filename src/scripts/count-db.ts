import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  const { data: matches, error: mErr } = await supabase.from('matches').select('*');
  const { data: preds, error: pErr } = await supabase.from('predictions').select('*');

  if (mErr) console.error('Matches fetch error:', mErr);
  else console.log('Total matches in DB:', matches?.length || 0);

  if (pErr) console.error('Predictions fetch error:', pErr);
  else console.log('Total predictions in DB:', preds?.length || 0);
}

main();
