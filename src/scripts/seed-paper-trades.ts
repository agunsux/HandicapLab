import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seedPaperTrades() {
  console.log('🌱 Seeding paper trades...\n');

  const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

  const { data: predictions, error } = await supabase
    .from('predictions')
    .select('id, match_id, market_type, selection, fair_odds, edge_pct')
    .gte('edge_pct', 3.0)
    .order('edge_pct', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching predictions:', error);
    process.exit(1);
  }

  if (!predictions || predictions.length === 0) {
    console.log('No predictions found to seed.');
    process.exit(0);
  }

  const paperTrades = predictions.map(pred => ({
    user_id: TEST_USER_ID,
    prediction_id: pred.id,
    match_id: pred.match_id,
    market_type: pred.market_type,
    selection: pred.selection || 'home',
    entry_odds: pred.fair_odds || 2.0,
    stake: 1.0,
    status: 'pending',
  }));

  const { data: tradeData, error: insertErr } = await supabase
    .from('paper_trades')
    .insert(paperTrades)
    .select();

  if (insertErr) {
    console.error('Error inserting paper trades:', insertErr);
    process.exit(1);
  }

  console.log(`Seeded ${tradeData?.length ?? 0} paper trades for user ${TEST_USER_ID}.`);
  process.exit(0);
}

seedPaperTrades();
