import { supabase } from '../lib/supabase.server';
import { GET as getSignals } from '../app/api/v1/signals/route';

async function step4() {
  console.log('=== STEP 4: CROSS-VERIFICATION ===');

  // Direct DB query per Step 4 spec
  const { data: dbRows, error } = await supabase
    .from('prediction_ledger_v3')
    .select('id, matches!inner(id, kickoff)')
    .gt('matches.kickoff', new Date().toISOString())
    .order('expected_value', { ascending: false });

  if (error) {
    console.error('DB query error:', error);
  }

  const dbIds = (dbRows || []).map((r) => r.id).sort();

  // API query
  const req = new Request('http://localhost:3000/api/v1/signals');
  const apiRes = await (await getSignals(req)).json();
  const apiIds = (apiRes.data || []).map((r: any) => r.id).sort();

  console.log('Direct DB Query Row IDs: ', JSON.stringify(dbIds));
  console.log('/api/v1/signals Row IDs:  ', JSON.stringify(apiIds));

  const match = JSON.stringify(dbIds) === JSON.stringify(apiIds);
  console.log('CROSS-VERIFICATION RESULT:', match ? 'IDENTICAL ✅' : 'MISMATCH ❌');

  process.exit(0);
}

step4().catch(console.error);
