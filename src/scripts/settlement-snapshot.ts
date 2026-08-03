import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) { console.error('Missing Supabase credentials'); process.exit(1); }
const sb = createClient(url, key);

async function main() {
  const { data: preds } = await sb.from('predictions').select('match_id').limit(5000);
  const matchIds = [...new Set((preds || []).map((r: any) => r.match_id))];

  const { data: matches } = await sb.from('matches')
    .select('id, kickoff, home_team, away_team, league, status, home_goals, away_goals')
    .in('id', matchIds);
  const matchMap: Record<string, any> = {};
  (matches || []).forEach((r: any) => { matchMap[r.id] = r; });

  const realMatches = (matches || []).filter((r: any) => String(r.kickoff || '').slice(0, 4) === '2024');
  const realIds = new Set(realMatches.map((r: any) => String(r.id)));

  const { data: trades } = await sb.from('paper_trades').select('*').limit(5000);
  const realTrades = (trades || []).filter((t: any) => realIds.has(String(t.match_id)));
  const ml = realTrades.filter((t: any) => t.market_type === 'ML');

  console.log('=== EXACT INVENTORY (settlement-snapshot) ===');
  console.log('total predictions in DB referenced match_ids:', matchIds.length);
  console.log('matches total referenced:', matches?.length);
  console.log('real 2024 matches:', realMatches.length, 'unique ids:', realIds.size);
  console.log('real trades (all markets):', realTrades.length);
  console.log('ML trades (candidate settle):', ml.length);
  console.log('unique ML match_ids:', new Set(ml.map((t: any) => t.match_id)).size);

  const perMatch: Record<string, number> = {};
  ml.forEach((t: any) => { perMatch[String(t.match_id)] = (perMatch[String(t.match_id)] || 0) + 1; });
  console.log('ML trades per match id:', JSON.stringify(perMatch));

  const oddsDist: Record<string, number> = {};
  ml.forEach((t: any) => { const k = String(t.entry_odds); oddsDist[k] = (oddsDist[k] || 0) + 1; });
  console.log('ML entry_odds distribution:', JSON.stringify(oddsDist));

  const selDist: Record<string, number> = {};
  ml.forEach((t: any) => { selDist[String(t.selection)] = (selDist[String(t.selection)] || 0) + 1; });
  console.log('ML selections:', JSON.stringify(selDist));

  const stakeDist: Record<string, number> = {};
  ml.forEach((t: any) => { const k = String(t.stake); stakeDist[k] = (stakeDist[k] || 0) + 1; });
  console.log('ML stake distribution:', JSON.stringify(stakeDist));

  const statusDist: Record<string, number> = {};
  ml.forEach((t: any) => { statusDist[String(t.status)] = (statusDist[String(t.status)] || 0) + 1; });
  console.log('ML statuses:', JSON.stringify(statusDist));

  console.log('ML missing selection:', ml.filter((t: any) => !t.selection).length);
  console.log('ML missing entry_odds:', ml.filter((t: any) => t.entry_odds == null).length);
  console.log('ML missing stake:', ml.filter((t: any) => t.stake == null).length);

  console.log('=== per-match MLS with teams ===');
  realMatches.forEach((mat: any) => {
    const matchesHere = ml.filter((t: any) => String(t.match_id) === String(mat.id));
    if (matchesHere.length === 0) return;
    matchesHere.forEach((t: any) => {
      const homeSide = String(t.selection).toLowerCase() === String(mat.home_team).toLowerCase() ? 'HOME' : String(t.selection).toLowerCase() === String(mat.away_team).toLowerCase() ? 'AWAY' : 'DRAW/OTHER';
      console.log(`${mat.home_team} vs ${mat.away_team} | sel=${t.selection} (${homeSide}) | odds=${t.entry_odds} | stake=${t.stake} | status=${t.status} | kickoff=${String(mat.kickoff).slice(0,10)}`);
    });
  });

  console.log('=== non-ML real trades (must stay PENDING) ===');
  const nonML = realTrades.filter((t: any) => t.market_type !== 'ML');
  console.log('count:', nonML.length, 'markets:', JSON.stringify(nonML.reduce((a: any, t: any) => { a[t.market_type] = (a[t.market_type] || 0) + 1; return a; }, {})));
  const withSubtype = nonML.filter((t: any) => t.market_subtype).length;
  console.log('non-ML with market_subtype:', withSubtype, 'of', nonML.length);

  console.log('=== synthetic 2026 trades (must stay PENDING) ===');
  const synthTrades = (trades || []).filter((t: any) => !realIds.has(String(t.match_id)));
  console.log('synthetic trades:', synthTrades.length, 'statuses:', JSON.stringify(synthTrades.reduce((a: any, t: any) => { a[t.status] = (a[t.status] || 0) + 1; return a; }, {})));
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
