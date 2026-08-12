import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function check() {
  const { data, error } = await supabase.rpc('reserve_quota', { p_provider: 'test', p_quota_type: 'DAILY', p_period_start: new Date().toISOString(), p_period_end: new Date().toISOString(), p_amount: 1, p_endpoint: 'test', p_request_id: 'test', p_default_limit: 100, p_safety_reserve_pct: 0 });
  console.log('Error:', error?.message || 'None');
  console.log('Data:', data);
}
check();
