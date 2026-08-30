import { supabase } from '../lib/supabase.server';
import { GET as getStatus } from '../app/api/v1/engine/status/route';
import { GET as getStats } from '../app/api/v1/stats/dashboard/route';
import { GET as getSignals } from '../app/api/v1/signals/route';
import { GET as getAh } from '../app/api/v1/markets/asian-handicap/route';
import { GET as getOu } from '../app/api/v1/markets/over-under/route';
import { GET as getMl } from '../app/api/v1/markets/moneyline/route';
import { GET as getBtts } from '../app/api/v1/markets/btts/route';

async function step3() {
  console.log('=== STEP 3: UI & EVIDENCE AUDIT ===');

  // 1. Check Engine Status
  const statusRes = await (await getStatus()).json();
  console.log('Engine Status Data:', JSON.stringify(statusRes.data));

  // 2. Check Stats Dashboard
  const statsRes = await (await getStats()).json();
  console.log('Stats Dashboard Data:', JSON.stringify(statsRes.data));

  // 3. Check Free User Masking on /api/v1/signals
  const req = new Request('http://localhost:3000/api/v1/signals');
  const signalsRes = await (await getSignals(req)).json();
  console.log('Signals Data Count:', signalsRes.count);
  console.log('Signals Data Rows:', JSON.stringify(signalsRes.data));

  // 4. Check Markets
  const ahRes = await (await getAh(req)).json();
  const ouRes = await (await getOu(req)).json();
  const mlRes = await (await getMl()).json();
  const bttsRes = await (await getBtts(req)).json();

  console.log('AH Count:', ahRes.count);
  console.log('OU Count:', ouRes.count);
  console.log('ML Count:', mlRes.count);
  console.log('BTTS Count:', bttsRes.count);

  process.exit(0);
}

step3().catch(console.error);
