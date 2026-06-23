// src/scripts/seed-paper-trades.ts
import 'dotenv/config';
import { supabase } from '@/lib/supabase.server';

async function main() {
  // 1. Get recent high‑edge predictions
  const { data: preds, error: predErr } = await supabase
    .from('predictions')
    .select('id, entry_odds, fair_odds, edge_pct')
    .gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .gte('edge_pct', 3.0)
    .order('edge_pct', { ascending: false })
    .limit(10);

  if (predErr) {
    console.error('Error fetching predictions:', predErr);
    process.exit(1);
  }
  if (!preds || preds.length === 0) {
    console.error('No eligible predictions found for seeding.');
    process.exit(1);
  }

  // 2. Get a user id (fallback to test UUID)
  let userId: string | null = null;
  const { data: users, error: userErr } = await supabase
    .from('auth.users')
    .select('id')
    .limit(1);
  if (!userErr && users && users.length > 0) {
    // @ts-ignore dynamic field
    userId = users[0].id;
  } else {
    console.warn('Unable to fetch user via RLS, using fallback test user.');
    userId = '00000000-0000-0000-0000-000000000001';
  }

  // 3. Insert paper trades
  const inserts = preds.map(p => ({
    user_id: userId,
    prediction_id: p.id,
    stake_units: 1.0,
    bet_odds: p.entry_odds ?? p.fair_odds,
    status: 'PENDING',
  }));

  const { data: tradeData, error: insertErr } = await supabase.from('paper_trades').insert(inserts).select();
  if (insertErr) {
    console.error('Error inserting paper trades:', insertErr);
    process.exit(1);
  }

  console.log(`Seeded ${tradeData?.length ?? 0} paper trades for user ${userId}.`);
  console.log('Trades:');
  tradeData?.forEach(t => {
    console.log({ market: t.market_type, selection: t.selection, odds: t.bet_odds, edge: t.edge_pct });
  });
  process.exit(0);
}

main();
