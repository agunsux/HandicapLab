import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function audit() {
  console.log('====================================');
  console.log('PRODUCTION SYSTEM AUDIT');
  console.log('====================================');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Fetch Predictions
  const { data: predictions, error: predErr } = await supabase
    .from('predictions')
    .select('*')
    .limit(1000);

  if (predErr) {
    console.error('❌ Failed to query predictions:', predErr.message);
    process.exit(1);
  }

  console.log(`Total predictions: ${predictions.length}`);

  // Calculate stats on predictions
  let confidenceScores: number[] = [];
  let marketTypesCount = { AH: 0, OU: 0, ML: 0 };
  let evList: number[] = [];

  for (const p of predictions) {
    marketTypesCount[p.market_type as 'AH' | 'OU' | 'ML'] = (marketTypesCount[p.market_type as 'AH' | 'OU' | 'ML'] || 0) + 1;
    
    // Confidence score
    if (p.market_confidence_score !== null && p.market_confidence_score !== undefined) {
      confidenceScores.push(p.market_confidence_score);
    }
    
    // EV / Edge
    if (p.edge_pct !== null && p.edge_pct !== undefined) {
      evList.push(p.edge_pct);
    }
  }

  console.log('\n--- 1. Prediction Quality & Markets ---');
  console.log(`Market Type Counts: AH=${marketTypesCount.AH}, OU=${marketTypesCount.OU}, ML=${marketTypesCount.ML}`);
  
  if (confidenceScores.length > 0) {
    const minConf = Math.min(...confidenceScores);
    const maxConf = Math.max(...confidenceScores);
    const avgConf = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
    console.log(`Confidence Score Range: Min=${minConf}%, Max=${maxConf}%, Avg=${avgConf.toFixed(2)}%`);
  } else {
    console.log('Confidence Score Range: N/A (all confidence scores are null)');
  }

  if (evList.length > 0) {
    const minEv = Math.min(...evList);
    const maxEv = Math.max(...evList);
    const avgEv = evList.reduce((a, b) => a + b, 0) / evList.length;
    console.log(`Expected Value / Edge Range: Min=${(minEv * 100).toFixed(2)}%, Max=${(maxEv * 100).toFixed(2)}%, Avg=${(avgEv * 100).toFixed(2)}%`);
  } else {
    console.log('Expected Value / Edge Range: N/A (all edges are null)');
  }

  // 2. Fetch Paper Trades
  const { data: trades, error: tradeErr } = await supabase
    .from('paper_trades')
    .select('*')
    .limit(1000);

  if (tradeErr) {
    console.error('❌ Failed to query paper trades:', tradeErr.message);
  } else {
    console.log('\n--- 2. Paper Trading Loop ---');
    console.log(`Paper Trades Count: ${trades.length}`);
    if (trades.length > 0) {
      const pendingCount = trades.filter(t => t.status?.toLowerCase() === 'pending').length;
      console.log(`Pending trades: ${pendingCount}`);
      
      const stakes = trades.map(t => t.stake || 0);
      const odds = trades.map(t => t.entry_odds || 0);
      
      console.log(`Stakes: Min=${Math.min(...stakes)}, Max=${Math.max(...stakes)}, Avg=${(stakes.reduce((a, b) => a + b, 0) / stakes.length).toFixed(4)}`);
      console.log(`Odds: Min=${Math.min(...odds)}, Max=${Math.max(...odds)}, Avg=${(odds.reduce((a, b) => a + b, 0) / odds.length).toFixed(2)}`);
    } else {
      console.log('No paper trades found in database.');
    }
  }

  // 3. Check for Duplicate Matches
  const { data: matches, error: matchErr } = await supabase
    .from('matches')
    .select('id, home_team, away_team, kickoff, league');

  if (matchErr) {
    console.error('❌ Failed to query matches:', matchErr.message);
  } else {
    console.log('\n--- 3. Data Quality (Duplicates) ---');
    console.log(`Total Matches: ${matches.length}`);
    const matchKeys = matches.map(m => `${m.home_team} vs ${m.away_team} on ${m.kickoff}`);
    const uniqueKeys = new Set(matchKeys);
    const duplicatesCount = matchKeys.length - uniqueKeys.size;
    console.log(`Duplicate matches count: ${duplicatesCount}`);
    
    if (matches.length > 0) {
      const sortedMatches = [...matches].sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
      console.log('Latest match fetched:', sortedMatches[0].home_team, 'vs', sortedMatches[0].away_team, 'in', sortedMatches[0].league, 'on', sortedMatches[0].kickoff);
    }
  }

  console.log('====================================');
}

audit();
