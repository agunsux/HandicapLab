import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function checkProductionDb() {
  console.log('====================================');
  console.log('PRODUCTION ENVIRONMENT & DB CHECK');
  console.log('====================================');

  const provider = process.env.DATA_PROVIDER || 'api-football';
  let apiKeyExists = false;
  if (provider === 'api-football') {
    apiKeyExists = !!process.env.API_FOOTBALL_KEY;
  } else if (provider === 'football-data') {
    apiKeyExists = !!process.env.FOOTBALL_DATA_API_KEY;
  }

  console.log(`DATA_PROVIDER: ${provider}`);
  console.log(`API key exists: ${apiKeyExists}`);

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ SUPABASE connection: fail (Missing environment variables)');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Test connection
  let testOk = false;
  try {
    const { error } = await supabase.from('matches').select('id').limit(1);
    if (!error) {
      testOk = true;
      console.log('SUPABASE connection: ok');
    } else {
      console.error('❌ SUPABASE connection: fail', error.message);
    }
  } catch (e: any) {
    console.error('❌ SUPABASE connection: fail', e.message);
  }

  if (!testOk) {
    process.exit(1);
  }

  // STEP 1 - Verify tables and specific columns
  console.log('\n--- Checking matches columns ---');
  const matchCols = ['competition_type', 'tournament_stage', 'home_team', 'away_team', 'league', 'kickoff', 'status'];
  for (const col of matchCols) {
    const { error } = await supabase.from('matches').select(col).limit(1);
    if (error) {
      console.log(`Column matches.${col}: MISSING (${error.message})`);
    } else {
      console.log(`Column matches.${col}: EXISTS`);
    }
  }

  console.log('\n--- Checking predictions columns ---');
  // Confirm requested fields: confidence, model_confidence, data_confidence, market_confidence, edge_pct, clv
  // and other payload fields
  const predCols = [
    'confidence', 'model_confidence', 'data_confidence', 'market_confidence', 'edge_pct', 'clv',
    'predicted_line', 'market_line', 'market_odds', 'expected_value', 'kelly_fraction',
    'market_subtype', 'selection', 'model_probability', 'fair_odds', 'entry_odds',
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

  console.log('\n--- Checking paper_trades columns ---');
  const tradeCols = [
    'user_id', 'prediction_id', 'match_id', 'competition_id', 'market_type',
    'market_subtype', 'selection', 'entry_odds', 'opening_odds', 'stake',
    'cohort_tag', 'status', 'profit', 'is_win', 'clv', 'brier_score'
  ];
  for (const col of tradeCols) {
    const { error } = await supabase.from('paper_trades').select(col).limit(1);
    if (error) {
      console.log(`Column paper_trades.${col}: MISSING (${error.message})`);
    } else {
      console.log(`Column paper_trades.${col}: EXISTS`);
    }
  }

  console.log('\n--- Table row counts ---');
  const tables = ['matches', 'predictions', 'paper_trades'];
  for (const table of tables) {
    try {
      const { count, error: countError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.error(`❌ Table ${table} count error: ${countError.message}`);
      } else {
        console.log(`Table ${table}: ${count} rows`);
      }
    } catch (e: any) {
      console.error(`❌ Table ${table} error:`, e.message);
    }
  }
  console.log('====================================');
}

checkProductionDb();
