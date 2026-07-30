import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('--- LATEST 3 PREDICTIONS ---');
  const { data: p } = await supabase.from('predictions').select('*').limit(3).order('created_at', {ascending: false});
  console.log(JSON.stringify(p, null, 2));
  
  console.log('--- LATEST 3 MATCHES ---');
  const { data: m } = await supabase.from('matches').select('*').limit(3).order('kickoff', {ascending: false});
  console.log(JSON.stringify(m, null, 2));

  console.log('--- PREDICTION RESULTS ---');
  const { data: pr } = await supabase.from('prediction_results').select('*').limit(3);
  console.log(JSON.stringify(pr, null, 2));
}

run().catch(console.error);
