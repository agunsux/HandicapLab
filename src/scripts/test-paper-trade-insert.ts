import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function testInsert() {
  console.log('Testing paper_trades insert...');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get a match and prediction to reference
  const { data: match } = await supabase.from('matches').select('id').limit(1).single();
  const { data: pred } = await supabase.from('predictions').select('id').limit(1).single();

  if (!match || !pred) {
    console.log('❌ Error: No match or prediction found to link.');
    return;
  }

  const payload = {
    user_id: '00000000-0000-0000-0000-000000000000',
    prediction_id: pred.id,
    match_id: String(match.id),
    competition_id: 'eng_premier_league',
    market_type: 'ML',
    market_subtype: '1X2',
    selection: 'home',
    entry_odds: 1.95,
    opening_odds: 1.95,
    stake: 0.05,
    cohort_tag: 'GENERAL',
    status: 'PENDING'
  };

  const { data, error } = await supabase.from('paper_trades').insert(payload).select();
  if (error) {
    console.error('❌ Insert failed:', error.code, error.message, error.details);
  } else {
    console.log('✅ Insert succeeded!', data);
    // Cleanup
    await supabase.from('paper_trades').delete().eq('id', data[0].id);
    console.log('✅ Cleanup succeeded.');
  }
}

testInsert();
