import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedPaperTrades() {
  console.log('Starting backfill for paper trades...');

  const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

  // Check if test user exists, else use null or insert it?
  // User ID might be constrained by foreign key. Let's see if we should insert the test user.
  const { data: userExists } = await supabase.from('profiles').select('id').eq('id', TEST_USER_ID).single();
  if (!userExists) {
      // we might fail foreign key on profiles
      console.log("Test user not found, we might get foreign key error. Continuing anyway...");
  }

  const { data: predictions, error } = await supabase
    .from('predictions')
    .select('*');

  if (error) {
    console.error('Error fetching predictions:', error);
    process.exit(1);
  }

  const { data: existingTrades, error: tradesErr } = await supabase
    .from('paper_trades')
    .select('prediction_id');
    
  if (tradesErr) {
     console.error('Error fetching paper trades:', tradesErr);
     process.exit(1);
  }

  const existingIds = new Set(existingTrades.map((t: any) => t.prediction_id));
  const pendingPredictions = predictions.filter((p: any) => !existingIds.has(p.id));

  console.log(`Found ${pendingPredictions.length} pending predictions without paper trades.`);

  if (pendingPredictions.length === 0) {
    console.log('No new predictions to seed.');
    process.exit(0);
  }

  const paperTrades = pendingPredictions.map((pred: any) => {
    // If prediction doesn't have market_odds at root, try to extract from prediction jsonb
    let finalOdds = pred.market_odds || pred.entry_odds || pred.fair_odds;
    if (!finalOdds && pred.prediction) {
       // fallback based on selection
       if (pred.selection === 'home') finalOdds = pred.prediction.home_prob ? (1/pred.prediction.home_prob) : undefined;
    }
    
    return {
      prediction_id: pred.id,
      match_id: pred.match_id,
      market_type: pred.market_type || 'ML',
      selection: pred.selection || 'home',
      odds: finalOdds || 1.95,
      entry_odds: finalOdds || 1.95,
      stake: 100,
      status: 'PENDING',
      // skip user_id if it causes foreign key error?
      // actually, user_id is referenced in the seed script, let's use it.
      // If FK fails, we remove it.
      user_id: TEST_USER_ID,
    };
  });

  const { data: tradeData, error: insertErr } = await supabase
    .from('paper_trades')
    .insert(paperTrades)
    .select();

  if (insertErr) {
    // If FK constraint fails, let's try without user_id
    if (insertErr.code === '23503') { // foreign_key_violation
        console.log("Foreign key violation for user_id. Retrying without user_id...");
        const paperTradesNoUser = paperTrades.map((t: any) => {
            const { user_id, ...rest } = t;
            return rest;
        });
        const { error: insertErr2 } = await supabase.from('paper_trades').insert(paperTradesNoUser);
        if (insertErr2) {
            console.error('Error inserting paper trades without user_id:', insertErr2);
            process.exit(1);
        }
        console.log(`Successfully seeded ${paperTradesNoUser.length} paper trades (without user_id).`);
    } else {
        console.error('Error inserting paper trades:', insertErr);
        process.exit(1);
    }
  } else {
    console.log(`Seeded ${tradeData?.length ?? 0} paper trades for user ${TEST_USER_ID}.`);
  }
  
  process.exit(0);
}

seedPaperTrades();
