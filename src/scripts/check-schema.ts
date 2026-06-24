import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase URL or Service Key is missing in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  // Check tables
  const tables = ['matches', 'predictions', 'paper_trades', 'odds_history'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.log(`Table ${table}: ERROR - ${error.message} (${error.code})`);
    } else {
      console.log(`Table ${table}: EXISTS`);
    }
  }

  // To check columns, we can try selecting them and catching errors
  const matchCols = [
    'competition_type', 'fifa_ranking_home', 'fifa_ranking_away', 
    'squad_strength_home', 'squad_strength_away', 'tournament_stage'
  ];
  for (const col of matchCols) {
    const { error } = await supabase.from('matches').select(col).limit(1);
    if (error) {
      console.log(`Column matches.${col}: MISSING (${error.message})`);
    } else {
      console.log(`Column matches.${col}: EXISTS`);
    }
  }

  const predCols = [
    'confidence', 'model_confidence', 'data_confidence', 'market_confidence', 
    'clv', 'league_id', 'cohort_tag', 'market_subtype', 'selection', 
    'model_probability', 'fair_odds', 'entry_odds',
    'market_confidence_score', 'predicted_odds', 'closing_line_value'
  ];
  for (const col of predCols) {
    const { error } = await supabase.from('predictions').select(col).limit(1);
    if (error) {
      console.log(`Column predictions.${col}: MISSING (${error.message})`);
    } else {
      console.log(`Column predictions.${col}: EXISTS`);
    }
  }

  const tradeCols = [
    'user_id', 'prediction_id', 'match_id', 'competition_id', 'market_type',
    'market_subtype', 'selection', 'entry_odds', 'opening_odds', 'stake',
    'cohort_tag', 'status', 'profit', 'is_win', 'clv', 'brier_score'
  ];
  console.log('\n🔍 Checking columns in paper_trades table...');
  for (const col of tradeCols) {
    const { error } = await supabase.from('paper_trades').select(col).limit(1);
    if (error) {
      console.log(`Column paper_trades.${col}: MISSING (${error.message})`);
    } else {
      console.log(`Column paper_trades.${col}: EXISTS`);
    }
  }
}

check();
